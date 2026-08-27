/**
 * DatabaseStack.ts — DynamoDB tables with GSIs for all access patterns
 *
 * Tables:
 * - Documents: PK=documentId, GSI1=ownerId-createdAt, GSI2=ownerId-folderId
 * - Folders: PK=folderId, GSI=ownerId-index
 * - Shares: PK=shareId, GSI1=documentId-index, GSI2=sharedWithUserId-status
 * - AuditLogs: PK=userId, SK=sk(timestamp#eventId), GSI=date-timestamp
 * - Notifications: PK=userId, SK=sk(createdAt#notifId)
 * - AIAnalysis: PK=analysisId, GSI=documentId-index
 * - Stats: PK=statKey (atomic counters)
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stackPrefix: string;
}

export class DatabaseStack extends cdk.Stack {
  readonly documentsTable: dynamodb.Table;
  readonly foldersTable: dynamodb.Table;
  readonly sharesTable: dynamodb.Table;
  readonly auditTable: dynamodb.Table;
  readonly notificationsTable: dynamodb.Table;
  readonly aiAnalysisTable: dynamodb.Table;
  readonly statsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);
    const { stackPrefix } = props;

    // ─── Documents Table ───────────────────────────────────────────────────────
    this.documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: `${stackPrefix}-documents`,
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.documentsTable.addGlobalSecondaryIndex({
      indexName: 'ownerId-createdAt-index',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    this.documentsTable.addGlobalSecondaryIndex({
      indexName: 'ownerId-folderId-index',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'folderId', type: dynamodb.AttributeType.STRING },
    });

    // ─── Folders Table ─────────────────────────────────────────────────────────
    this.foldersTable = new dynamodb.Table(this, 'FoldersTable', {
      tableName: `${stackPrefix}-folders`,
      partitionKey: { name: 'folderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.foldersTable.addGlobalSecondaryIndex({
      indexName: 'ownerId-index',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
    });

    // ─── Shares Table ──────────────────────────────────────────────────────────
    this.sharesTable = new dynamodb.Table(this, 'SharesTable', {
      tableName: `${stackPrefix}-shares`,
      partitionKey: { name: 'shareId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.sharesTable.addGlobalSecondaryIndex({
      indexName: 'documentId-index',
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
    });

    this.sharesTable.addGlobalSecondaryIndex({
      indexName: 'sharedWithUserId-status-index',
      partitionKey: { name: 'sharedWithUserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // ─── Audit Table ───────────────────────────────────────────────────────────
    this.auditTable = new dynamodb.Table(this, 'AuditTable', {
      tableName: `${stackPrefix}-audit`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.auditTable.addGlobalSecondaryIndex({
      indexName: 'date-timestamp-index',
      partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // ─── Notifications Table ───────────────────────────────────────────────────
    this.notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: `${stackPrefix}-notifications`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── AI Analysis Table ─────────────────────────────────────────────────────
    this.aiAnalysisTable = new dynamodb.Table(this, 'AIAnalysisTable', {
      tableName: `${stackPrefix}-ai-analysis`,
      partitionKey: { name: 'analysisId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.aiAnalysisTable.addGlobalSecondaryIndex({
      indexName: 'documentId-index',
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ─── Stats Table ───────────────────────────────────────────────────────────
    this.statsTable = new dynamodb.Table(this, 'StatsTable', {
      tableName: `${stackPrefix}-stats`,
      partitionKey: { name: 'statKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Outputs
    const tables = [
      ['Documents', this.documentsTable],
      ['Folders', this.foldersTable],
      ['Shares', this.sharesTable],
      ['Audit', this.auditTable],
      ['Notifications', this.notificationsTable],
      ['AIAnalysis', this.aiAnalysisTable],
      ['Stats', this.statsTable],
    ] as const;

    for (const [name, table] of tables) {
      new cdk.CfnOutput(this, `${name}TableName`, {
        value: table.tableName,
        exportName: `${stackPrefix}-${name}TableName`,
      });
    }
  }
}
