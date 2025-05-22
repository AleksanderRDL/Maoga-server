const tokenService = require('../modules/auth/services/tokenService');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Authenticate user via JWT token
 */
//TODO remember to make asyncHandler call async if verifyAccessToken becomes promise based
const authenticate = asyncHandler((req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('No token provided');
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  const decoded = tokenService.verifyAccessToken(token);

  // Attach user info to request
  req.user = {
    id: decoded.id,
    email: decoded.email,
    username: decoded.username,
    role: decoded.role
  };

  next();
});

/**
 * Authorize user based on roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};