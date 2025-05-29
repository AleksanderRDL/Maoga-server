const { authenticate, authorize } = require('./auth');
const { globalErrorHandler } = require('./errorHandler');
const { rateLimiter } = require('./rateLimiter');
const { requestLogger, requestIdMiddleware } = require('./requestLogger');
const { validateRequest, validateQuery, validateParams } = require('./validator');
const { attachSocketInfo } = require('./socketAuth');

module.exports = {
  authenticate,
  authorize,
  globalErrorHandler,
  rateLimiter,
  requestLogger,
  requestIdMiddleware,
  validateRequest,
  validateQuery,
  validateParams,
  attachSocketInfo
};
