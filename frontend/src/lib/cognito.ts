/**
 * cognito.ts — Amazon Cognito SDK wrapper for the frontend
 *
 * Uses amazon-cognito-identity-js (the official Cognito JS SDK for browser SPAs).
 * All auth tokens are managed by the SDK in localStorage automatically.
 *
 * SECURITY:
 * - Tokens stored by SDK (never hand-rolled localStorage token management)
 * - ID token sent as Authorization: Bearer header (not access token)
 * - Token is refreshed automatically by the SDK on expiry
 * - Never stores passwords
 * - Session retrieved on page load to restore auth state
 */
import {
  CognitoUser,
  CognitoUserPool,
  CognitoUserAttribute,
  AuthenticationDetails,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

// ─── User Pool Configuration ──────────────────────────────────────────────────
// These are PUBLIC values — they are safe to expose in the frontend.
// Security comes from the Cognito Authorizer in API Gateway, not from hiding these.

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION as string;

if (!USER_POOL_ID || !CLIENT_ID) {
  console.warn(
    '[Auth] Cognito credentials not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID in your .env file.'
  );
}

const userPool = USER_POOL_ID && CLIENT_ID
  ? new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })
  : null;

export const isCognitoConfigured = !!userPool;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCognitoUser(email: string): CognitoUser | null {
  if (!userPool) return null;
  return new CognitoUser({ Username: email, Pool: userPool });
}

/**
 * Get the current session's ID token (used as Bearer token for API calls).
 * Returns null if not authenticated or token expired and refresh fails.
 */
export async function getIdToken(): Promise<string | null> {
  if (!userPool) return null;

  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) return resolve(null);

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) return resolve(null);
        resolve(session.getIdToken().getJwtToken());
      }
    );
  });
}

/**
 * Extract user profile from Cognito ID token claims.
 */
export function parseUserFromSession(session: CognitoUserSession) {
  const payload = session.getIdToken().decodePayload() as Record<string, string>;
  const groups = (payload['cognito:groups'] ?? '').split(',').filter(Boolean);

  return {
    id: payload['sub'] ?? '',
    email: payload['email'] ?? '',
    name: payload['name'] ?? payload['email']?.split('@')[0] ?? 'User',
    role: groups.includes('ADMIN') ? 'ADMIN' : ('USER' as 'ADMIN' | 'USER'),
    status: 'ACTIVE' as const,
    createdAt: new Date().toISOString(),
  };
}

// ─── Auth Operations ──────────────────────────────────────────────────────────

export async function cognitoLogin(
  email: string,
  password: string
): Promise<ReturnType<typeof parseUserFromSession>> {
  if (!userPool) throw new Error('Cognito is not configured.');

  const cognitoUser = getCognitoUser(email)!;
  const authDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve(parseUserFromSession(session));
      },
      onFailure: (err: Error & { code?: string }) => {
        // Map Cognito error codes to user-friendly messages
        const messages: Record<string, string> = {
          NotAuthorizedException: 'Incorrect email or password.',
          UserNotConfirmedException: 'Please verify your email address first.',
          UserNotFoundException: 'No account found with this email address.',
          PasswordResetRequiredException: 'Your password needs to be reset.',
          TooManyRequestsException: 'Too many attempts. Please wait and try again.',
        };
        reject(
          new Error(
            messages[err.code ?? ''] ?? 'Sign in failed. Please try again.'
          )
        );
      },
      newPasswordRequired: () => {
        reject(new Error('A new password is required. Please contact support.'));
      },
    });
  });
}

export async function cognitoRegister(
  email: string,
  name: string,
  password: string
): Promise<void> {
  if (!userPool) throw new Error('Cognito is not configured.');

  const attributes = [
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'name', Value: name }),
  ];

  return new Promise((resolve, reject) => {
    userPool!.signUp(email, password, attributes, [], (err) => {
      if (err) {
        const messages: Record<string, string> = {
          UsernameExistsException: 'An account with this email already exists.',
          InvalidPasswordException: 'Password does not meet requirements.',
          InvalidParameterException: 'Invalid email format.',
          TooManyRequestsException: 'Too many attempts. Please wait and try again.',
        };
        const cognitoErr = err as Error & { code?: string };
        reject(
          new Error(
            messages[cognitoErr.code ?? ''] ?? 'Registration failed. Please try again.'
          )
        );
      } else {
        resolve();
      }
    });
  });
}

export async function cognitoConfirmRegistration(
  email: string,
  code: string
): Promise<void> {
  if (!userPool) throw new Error('Cognito is not configured.');
  const cognitoUser = getCognitoUser(email)!;

  return new Promise((resolve, reject) => {
    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(new Error('Invalid or expired verification code.'));
      } else {
        resolve();
      }
    });
  });
}

export async function cognitoForgotPassword(email: string): Promise<void> {
  if (!userPool) throw new Error('Cognito is not configured.');
  const cognitoUser = getCognitoUser(email)!;

  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      // Also resolve on inputVerificationCode — we need the next step
      inputVerificationCode: () => resolve(),
      onFailure: () => {
        // Generic message to prevent email enumeration
        resolve();
      },
    });
  });
}

export async function cognitoConfirmPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  if (!userPool) throw new Error('Cognito is not configured.');
  const cognitoUser = getCognitoUser(email)!;

  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => {
        reject(new Error('Password reset failed. Please check your code and try again.'));
      },
    });
  });
}

export function cognitoLogout(): void {
  if (!userPool) return;
  const cognitoUser = userPool.getCurrentUser();
  cognitoUser?.signOut();
}

export async function getCurrentSession(): Promise<ReturnType<
  typeof parseUserFromSession
> | null> {
  if (!userPool) return null;

  return new Promise((resolve) => {
    const cognitoUser = userPool!.getCurrentUser();
    if (!cognitoUser) return resolve(null);

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) return resolve(null);
        resolve(parseUserFromSession(session));
      }
    );
  });
}
