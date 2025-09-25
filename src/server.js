const config = require('./config');
const logger = require('./utils/logger').forModule('app:server');
const databaseManager = require('./config/database');
const app = require('./app');
const gameSyncJob = require('./jobs/gameSyncJob');
const socketManager = require('./services/socketManager');
const notificationQueue = require('./jobs/notificationQueue');
const pushService = require('./modules/notification/services/pushService');
const emailService = require('./modules/notification/services/emailService');

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
    await databaseManager.connect();
    logger.info('MongoDB connected successfully');

    // Start HTTP server
    server = app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port} in ${config.env} mode`);
    });

    // Initialize Socket.IO
    const _io = socketManager.initialize(server);
    logger.info('Socket.IO initialized');

    // Initialize notification services
    pushService.initialize();
    await emailService.initialize();

    // Start notification queue processing
    if (config.env !== 'test') {
      notificationQueue.start();
      logger.info('Notification queue started');
    }

    // Start background jobs
    if (config.jobs.gameSyncEnabled && config.env !== 'test') {
      gameSyncJob.schedule();
      logger.info('Game sync job scheduled');
    }
  } catch (error) {
    logger.fatal('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  // Removed async, but the inner logic is async
  logger.info(`${signal} received. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      // This callback is async
      logger.info('HTTP server closed');
      try {
        notificationQueue.stop();
        await databaseManager.disconnect();
        logger.info('Database connections closed');
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
      }
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    // If server isn't initialized, exit directly or handle as needed
    process.exit(0);
  }
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

