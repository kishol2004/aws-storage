/**
 * AuthStack.ts — Amazon Cognito User Pool + App Client
 *
 * SECURITY:
 * - Email-only sign-up (username = email)
 * - Email verification required
 * - Password policy: min 8 chars, uppercase, lowercase, digit, symbol
 * - No client secret (SPA/browser client)
 * - ID/access token validity: 1h (refresh: 30d)
 * - Account recovery via email only
 * - MFA optional (recommended OPTIONAL for user convenience)
 */
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  stackPrefix: string;
  frontendOrigin: string;
}

export class AuthStack extends cdk.Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { stackPrefix, frontendOrigin } = props;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${stackPrefix}-users`,

      // Sign-in with email only
      signInAliases: { email: true, username: false },
      autoVerify: { email: true },
      selfSignUpEnabled: true,

      // Standard attributes
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },

      // Strong password policy
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },

      // Account recovery via email
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // MFA: optional (user can opt in)
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },

      // User pool deletion protection
      deletionProtection: false, // Set to true in production

      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Pre-defined user groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'ADMIN',
      description: 'Administrators with full system access',
    });

    new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'USER',
      description: 'Standard users',
    });

    // SPA App Client (no client secret — browser cannot keep secrets)
    this.userPoolClient = this.userPool.addClient('WebAppClient', {
      userPoolClientName: `${stackPrefix}-web-client`,

      generateSecret: false, // SPA cannot keep a secret

      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: false,
        custom: false,
      },

      // OAuth for hosted UI (optional)
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          frontendOrigin,
          `${frontendOrigin}/auth/callback`,
          'http://localhost:5173/auth/callback',
        ],
        logoutUrls: [
          frontendOrigin,
          'http://localhost:5173',
        ],
      },

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Prevent user enumeration
      preventUserExistenceErrors: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${stackPrefix}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${stackPrefix}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'CognitoRegion', {
      value: this.region,
      exportName: `${stackPrefix}-CognitoRegion`,
    });
  }
}
