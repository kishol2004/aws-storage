/** user.ts — User domain model (mirrors Cognito attributes) */

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserProfile {
  userId: string;       // Cognito sub
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
}
