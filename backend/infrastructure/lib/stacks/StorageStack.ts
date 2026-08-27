/**
 * StorageStack.ts — Private S3 bucket with SSE, versioning, lifecycle policies
 *
 * SECURITY:
 * - BlockPublicAccess: ALL (enforces truly private bucket)
 * - Versioning enabled (supports recovery of overwritten documents)
 * - Server-side encryption: S3-managed AES256 by default, KMS-optional
 * - Bucket policy enforces HTTPS-only access (denies HTTP)
 * - No public-read ACLs anywhere
 * - Lifecycle rule removes non-current versions after 30 days
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface StorageStackProps extends cdk.StackProps {
  stackPrefix: string;
}

export class StorageStack extends cdk.Stack {
  readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { stackPrefix } = props;

    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `${stackPrefix.toLowerCase()}-documents-${this.account}`,

      // Truly private — no public access of any kind
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,

      // Encryption at rest
      encryption: s3.BucketEncryption.S3_MANAGED,

      // Versioning for document recovery
      versioned: true,

      // Enforce HTTPS only (block HTTP requests)
      enforceSSL: true,

      // Enable EventBridge notifications for decoupled async processing
      eventBridgeEnabled: true,

      // CORS for browser presigned URL uploads
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: [
            'http://localhost:5173',
            // CloudFront distribution URL added in post-deployment
          ],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],

      // Lifecycle: clean up non-current versions
      lifecycleRules: [
        {
          id: 'expire-non-current-versions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],

      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never auto-delete documents
      autoDeleteObjects: false,
    });

    // Output bucket name and ARN
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      exportName: `${stackPrefix}-DocumentsBucketName`,
    });

    new cdk.CfnOutput(this, 'DocumentsBucketArn', {
      value: this.documentsBucket.bucketArn,
      exportName: `${stackPrefix}-DocumentsBucketArn`,
    });
  }
}
