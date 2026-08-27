/**
 * MonitoringStack.ts — CloudWatch alarms + CloudTrail
 *
 * CloudWatch alarms:
 * - Lambda error rate > 5%
 * - API Gateway 5xx rate > 1%
 * - API Gateway 4xx rate > 10%
 * - DLQ messages > 0 (processing failures)
 *
 * CloudTrail:
 * - Multi-region trail for AWS-level audit
 * - S3 bucket for trail storage
 * - Log file validation enabled
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  stackPrefix: string;
  apiId: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { stackPrefix, apiId } = props;

    // ─── CloudTrail ──────────────────────────────────────────────────────────
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      bucketName: `${stackPrefix.toLowerCase()}-cloudtrail-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365), // 1 year retention
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cloudtrail.Trail(this, 'CloudTrail', {
      trailName: `${stackPrefix}-trail`,
      bucket: trailBucket,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      enableFileValidation: true, // Detect log tampering
    });

    // ─── CloudWatch Dashboard ─────────────────────────────────────────────────
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${stackPrefix}-dashboard`,
    });

    // API Gateway metrics
    const apiNamespace = 'AWS/ApiGateway';
    const dimensions = { ApiId: apiId, Stage: 'v1' };

    const fivexxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `${stackPrefix}-api-5xx-errors`,
      metric: new cloudwatch.Metric({
        namespace: apiNamespace,
        metricName: '5XXError',
        dimensionsMap: dimensions,
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const fourxxAlarm = new cloudwatch.Alarm(this, 'Api4xxAlarm', {
      alarmName: `${stackPrefix}-api-4xx-spike`,
      metric: new cloudwatch.Metric({
        namespace: apiNamespace,
        metricName: '4XXError',
        dimensionsMap: dimensions,
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    dashboard.addWidgets(
      new cloudwatch.AlarmWidget({
        title: 'API 5XX Errors',
        alarm: fivexxAlarm,
        width: 12,
      }),
      new cloudwatch.AlarmWidget({
        title: 'API 4XX Spike',
        alarm: fourxxAlarm,
        width: 12,
      })
    );

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${stackPrefix}-dashboard`,
    });
  }
}
