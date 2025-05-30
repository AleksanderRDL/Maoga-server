const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('../utils/errors');
const config = require('../config');

// Custom handler for rate limit exceeded
const limitHandler = (_req, _res) => {
  throw new RateLimitError('Too many requests, please try again later');
};

// Standard rate limiter - for general API endpoints
const standard = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
  skip: (req) => {
    // Skip rate limiting in test environment unless specifically testing rate limits
    return process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'];
  }
});

// Strict rate limiter - for sensitive endpoints (auth, password reset)
const strict = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 5, // Only 5 requests per window for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
  skipFailedRequests: false,
  skip: (req) => {
    // Skip rate limiting in test environment unless specifically testing rate limits
    return process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'];
  }
});

// Relaxed rate limiter - for read-heavy endpoints
const relaxed = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests * 2, // Double the standard limit
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
  skip: (_req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

const notificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many notification requests'
});

module.exports = {
  rateLimiter: {
    standard,
    strict,
    relaxed,
    notification: notificationLimiter
  }
};
