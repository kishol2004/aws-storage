/**
 * ApiStack.ts — API Gateway + all Lambda functions with least-privilege IAM
 *
 * Creates:
 * - REST API with Cognito Authorizer
 * - One Lambda function per endpoint
 * - Separate IAM role per function group (DocumentLambdaRole, AdminLambdaRole, etc.)
 * - API Gateway Usage Plan with throttling
 * - CORS restricted to frontendOrigin (never *)
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ApiStackProps extends cdk.StackProps {
  stackPrefix: string;
  documentsBucket: s3.Bucket;
  documentsTable: dynamodb.Table;
  foldersTable: dynamodb.Table;
  sharesTable: dynamodb.Table;
  auditTable: dynamodb.Table;
  notificationsTable: dynamodb.Table;
  statsTable: dynamodb.Table;
  aiAnalysisTable: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  frontendOrigin: string;
}

export class ApiStack extends cdk.Stack {
  readonly apiId: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      stackPrefix,
      documentsBucket,
      documentsTable,
      foldersTable,
      sharesTable,
      auditTable,
      notificationsTable,
      statsTable,
      aiAnalysisTable,
      userPool,
      frontendOrigin,
    } = props;

    const distPath = path.join(__dirname, '../../../dist');

    // ─── Common environment variables ─────────────────────────────────────────
    const commonEnv = {
      REGION: this.region,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      DOCUMENTS_TABLE: documentsTable.tableName,
      FOLDERS_TABLE: foldersTable.tableName,
      SHARES_TABLE: sharesTable.tableName,
      AUDIT_TABLE: auditTable.tableName,
      NOTIFICATIONS_TABLE: notificationsTable.tableName,
      STATS_TABLE: statsTable.tableName,
      AI_ANALYSIS_TABLE: aiAnalysisTable.tableName,
      USER_POOL_ID: userPool.userPoolId,
      FRONTEND_ORIGIN: frontendOrigin,
      BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
      BEDROCK_REGION: this.region,
      UPLOAD_URL_EXPIRY_SECONDS: '900',
      DOWNLOAD_URL_EXPIRY_SECONDS: '300',
      NODE_ENV: 'production',
    };

    // ─── IAM Role factory (least-privilege per function group) ────────────────
    const createLambdaRole = (name: string) =>
      new iam.Role(this, `${name}Role`, {
        roleName: `${stackPrefix}-${name}-role`,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
        ],
      });

    // ─── Lambda function factory ──────────────────────────────────────────────
    const createFn = (
      id: string,
      handlerPath: string,
      role: iam.Role,
      extraEnv: Record<string, string> = {}
    ) =>
      new lambda.Function(this, id, {
        functionName: `${stackPrefix}-${id.toLowerCase()}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: `${handlerPath}.handler`,
        code: lambda.Code.fromAsset(distPath),
        role,
        timeout: cdk.Duration.seconds(29), // API Gateway max
        memorySize: 512,
        environment: { ...commonEnv, ...extraEnv },
      });

    // ─── API Gateway ──────────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/aws/apigateway/${stackPrefix}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${stackPrefix}-api`,
      description: 'DocManager API',
      deployOptions: {
        stageName: 'v1',
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [frontendOrigin],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        allowCredentials: true,
      },
    });

    this.apiId = api.restApiId;

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: `${stackPrefix}-authorizer`,
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ─── Document Lambda group ────────────────────────────────────────────────
    const docRole = createLambdaRole('document-lambda');
    documentsTable.grantReadWriteData(docRole);
    foldersTable.grantReadData(docRole);
    sharesTable.grantReadData(docRole);
    aiAnalysisTable.grantReadData(docRole);
    auditTable.grantWriteData(docRole);
    notificationsTable.grantWriteData(docRole);
    statsTable.grantReadWriteData(docRole);
    documentsBucket.grantPut(docRole);
    documentsBucket.grantRead(docRole);
    documentsBucket.grantDelete(docRole);
    docRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:ListUsers'],
      resources: [userPool.userPoolArn],
    }));

    const uploadUrlFn = createFn('createUploadUrl', 'functions/documents/createUploadUrl', docRole);
    const listDocsFn = createFn('listDocuments', 'functions/documents/listDocuments', docRole);
    const getDocFn = createFn('getDocument', 'functions/documents/getDocument', docRole);
    const updateDocFn = createFn('updateDocument', 'functions/documents/updateDocument', docRole);
    const deleteDocFn = createFn('deleteDocument', 'functions/documents/deleteDocument', docRole);
    const restoreDocFn = createFn('restoreDocument', 'functions/documents/restoreDocument', docRole);
    const permDeleteFn = createFn('permanentDeleteDocument', 'functions/documents/permanentDeleteDocument', docRole);
    const downloadFn = createFn('downloadDocument', 'functions/documents/downloadDocument', docRole);
    const favoriteFn = createFn('favoriteDocument', 'functions/documents/favoriteDocument', docRole);

    // ─── Folder Lambda group ──────────────────────────────────────────────────
    const folderRole = createLambdaRole('folder-lambda');
    foldersTable.grantReadWriteData(folderRole);
    documentsTable.grantReadWriteData(folderRole);
    auditTable.grantWriteData(folderRole);

    const createFolderFn = createFn('createFolder', 'functions/folders/createFolder', folderRole);
    const listFoldersFn = createFn('listFolders', 'functions/folders/listFolders', folderRole);
    const updateFolderFn = createFn('updateFolder', 'functions/folders/updateFolder', folderRole);
    const deleteFolderFn = createFn('deleteFolder', 'functions/folders/deleteFolder', folderRole);

    // ─── Sharing Lambda group ─────────────────────────────────────────────────
    const shareRole = createLambdaRole('sharing-lambda');
    sharesTable.grantReadWriteData(shareRole);
    documentsTable.grantReadData(shareRole);
    notificationsTable.grantWriteData(shareRole);
    auditTable.grantWriteData(shareRole);
    statsTable.grantReadWriteData(shareRole);
    shareRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminGetUser'],
      resources: [userPool.userPoolArn],
    }));

    const shareDocFn = createFn('shareDocument', 'functions/sharing/shareDocument', shareRole);
    const listSharesFn = createFn('listShares', 'functions/sharing/listShares', shareRole);
    const updateShareFn = createFn('updateShare', 'functions/sharing/updateShare', shareRole);
    const revokeShareFn = createFn('revokeShare', 'functions/sharing/revokeShare', shareRole);
    const sharedWithMeFn = createFn('listSharedWithMe', 'functions/sharing/listSharedWithMe', shareRole);

    // ─── Search Lambda group ──────────────────────────────────────────────────
    const searchRole = createLambdaRole('search-lambda');
    documentsTable.grantReadData(searchRole);
    sharesTable.grantReadData(searchRole);

    const searchFn = createFn('searchDocuments', 'functions/search/searchDocuments', searchRole);

    // ─── Activity/Notifications Lambda group ──────────────────────────────────
    const activityRole = createLambdaRole('activity-lambda');
    auditTable.grantReadData(activityRole);
    notificationsTable.grantReadWriteData(activityRole);

    const getActivityFn = createFn('getActivity', 'functions/activity/getActivity', activityRole);
    const listNotifFn = createFn('listNotifications', 'functions/notifications/listNotifications', activityRole);
    const markNotifFn = createFn('markNotificationRead', 'functions/notifications/markNotificationRead', activityRole);

    // ─── AI Lambda group ──────────────────────────────────────────────────────
    const aiRole = createLambdaRole('ai-lambda');
    documentsTable.grantReadData(aiRole);
    aiAnalysisTable.grantReadData(aiRole);
    sharesTable.grantReadData(aiRole);

    const getAnalysisFn = createFn('getAnalysis', 'functions/ai/getAnalysis', aiRole);

    // ─── Admin Lambda group ───────────────────────────────────────────────────
    const adminRole = createLambdaRole('admin-lambda');
    statsTable.grantReadData(adminRole);
    auditTable.grantReadData(adminRole);
    adminRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:ListUsers',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminEnableUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    const getUsersFn = createFn('getUsers', 'functions/admin/getUsers', adminRole);
    const updateUserFn = createFn('updateUser', 'functions/admin/updateUser', adminRole);
    const getStatsFn = createFn('getStatistics', 'functions/admin/getStatistics', adminRole);
    const getAuditFn = createFn('getAuditLogs', 'functions/admin/getAuditLogs', adminRole);

    // ─── Route helpers ────────────────────────────────────────────────────────
    const integrate = (fn: lambda.Function) =>
      new apigateway.LambdaIntegration(fn, { proxy: true });

    const docs = api.root.addResource('documents');
    const uploadUrl = docs.addResource('upload-url');
    const docId = docs.addResource('{id}');
    const docDownload = docId.addResource('download');
    const docFavorite = docId.addResource('favorite');
    const docRestore = docId.addResource('restore');
    const docPermanent = docId.addResource('permanent');
    const docShares = docId.addResource('shares');
    const docAI = docId.addResource('ai-analysis');

    const folders = api.root.addResource('folders');
    const folderId = folders.addResource('{id}');

    const shares = api.root.addResource('shares');
    const shareId = shares.addResource('{id}');

    const sharedWithMe = api.root.addResource('shared-with-me');
    const search = api.root.addResource('search');
    const activity = api.root.addResource('activity');

    const notifications = api.root.addResource('notifications');
    const notifId = notifications.addResource('{id}');

    const admin = api.root.addResource('admin');
    const adminUsers = admin.addResource('users');
    const adminUserId = adminUsers.addResource('{id}');
    const adminStats = admin.addResource('statistics');
    const adminAudit = admin.addResource('audit-logs');

    // ─── Routes ───────────────────────────────────────────────────────────────
    uploadUrl.addMethod('POST', integrate(uploadUrlFn), authOptions);
    docs.addMethod('GET', integrate(listDocsFn), authOptions);
    docId.addMethod('GET', integrate(getDocFn), authOptions);
    docId.addMethod('PATCH', integrate(updateDocFn), authOptions);
    docId.addMethod('DELETE', integrate(deleteDocFn), authOptions);
    docDownload.addMethod('GET', integrate(downloadFn), authOptions);
    docFavorite.addMethod('POST', integrate(favoriteFn), authOptions);
    docRestore.addMethod('POST', integrate(restoreDocFn), authOptions);
    docPermanent.addMethod('DELETE', integrate(permDeleteFn), authOptions);
    docShares.addMethod('POST', integrate(shareDocFn), authOptions);
    docShares.addMethod('GET', integrate(listSharesFn), authOptions);
    docAI.addMethod('GET', integrate(getAnalysisFn), authOptions);

    folders.addMethod('GET', integrate(listFoldersFn), authOptions);
    folders.addMethod('POST', integrate(createFolderFn), authOptions);
    folderId.addMethod('PATCH', integrate(updateFolderFn), authOptions);
    folderId.addMethod('DELETE', integrate(deleteFolderFn), authOptions);

    shareId.addMethod('PATCH', integrate(updateShareFn), authOptions);
    shareId.addMethod('DELETE', integrate(revokeShareFn), authOptions);

    sharedWithMe.addMethod('GET', integrate(sharedWithMeFn), authOptions);
    search.addMethod('GET', integrate(searchFn), authOptions);
    activity.addMethod('GET', integrate(getActivityFn), authOptions);
    notifications.addMethod('GET', integrate(listNotifFn), authOptions);
    notifId.addMethod('PATCH', integrate(markNotifFn), authOptions);

    adminUsers.addMethod('GET', integrate(getUsersFn), authOptions);
    adminUserId.addMethod('PATCH', integrate(updateUserFn), authOptions);
    adminStats.addMethod('GET', integrate(getStatsFn), authOptions);
    adminAudit.addMethod('GET', integrate(getAuditFn), authOptions);

    // ─── Usage Plan with throttling ───────────────────────────────────────────
    const usagePlan = api.addUsagePlan('DefaultUsagePlan', {
      name: `${stackPrefix}-usage-plan`,
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
    });
    usagePlan.addApiStage({ stage: api.deploymentStage });

    // ─── Outputs ──────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: `${stackPrefix}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: api.restApiId,
      exportName: `${stackPrefix}-ApiId`,
    });
  }
}
