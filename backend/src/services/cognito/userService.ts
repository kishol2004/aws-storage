/**
 * userService.ts — Cognito user service
 * Used for admin operations and recipient validation on shares.
 */
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  ListUsersCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../../config/environment.js';
import { NotFoundError } from '../../utils/errors.js';
import type { UserProfile } from '../../models/user.js';

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.region,
});

function mapCognitoUser(user: UserType): UserProfile {
  const attrs = user.Attributes ?? [];
  const get = (name: string) =>
    attrs.find((a) => a.Name === name)?.Value ?? '';

  return {
    userId: get('sub'),
    email: get('email'),
    name: get('name') || get('email').split('@')[0] || 'Unknown',
    role: 'USER', // Role managed by Cognito Groups
    status: user.Enabled ? 'ACTIVE' : 'DISABLED',
    createdAt: user.UserCreateDate?.toISOString() ?? new Date().toISOString(),
  };
}

/**
 * Look up a Cognito user by email.
 * Used to verify the recipient exists before creating a share.
 * Returns null if not found — avoids leaking user enumeration via exceptions.
 */
export async function getUserByEmail(
  email: string
): Promise<UserProfile | null> {
  try {
    const result = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: config.userPoolId,
        Filter: `email = "${email}"`,
        Limit: 1,
      })
    );
    const user = result.Users?.[0];
    if (!user) return null;
    return mapCognitoUser(user);
  } catch {
    return null;
  }
}

/**
 * Get a Cognito user by their sub (userId).
 * Used for admin operations and profile retrieval.
 */
export async function getUserById(userId: string): Promise<UserProfile> {
  try {
    const result = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: config.userPoolId,
        Username: userId,
      })
    );

    const attrs = result.UserAttributes ?? [];
    const get = (name: string) =>
      attrs.find((a) => a.Name === name)?.Value ?? '';

    return {
      userId: get('sub') || userId,
      email: get('email'),
      name: get('name') || get('email').split('@')[0] || 'Unknown',
      role: 'USER',
      status: result.Enabled ? 'ACTIVE' : 'DISABLED',
      createdAt:
        result.UserCreateDate?.toISOString() ?? new Date().toISOString(),
    };
  } catch {
    throw new NotFoundError('User');
  }
}

export interface ListUsersOptions {
  limit?: number;
  paginationToken?: string;
}

export interface ListUsersResult {
  users: UserProfile[];
  nextToken?: string;
}

/**
 * List all users in the Cognito User Pool (admin only).
 */
export async function listAllUsers(
  options: ListUsersOptions = {}
): Promise<ListUsersResult> {
  const { limit = 20, paginationToken } = options;

  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: config.userPoolId,
      Limit: limit,
      PaginationToken: paginationToken,
    })
  );

  return {
    users: (result.Users ?? []).map(mapCognitoUser),
    nextToken: result.PaginationToken,
  };
}

/**
 * Disable or enable a Cognito user account (admin only).
 */
export async function setUserStatus(
  userId: string,
  status: 'ACTIVE' | 'DISABLED'
): Promise<void> {
  const Command =
    status === 'DISABLED' ? AdminDisableUserCommand : AdminEnableUserCommand;

  await cognitoClient.send(
    new Command({
      UserPoolId: config.userPoolId,
      Username: userId,
    })
  );
}
