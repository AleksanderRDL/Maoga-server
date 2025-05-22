const morgan = require('morgan');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Generate unique request ID
const generateRequestId = () => {
    return crypto.randomBytes(16).toString('hex');
};

// Add request ID to request object
const requestIdMiddleware = (req, res, next) => {
    req.id = generateRequestId();
    res.setHeader('X-Request-ID', req.id);
    next();
};

// Custom morgan tokens
morgan.token('id', (req) => req.id);
morgan.token('user-id', (req) => req.user?.id || 'anonymous');

// Create custom morgan format
const morganFormat = ':id :method :url :status :response-time ms - :res[content-length] - :user-id';

// Create stream object for morgan to write to logger
const stream = {
    write: (message) => {
        // Remove newline character from morgan
        const logMessage = message.trim();

        // Parse the log parts
        const parts = logMessage.split(' ');
        const requestId = parts[0];
        const method = parts[1];
        const url = parts[2];
        const status = parseInt(parts[3]);
        const responseTime = parseFloat(parts[4]);
        const contentLength = parts[7] === '-' ? 0 : parseInt(parts[7]);
        const userId = parts[9] || 'anonymous';

        // Log with structured data
        logger.info({
            msg: 'HTTP Request',
            request: {
                id: requestId,
                method: method,
                url: url,
                userId: userId
            },
            response: {
                statusCode: status,
                time: responseTime,
                contentLength: contentLength
            }
        });
    }
};

// Create morgan middleware
const morganMiddleware = morgan(morganFormat, { stream });

// Export combined middleware
const requestLogger = [requestIdMiddleware, morganMiddleware];

module.exports = {
    requestLogger,
    requestIdMiddleware
};