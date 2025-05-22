const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('../utils/errors');
const config = require('../config');

// Custom handler for rate limit exceeded
const limitHandler = (req, res) => {
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
        // Skip rate limiting for health check or in test environment
        // But don't skip if we're specifically testing rate limiting with a special header
        return (req.path === '/health' || 
                (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']));
    }
});

// Strict rate limiter - for sensitive endpoints (auth, password reset)
const strict = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: 5, // Only 5 requests per window for auth endpoints
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler,
    skipFailedRequests: false // Count failed requests too
});

// Relaxed rate limiter - for read-heavy endpoints
const relaxed = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests * 2, // Double the standard limit
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler
});

module.exports = {
    rateLimiter: {
        standard,
        strict,
        relaxed
    }
};