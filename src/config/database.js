const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

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
    try {
      // Debug logging
      logger.info('Attempting MongoDB connection', {
        uri: config.database.uri,
        options: config.database.options
      });

      await mongoose.connect(config.database.uri, config.database.options);
      this.isConnected = true;

      logger.info('MongoDB connected successfully', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name
      });

      // Connection event handlers
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', { error: error.message });
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        logger.info('MongoDB reconnected');
      });

      return mongoose.connection;
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to MongoDB', {
        error: error.message,
        uri: config.database.uri
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