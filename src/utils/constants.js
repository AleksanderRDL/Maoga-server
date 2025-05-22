// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

// User Status
const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  DELETED: 'deleted'
};

// Token Types
const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'reset_password',
  EMAIL_VERIFICATION: 'email_verification'
};

// Regex Patterns
const REGEX = {
  EMAIL: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
  USERNAME: /^[a-zA-Z0-9_-]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
};

// Default Values
const DEFAULTS = {
  PAGINATION: {
    LIMIT: 20,
    MAX_LIMIT: 100,
    PAGE: 1
  },
  KARMA_POINTS: 0,
  VIRTUAL_CURRENCY: 0
};

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  USER_STATUS,
  TOKEN_TYPES,
  REGEX,
  DEFAULTS
};
