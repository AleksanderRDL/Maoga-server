class SocketError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'SocketError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details
      }
    };
  }
}

class SocketAuthError extends SocketError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 'SOCKET_AUTH_ERROR', details);
  }
}

class SocketValidationError extends SocketError {
  constructor(message = 'Invalid data', details = null) {
    super(message, 'SOCKET_VALIDATION_ERROR', details);
  }
}

module.exports = {
  SocketError,
  SocketAuthError,
  SocketValidationError
};
