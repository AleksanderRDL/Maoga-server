const config = require('./config');
const logger = require('./utils/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const app = require('./app');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.fatal('UNCAUGHT EXCEPTION! Shutting down...', {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.fatal('UNHANDLED REJECTION! Shutting down...', {
        reason: reason,
        promise: promise
    });
    process.exit(1);
});

let server;

async function startServer() {
    try {
        // Connect to MongoDB
        await connectDatabase();
        logger.info('MongoDB connected successfully');

        // Start HTTP server
        server = app.listen(config.port, () => {
            logger.info(`Server is running on port ${config.port} in ${config.env} mode`);
        });

        // Initialize Socket.IO (placeholder for Sprint 6)
        // const io = require('./services/socket').initialize(server);
        // logger.info('Socket.IO initialized');

    } catch (error) {
        logger.fatal('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed');

            try {
                // Close database connections
                await disconnectDatabase();
                logger.info('Database connections closed');

                // Close other resources (Redis, etc.) - future sprints

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown', { error: error.message });
                process.exit(1);
            }
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    }
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();