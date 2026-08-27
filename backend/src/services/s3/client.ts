/** client.ts — Singleton S3 Client */
import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../../config/environment.js';

export const s3Client = new S3Client({ region: config.region });
