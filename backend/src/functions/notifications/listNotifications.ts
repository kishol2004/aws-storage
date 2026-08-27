/** listNotifications.ts — GET /notifications */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { listNotifications } from '../../services/dynamodb/notificationRepository.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const notifications = await listNotifications(user.userId);
    const unreadCount = notifications.filter((n) => !n.read).length;
    return successResponse({ notifications, unreadCount, count: notifications.length });
  }
);
