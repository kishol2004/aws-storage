/** notification.ts — In-app notification model */

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface NotificationEntity {
  notificationId: string;
  userId: string;         // Recipient Cognito sub
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  relatedResourceId?: string;
  relatedResourceType?: string;
  createdAt: string;
}
