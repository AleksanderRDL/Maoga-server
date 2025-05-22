// Base error class for all application errors
class AppError extends Error {
  constructor(message, statusCode, errorCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // Capture stack trace, excluding this constructor
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 Bad Request
class BadRequestError extends AppError {
  constructor(message = 'Bad request', errorCode = 'BAD_REQUEST') {
    super(message, 400, errorCode);
  }
}

// 401 Unauthorized
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', errorCode = 'AUTHENTICATION_ERROR') {
    super(message, 401, errorCode);
  }
}

// 403 Forbidden
class AuthorizationError extends AppError {
  constructor(message = 'Access forbidden', errorCode = 'AUTHORIZATION_ERROR') {
    super(message, 403, errorCode);
  }
}

// 404 Not Found
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

// 409 Conflict
class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode = 'CONFLICT') {
    super(message, 409, errorCode);
  }
}

// 422 Unprocessable Entity (Validation Error)
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errorCode = 'VALIDATION_ERROR', details = null) {
    super(message, 422, errorCode);
    this.details = details;
  }
}

// 429 Too Many Requests
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', errorCode = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, errorCode);
  }
}

// 500 Internal Server Error
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', errorCode = 'INTERNAL_SERVER_ERROR') {
    super(message, 500, errorCode, false); // Not operational error
  }
}

module.exports = {
  AppError,
  BadRequestError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError
};