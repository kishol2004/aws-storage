/**
 * environment.ts
 * Type-safe environment variable loading for all Lambda functions.
 * All values are passed as Lambda environment variables via CDK — never hard-coded.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env['NODE_ENV'] === 'test' || process.env['JEST_WORKER_ID']) {
      return `test-${name.toLowerCase()}`;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  region: optionalEnv('AWS_REGION', 'ap-south-1'),

  // DynamoDB Table Names
  documentsTable: requireEnv('DOCUMENTS_TABLE'),
  foldersTable: requireEnv('FOLDERS_TABLE'),
  sharesTable: requireEnv('SHARES_TABLE'),
  auditTable: requireEnv('AUDIT_TABLE'),
  notificationsTable: requireEnv('NOTIFICATIONS_TABLE'),
  aiAnalysisTable: requireEnv('AI_ANALYSIS_TABLE'),
  statsTable: requireEnv('STATS_TABLE'),

  // S3
  documentsBucket: requireEnv('DOCUMENTS_BUCKET'),

  // Cognito
  userPoolId: requireEnv('USER_POOL_ID'),
  userPoolClientId: requireEnv('USER_POOL_CLIENT_ID'),

  // SQS
  processingQueueUrl: requireEnv('PROCESSING_QUEUE_URL'),

  // Bedrock
  bedrockModelId: optionalEnv(
    'BEDROCK_MODEL_ID',
    'anthropic.claude-3-haiku-20240307-v1:0'
  ),
  bedrockRegion: optionalEnv('BEDROCK_REGION', 'ap-south-1'),

  // File constraints
  maxFileSizeMb: parseInt(optionalEnv('MAX_FILE_SIZE_MB', '50'), 10),
  uploadUrlExpirySeconds: parseInt(
    optionalEnv('UPLOAD_URL_EXPIRY_SECONDS', '900'),
    10
  ),
  downloadUrlExpirySeconds: parseInt(
    optionalEnv('DOWNLOAD_URL_EXPIRY_SECONDS', '300'),
    10
  ),

  // CORS
  allowedOrigin: optionalEnv('FRONTEND_ORIGIN', 'http://localhost:5173'),
} as const;

export type Config = typeof config;
