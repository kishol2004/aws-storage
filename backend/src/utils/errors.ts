/**
 * errors.ts
 * Custom error classes for the SecureDoc AI backend.
 * All errors carry an HTTP status code and a safe code string for the client.
 * Internal details are never exposed — error handler logs them privately.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxMb: number) {
    super(`File exceeds the maximum allowed size of ${maxMb}MB.`, 413, 'FILE_TOO_LARGE');
  }
}

export class FileValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'FILE_VALIDATION_ERROR');
  }
}

export class AIProcessingError extends AppError {
  constructor(message = 'AI processing failed.') {
    super(message, 500, 'AI_PROCESSING_ERROR');
  }
}

export class StorageError extends AppError {
  constructor(message = 'A storage error occurred.') {
    super(message, 500, 'STORAGE_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
