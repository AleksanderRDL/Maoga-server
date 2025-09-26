const mongoose = require('mongoose');
const config = require('./index');
const baseLogger = require('../utils/logger');

const logger = baseLogger.forModule('database:connection');
const mongooseLogger = baseLogger.forModule('database:mongoose');

function configureDebugLogging() {
  if (config.database?.debug) {
    mongoose.set('debug', (collection, method, query, doc, options = {}) => {
      mongooseLogger.debug('Mongoose operation', {
        collection,
        method,
        query,
        doc,
        options
      });
    });
  } else {
    mongoose.set('debug', false);
  }
}

configureDebugLogging();

mongoose.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    if (ret && typeof ret === 'object') {
      delete ret.__v;
    }
    return ret;
  }
});

mongoose.set('toObject', {
  virtuals: true,
  transform: (_doc, ret) => {
    if (ret && typeof ret === 'object') {
      delete ret.__v;
    }
    return ret;
  }
});
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.connectionPromise = null;
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    this.connectionPromise = await this._connect();
    return this.connectionPromise;
  }

  async _connect() {
    const uri = process.env.MONGODB_TEST_URI || config.database.uri;
    try {
      logger.info('Attempting MongoDB connection', {
        uri,
        options: config.database.options
      });

      await mongoose.connect(uri, config.database.options);
      this.isConnected = true;

      logger.info('MongoDB connected successfully', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name
      });

      mongoose.connection.on('error', (error) => {
        mongooseLogger.error('MongoDB connection error', { error: error.message });
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        mongooseLogger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        mongooseLogger.info('MongoDB reconnected');
      });

      return mongoose.connection;
    } catch (error) {
      this.isConnected = false;
      mongooseLogger.error('Failed to connect to MongoDB', {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        errorName: error.name,
        uri
      });
      throw error;
    }
  }

  async disconnect() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected gracefully');
    }
  }

  getConnection() {
    return mongoose.connection;
  }

  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

module.exports = new DatabaseManager();
