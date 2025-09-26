const Redis = require('ioredis');
const RedisMock = require('ioredis-mock');
const config = require('../../config');
const logger = require('../../utils/logger').forModule('redis:manager');

const FALLBACK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH'
]);

class RedisManager {
  constructor() {
    this.client = null;
    this.connectionPromise = null;
    this.isMock = false;
  }

  async connect() {
    if (this.connectionPromise) {
      return await this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        return await this._establishConnection();
      } catch (error) {
        this.connectionPromise = null;
        if (!this.isMock) {
          this.client = null;
        }
        logger.error('Failed to establish Redis connection', { error: error.message });
        throw error;
      }
    })();

    return await this.connectionPromise;
  }

  async _establishConnection() {
    if (this.client) {
      const status = this.client.status;
      const isReady = status && ['connecting', 'connect', 'ready'].includes(status);
      if (isReady || this.isMock) {
        return this.client;
      }

      if (!this.isMock && typeof this.client.connect === 'function') {
        try {
          await this.client.connect();
        } catch (error) {
          if (/already connecting/i.test(error.message || '')) {
            return this.client;
          }
          const fallbackClient = await this._handleInitialConnectError(this.client, error);
          if (fallbackClient) {
            return fallbackClient;
          }
          throw error;
        }
      }

      return this.client;
    }

    const { client, isMock } = this._createClient();
    this.client = client;
    this.isMock = isMock;
    this._attachEventHandlers(client);

    if (!isMock && typeof client.connect === 'function') {
      try {
        await client.connect();
      } catch (error) {
        if (/already connecting/i.test(error.message || '')) {
          return this.client;
        }
        const fallbackClient = await this._handleInitialConnectError(client, error);
        if (fallbackClient) {
          return fallbackClient;
        }
        throw error;
      }
    }

    return this.client;
  }

  async _handleInitialConnectError(failedClient, error) {
    if (!this._shouldFallbackToMock(error)) {
      return null;
    }

    logger.warn('Redis connection failed, falling back to in-memory mock', {
      error: error.message,
      code: error.code,
      target: config.redis?.url || `${config.redis?.host}:${config.redis?.port}`
    });

    await this._cleanupFailedClient(failedClient);

    const mockClient = this._createMockClient();
    this._attachEventHandlers(mockClient);
    this.client = mockClient;
    this.isMock = true;
    return mockClient;
  }

  async _cleanupFailedClient(client) {
    if (!client) {
      return;
    }

    try {
      if (typeof client.removeAllListeners === 'function') {
        client.removeAllListeners();
      }
      if (typeof client.disconnect === 'function') {
        client.disconnect(false);
      } else if (typeof client.quit === 'function') {
        await client.quit();
      }
    } catch (cleanupError) {
      logger.debug('Failed to clean up Redis client after connection failure', {
        error: cleanupError.message
      });
    }
  }

  _createMockClient() {
    return new RedisMock();
  }

  _shouldFallbackToMock(error) {
    if (this.isMock) {
      return false;
    }

    if (!config.redis?.allowMockFallback) {
      return false;
    }

    const code = error?.code;
    if (code && FALLBACK_ERROR_CODES.has(code)) {
      return true;
    }

    const errno = typeof error?.errno === 'string' ? error.errno : undefined;
    if (errno && FALLBACK_ERROR_CODES.has(errno)) {
      return true;
    }

    const message = (error?.message || '').toLowerCase();
    const fallbackMessageFragments = [
      'connection is closed',
      'connection refused',
      'connect econnrefused',
      'failed to connect',
      'socket closed',
      'timed out',
      'getaddrinfo',
      'unreachable'
    ];
    if (fallbackMessageFragments.some((fragment) => message.includes(fragment))) {
      return true;
    }

    return /connect(?:ion)? (?:refused|timed out|reset)/.test(message);
  }

  getClient() {
    if (!this.client) {
      // Fire and forget connection attempt
      this.connect().catch((error) => {
        logger.error('Redis connection error', { error: error.message });
      });
    }
    return this.client;
  }

  async disconnect() {
    if (!this.client) {
      return;
    }

    try {
      if (typeof this.client.quit === 'function') {
        await this.client.quit();
      } else if (typeof this.client.disconnect === 'function') {
        this.client.disconnect();
      }
    } catch (error) {
      logger.warn('Error while disconnecting Redis client', { error: error.message });
    } finally {
      this.client = null;
      this.connectionPromise = null;
      this.isMock = false;
    }
  }

  _createClient() {
    const shouldUseMock = this._shouldUseMock();
    if (shouldUseMock) {
      logger.warn('Using in-memory Redis mock (ioredis-mock). This should only occur in tests.');
      return { client: this._createMockClient(), isMock: true };
    }

    const options = this._buildOptions();
    let client;

    if (config.redis?.url) {
      logger.info('Connecting to Redis via URL', { url: config.redis.url });
      client = new Redis(config.redis.url, options);
    } else {
      const { host, port, ...rest } = options;
      logger.info('Connecting to Redis', { host, port });
      client = new Redis({ host, port, ...rest });
    }

    return { client, isMock: false };
  }

  _buildOptions() {
    const redisConfig = config.redis || {};
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    };

    if (redisConfig.keyPrefix) {
      options.keyPrefix = redisConfig.keyPrefix;
    }
    if (!redisConfig.url) {
      options.host = redisConfig.host || '127.0.0.1';
      options.port = redisConfig.port || 6379;
    }
    if (redisConfig.username) {
      options.username = redisConfig.username;
    }
    if (redisConfig.password) {
      options.password = redisConfig.password;
    }
    if (typeof redisConfig.db === 'number') {
      options.db = redisConfig.db;
    }

    options.retryStrategy = (times) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn('Retrying Redis connection', { attempt: times, delay });
      return delay;
    };

    return options;
  }

  _shouldUseMock() {
    if (process.env.USE_REDIS_MOCK === 'true') {
      return true;
    }
    return config.env === 'test';
  }

  _attachEventHandlers(client) {
    client.on('connect', () => {
      logger.info('Redis connection established');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
    });

    client.on('end', () => {
      logger.warn('Redis connection closed');
    });
  }
}

module.exports = new RedisManager();
