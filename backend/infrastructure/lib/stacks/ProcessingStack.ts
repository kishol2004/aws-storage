/**
 * ProcessingStack.ts — S3→SQS→Lambda async processing pipeline
 *
 * When a file is uploaded to S3:
 * S3 Event → SQS Queue → processDocument Lambda
 *
 * Uses SQS as buffer (not direct S3→Lambda) for:
 * - Retry handling (SQS DLQ after 3 attempts)
 * - Backpressure control
 * - Decoupled async processing
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProcessingStackProps extends cdk.StackProps {
  stackPrefix: string;
  documentsBucket: s3.Bucket;
  documentsTable: dynamodb.Table;
  aiAnalysisTable: dynamodb.Table;
  statsTable: dynamodb.Table;
  notificationsTable: dynamodb.Table;
  auditTable: dynamodb.Table;
}

export class ProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    const {
      stackPrefix,
      documentsBucket,
      documentsTable,
      aiAnalysisTable,
      statsTable,
      notificationsTable,
      auditTable,
    } = props;

    // Dead Letter Queue (failed messages after 3 attempts)
    const dlq = new sqs.Queue(this, 'ProcessingDLQ', {
      queueName: `${stackPrefix}-processing-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Processing Queue
    const processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `${stackPrefix}-processing`,
      visibilityTimeout: cdk.Duration.minutes(15), // Match Lambda timeout
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3, // Retry 3 times before DLQ
      },
    });

    // EventBridge Rule: Route S3 ObjectCreated events under users/ to Processing SQS queue
    new events.Rule(this, 'DocumentUploadedRule', {
      ruleName: `${stackPrefix}-document-uploaded`,
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [documentsBucket.bucketName],
          },
          object: {
            key: [{ prefix: 'users/' }],
          },
        },
      },
      targets: [new targets.SqsQueue(processingQueue)],
    });

    // Processing Lambda IAM role (least-privilege)
    const processingRole = new iam.Role(this, 'ProcessingLambdaRole', {
      roleName: `${stackPrefix}-processing-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // S3: Read documents only
    documentsBucket.grantRead(processingRole);
    // S3: Write extracted text
    documentsBucket.grantWrite(processingRole, 'extracted-text/*');

    // DynamoDB: Read/update documents + write AI analysis, stats, notifications, audit
    documentsTable.grantReadWriteData(processingRole);
    aiAnalysisTable.grantWriteData(processingRole);
    statsTable.grantReadWriteData(processingRole);
    notificationsTable.grantWriteData(processingRole);
    auditTable.grantWriteData(processingRole);

    // SQS: Consume messages
    processingQueue.grantConsumeMessages(processingRole);

    // Textract permissions
    processingRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'textract:DetectDocumentText',
          'textract:StartDocumentTextDetection',
          'textract:GetDocumentTextDetection',
        ],
        resources: ['*'], // Textract does not support resource-level restrictions
      })
    );

    // Bedrock permissions (specific model only)
    processingRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        ],
      })
    );

    // Processing Lambda
    const processingLambda = new lambda.Function(this, 'ProcessingLambda', {
      functionName: `${stackPrefix}-process-document`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/ai/processDocument.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../dist')
      ),
      role: processingRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024, // AI processing needs more memory
      environment: {
        REGION: this.region,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        DOCUMENTS_TABLE: documentsTable.tableName,
        AI_ANALYSIS_TABLE: aiAnalysisTable.tableName,
        STATS_TABLE: statsTable.tableName,
        NOTIFICATIONS_TABLE: notificationsTable.tableName,
        AUDIT_TABLE: auditTable.tableName,
        BEDROCK_MODEL_ID:
          'anthropic.claude-3-haiku-20240307-v1:0',
        BEDROCK_REGION: this.region,
        NODE_ENV: 'production',
      },
    });

    // SQS → Lambda trigger
    processingLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(processingQueue, {
        batchSize: 1, // Process one document at a time (AI is heavy)
        maxBatchingWindow: cdk.Duration.seconds(0),
      })
    );

    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: processingQueue.queueUrl,
    });

    new cdk.CfnOutput(this, 'ProcessingDLQUrl', {
      value: dlq.queueUrl,
    });
  }
}
