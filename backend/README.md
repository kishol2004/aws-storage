# AI-Powered Secure Cloud Document Management System

> **Final Year Project** — Production-grade AWS Serverless Backend + React Frontend

---

## Architecture Overview

```
React Frontend (Vite + TypeScript)
         │
         │  JWT (Cognito ID Token)
         ▼
Amazon Cognito ──→ User Pool + Groups (USER / ADMIN)
         │
         │  Authorization header
         ▼
API Gateway (REST) ──→ Cognito Authorizer validates JWT
         │
         ▼
AWS Lambda (TypeScript) ──→ Claims extracted from requestContext.authorizer.claims
         │                   (NEVER from request body)
    ┌────┴────┐
    ▼         ▼
  Amazon S3    Amazon DynamoDB
(Documents)   (Metadata, Shares, Audit)
    │
    ▼ (S3 Event → SQS → Lambda)
Amazon Textract → Amazon Bedrock (Claude)
    │
    ▼
AI Analysis stored in DynamoDB
```

---

## Project Structure

```
project-root/
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── context/AuthContext.tsx   # Real Cognito auth
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios client with Cognito token
│   │   │   └── cognito.ts            # amazon-cognito-identity-js wrapper
│   │   └── ...
│   └── .env.example
│
└── backend/           # AWS Serverless Backend
    ├── src/
    │   ├── config/    # Environment configuration
    │   ├── functions/ # Lambda handlers (27 functions)
    │   ├── middleware/ # Auth, Authorization, Validation, Error handling
    │   ├── models/    # TypeScript domain models
    │   ├── schemas/   # Zod validation schemas
    │   ├── services/  # DynamoDB, S3, Cognito, Textract, Bedrock, Audit
    │   └── utils/     # Response helpers, errors, ID generation
    ├── infrastructure/
    │   ├── bin/main.ts  # CDK entry point
    │   └── lib/stacks/  # 6 CDK stacks
    └── .env.example
```

---

## Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK v2 (`npm install -g aws-cdk`)
- An AWS account with access to:
  - Lambda, API Gateway, Cognito, S3, DynamoDB
  - Amazon Textract, Amazon Bedrock (Claude model access enabled)

---

## Backend Deployment

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Bootstrap CDK (first time only)

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

### 4. Configure CDK context

```bash
# Edit cdk.json or pass as CLI arguments:
cdk deploy --all \
  -c projectName=DocManager \
  -c stage=dev \
  -c frontendOrigin=http://localhost:5173
```

### 5. Deploy all stacks

```bash
cdk deploy --all
```

This deploys in order:
1. `DocManager-dev-Storage` — S3 bucket
2. `DocManager-dev-Database` — 7 DynamoDB tables
3. `DocManager-dev-Auth` — Cognito User Pool
4. `DocManager-dev-Processing` — SQS + processing Lambda
5. `DocManager-dev-Api` — API Gateway + 27 Lambda functions
6. `DocManager-dev-Monitoring` — CloudWatch + CloudTrail

### 6. Note CDK outputs

After deployment, copy these values from the terminal output:
- `ApiUrl` → `VITE_API_BASE_URL`
- `UserPoolId` → `VITE_COGNITO_USER_POOL_ID`
- `UserPoolClientId` → `VITE_COGNITO_CLIENT_ID`

---

## Frontend Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in the values from CDK outputs
```

### 3. Run locally

```bash
npm run dev
```

---

## Enable Bedrock Model Access

Before AI features work, you must request model access in the AWS Console:

1. Go to **Amazon Bedrock → Model access** in your AWS region
2. Request access to: `Anthropic Claude 3 Haiku`
3. Wait for approval (usually instant for Claude Haiku)

---

## Create First Admin User

After deployment, create your first admin in Cognito:

```bash
# 1. Create user
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=name,Value=Admin \
  --temporary-password TempPass123!

# 2. Add to ADMIN group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --group-name ADMIN
```

---

## Security Architecture

### Identity & Authorization
- **Authentication**: Amazon Cognito (JWT, no custom auth server)
- **Authorization**: Enforced inside Lambda from `requestContext.authorizer.claims`
- **User identity**: Always Cognito `sub` — never client-supplied user ID
- **Role**: Read from `cognito:groups` claim — never from request body

### Data Security
- **S3**: All objects private, HTTPS enforced, no public ACLs
- **S3 keys**: `users/{userId}/folders/{folderId}/{documentId}/{sanitizedFilename}`
- **Presigned URLs**: Short-lived (upload: 15min, download: 5min)
- **DynamoDB**: AWS-managed encryption, point-in-time recovery enabled
- **Input validation**: Zod schemas on all endpoints, `.strict()` mode rejects extra fields

### AI Security
- Bedrock only processes documents whose ownership is validated first
- Prompt size limited (8,000 chars max)
- All Bedrock output validated with Zod before storage
- Invalid AI output → `processingStatus = FAILED` (never stored as trusted data)

### Audit Trail
- Every document operation logged to DynamoDB audit table
- CloudTrail enabled for AWS-level API audit
- Structured CloudWatch logging (never logs passwords, tokens, or document contents)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/documents` | List documents (with filters) |
| `POST` | `/documents/upload-url` | Get presigned S3 upload URL |
| `GET` | `/documents/{id}` | Get document + AI analysis |
| `PATCH` | `/documents/{id}` | Rename / update metadata |
| `DELETE` | `/documents/{id}` | Soft delete |
| `POST` | `/documents/{id}/restore` | Restore from trash |
| `DELETE` | `/documents/{id}/permanent` | Permanent delete |
| `GET` | `/documents/{id}/download` | Get presigned download URL |
| `POST` | `/documents/{id}/favorite` | Toggle favorite |
| `POST` | `/documents/{id}/share` | Share document |
| `GET` | `/documents/{id}/shares` | List shares (owner) |
| `GET` | `/documents/{id}/ai-analysis` | Get AI analysis |
| `GET` | `/folders` | List folders |
| `POST` | `/folders` | Create folder |
| `PATCH` | `/folders/{id}` | Rename folder |
| `DELETE` | `/folders/{id}` | Delete folder |
| `PATCH` | `/shares/{id}` | Update share permission |
| `DELETE` | `/shares/{id}` | Revoke share |
| `GET` | `/shared-with-me` | Documents shared with me |
| `GET` | `/search` | Search documents |
| `GET` | `/activity` | My activity log |
| `GET` | `/notifications` | My notifications |
| `PATCH` | `/notifications/{id}` | Mark notification read |
| `GET` | `/admin/users` | List users (ADMIN) |
| `PATCH` | `/admin/users/{id}` | Enable/disable user (ADMIN) |
| `GET` | `/admin/statistics` | System stats (ADMIN) |
| `GET` | `/admin/audit-logs` | All audit logs (ADMIN) |

---

## npm Scripts

```bash
# Backend
npm run build        # Compile TypeScript → dist/
npm run build:watch  # Watch mode
cdk deploy --all     # Deploy all stacks
cdk destroy --all    # Tear down all stacks
```
