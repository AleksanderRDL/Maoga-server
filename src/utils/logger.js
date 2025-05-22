const pino = require('pino');
const config = require('../config');

// Create logger instance
const logger = pino({
    level: config.logging.level || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => {
            return { level: label };
        }
    },
    // Pretty print in development
    ...(config.env === 'development' && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname'
            }
        }
    }),
    // Add service metadata
    base: {
        service: 'maoga-backend',
        env: config.env
    }
});

// Create child logger with request ID for request-specific logging
logger.child = function(bindings) {
    return pino.child.call(this, bindings);
};

module.exports = logger;