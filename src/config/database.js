const mongoose = require('mongoose');
const config = require('./index');
const baseLogger = require('../utils/logger');

const logger = baseLogger.forModule('database:connection');
const mongooseLogger = baseLogger.forModule('database:mongoose');
const memoryLogger = baseLogger.forModule('database:memory');

const FALLBACK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH'
]);

const FALLBACK_ERROR_MESSAGE_FRAGMENTS = [
  'failed to connect',
  'server selection timed out',
  'connection refused',
  'connect econnrefused',
  'getaddrinfo',
  'unreachable',
  'timed out',
  'closed before handshake'
];

let MongoMemoryServer;

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
    this.memoryServer = null;
    this.memoryUri = null;
    this.isUsingMemory = false;
    this.listenersAttached = false;
  }

  async connect() {
    if (!this.connectionPromise) {
      this.connectionPromise = this._connect().catch((error) => {
        this.connectionPromise = null;
        throw error;
      });
    }

    return await this.connectionPromise;
  }

  async _connect() {
    const uri = process.env.MONGODB_TEST_URI || config.database.uri;

    logger.info('Attempting MongoDB connection', {
      uri,
      options: config.database.options,
      inMemoryFallback: this._isMemoryFallbackEnabled()
    });

    try {
      return await this._connectWithUri(uri, { isMemory: false });
    } catch (error) {
      this.isConnected = false;

      mongooseLogger.error('Failed to connect to MongoDB', {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        errorName: error.name,
        uri
      });

      const fallbackConnection = await this._attemptMemoryFallback(error);
      if (fallbackConnection) {
        return fallbackConnection;
      }

      throw error;
    }
  }

  async _connectWithUri(uri, { isMemory }) {
    await mongoose.connect(uri, config.database.options);

    this.isConnected = true;
    this.isUsingMemory = Boolean(isMemory);
    this.memoryUri = isMemory ? uri : null;
    this._attachConnectionEventListeners();

    const connection = mongoose.connection;
    logger.info('MongoDB connected successfully', {
      host: connection.host,
      port: connection.port,
      database: connection.name,
      storage: this.isUsingMemory ? 'in-memory' : 'external'
    });

    return connection;
  }

  async _attemptMemoryFallback(error) {
    if (!this._shouldFallbackToMemory(error)) {
      return null;
    }

    if (!MongoMemoryServer) {
      ({ MongoMemoryServer } = require('mongodb-memory-server'));
    }

    if (!this.memoryServer) {
      const dbName = config.database?.memory?.dbName;
      const memoryOptions = dbName ? { instance: { dbName } } : undefined;
      this.memoryServer = await MongoMemoryServer.create(memoryOptions);
      this.memoryUri = this.memoryServer.getUri(dbName);
    }

    memoryLogger.warn('Falling back to in-memory MongoDB instance for development use', {
      reason: error.message,
      uri: this.memoryUri
    });

    return await this._connectWithUri(this.memoryUri, { isMemory: true });
  }

  _attachConnectionEventListeners() {
    if (this.listenersAttached) {
      return;
    }

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

    this.listenersAttached = true;
  }

  _isMemoryFallbackEnabled() {
    return Boolean(config.database?.allowInMemoryFallback);
  }

  _shouldFallbackToMemory(error) {
    if (!this._isMemoryFallbackEnabled()) {
      return false;
    }

    if (!error) {
      return false;
    }

    const code = error.code || error.errno;
    if (code && FALLBACK_ERROR_CODES.has(code)) {
      return true;
    }

    const message = (error.message || '').toLowerCase();
    return FALLBACK_ERROR_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment));
  }

  async disconnect() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected gracefully');
    }

    if (this.memoryServer) {
      await this.memoryServer.stop();
      memoryLogger.info('In-memory MongoDB instance stopped');
      this.memoryServer = null;
      this.memoryUri = null;
      this.isUsingMemory = false;
    }

    this.connectionPromise = null;
  }

  getConnection() {
    return mongoose.connection;
  }

  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

module.exports = new DatabaseManager();
