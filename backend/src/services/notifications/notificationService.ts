/**
 * notificationService.ts — In-app notification delivery service
 */
import { createNotification } from '../dynamodb/notificationRepository.js';
import { generateId } from '../../utils/ids.js';
import type { NotificationType } from '../../models/notification.js';

export interface SendNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedResourceId?: string;
  relatedResourceType?: string;
}

/**
 * Create an in-app notification for a user.
 * Fire-and-forget — does not block the caller.
 */
export function sendNotification(params: SendNotificationParams): void {
  const notification = {
    notificationId: generateId('notif'),
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    read: false,
    relatedResourceId: params.relatedResourceId,
    relatedResourceType: params.relatedResourceType,
    createdAt: new Date().toISOString(),
  };

  createNotification(notification).catch((err) => {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message: 'Failed to send notification',
        userId: params.userId,
        errorMessage: err instanceof Error ? err.message : 'Unknown',
      })
    );
  });
}

// ─── Notification templates ───────────────────────────────────────────────────

export function notifyShareReceived(
  recipientUserId: string,
  ownerEmail: string,
  documentName: string,
  permission: string,
  documentId: string
): void {
  sendNotification({
    userId: recipientUserId,
    title: 'Document Shared With You',
    message: `${ownerEmail} shared "${documentName}" with you (${permission} access).`,
    type: 'INFO',
    relatedResourceId: documentId,
    relatedResourceType: 'DOCUMENT',
  });
}

export function notifyShareRevoked(
  recipientUserId: string,
  documentName: string,
  documentId: string
): void {
  sendNotification({
    userId: recipientUserId,
    title: 'Document Access Revoked',
    message: `Your access to "${documentName}" has been revoked.`,
    type: 'WARNING',
    relatedResourceId: documentId,
    relatedResourceType: 'DOCUMENT',
  });
}

export function notifyAIProcessingComplete(
  userId: string,
  documentName: string,
  documentId: string
): void {
  sendNotification({
    userId,
    title: 'AI Analysis Complete',
    message: `AI analysis for "${documentName}" is ready to view.`,
    type: 'SUCCESS',
    relatedResourceId: documentId,
    relatedResourceType: 'DOCUMENT',
  });
}

export function notifyAIProcessingFailed(
  userId: string,
  documentName: string,
  documentId: string
): void {
  sendNotification({
    userId,
    title: 'AI Analysis Failed',
    message: `AI analysis for "${documentName}" could not be completed. Please try again.`,
    type: 'ERROR',
    relatedResourceId: documentId,
    relatedResourceType: 'DOCUMENT',
  });
}
