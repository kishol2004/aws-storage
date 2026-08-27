/** markNotificationRead.ts — PATCH /notifications/{id} */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler } from '../../middleware/errorHandler.js';
import { extractCognitoUser } from '../../middleware/auth.js';
import { getPathParam } from '../../middleware/validation.js';
import { markAllNotificationsRead } from '../../services/dynamodb/notificationRepository.js';
import { successResponse } from '../../utils/response.js';

export const handler = withErrorHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const user = extractCognitoUser(event);
    const notificationId = getPathParam(event, 'id');

    // If id is 'all', mark all as read
    if (notificationId === 'all') {
      await markAllNotificationsRead(user.userId);
      return successResponse({ message: 'All notifications marked as read.' });
    }

    await markAllNotificationsRead(user.userId);
    return successResponse({ notificationId, read: true });
  }
);
