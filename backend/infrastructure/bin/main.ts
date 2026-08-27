#!/usr/bin/env node
/**
 * main.ts — CDK App Entry Point
 * Deploys all stacks in dependency order.
 */
import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/stacks/StorageStack.js';
import { DatabaseStack } from '../lib/stacks/DatabaseStack.js';
import { AuthStack } from '../lib/stacks/AuthStack.js';
import { ApiStack } from '../lib/stacks/ApiStack.js';
import { ProcessingStack } from '../lib/stacks/ProcessingStack.js';
import { MonitoringStack } from '../lib/stacks/MonitoringStack.js';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: process.env['CDK_DEFAULT_REGION'] ?? 'ap-south-1',
};

const projectName = app.node.tryGetContext('projectName') ?? 'DocManager';
const stageName = app.node.tryGetContext('stage') ?? 'dev';
const stackPrefix = `${projectName}-${stageName}`;
const frontendOrigin = app.node.tryGetContext('frontendOrigin') ?? 'http://localhost:5173';

// Layer 1: Storage
const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, {
  env,
  stackPrefix,
});

// Layer 2: Database
const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  stackPrefix,
});

// Layer 3: Auth
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, {
  env,
  stackPrefix,
  frontendOrigin,
});

// Layer 4: Processing (async pipeline)
const processingStack = new ProcessingStack(app, `${stackPrefix}-Processing`, {
  env,
  stackPrefix,
  documentsBucket: storageStack.documentsBucket,
  documentsTable: databaseStack.documentsTable,
  aiAnalysisTable: databaseStack.aiAnalysisTable,
  statsTable: databaseStack.statsTable,
  notificationsTable: databaseStack.notificationsTable,
  auditTable: databaseStack.auditTable,
});

// Layer 5: API Gateway + Lambda Functions
const apiStack = new ApiStack(app, `${stackPrefix}-Api`, {
  env,
  stackPrefix,
  documentsBucket: storageStack.documentsBucket,
  documentsTable: databaseStack.documentsTable,
  foldersTable: databaseStack.foldersTable,
  sharesTable: databaseStack.sharesTable,
  auditTable: databaseStack.auditTable,
  notificationsTable: databaseStack.notificationsTable,
  statsTable: databaseStack.statsTable,
  aiAnalysisTable: databaseStack.aiAnalysisTable,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  frontendOrigin,
});

// Layer 6: Monitoring (CloudWatch alarms)
new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  stackPrefix,
  apiId: apiStack.apiId,
});

cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Stage', stageName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
