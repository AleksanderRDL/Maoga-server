// src/config/index.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseModuleLogLevels(rawValue) {
  if (!rawValue) {
    return {};
  }

  const entries = rawValue
    .split(',')
    .map((pair) => pair.split('=').map((part) => part && part.trim()))
    .filter(([name, level]) => Boolean(name) && Boolean(level));

  return Object.fromEntries(entries);
}

const baseConfig = {
  env: env,
  port: parseInt(process.env.PORT, 10) || 3000,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-key-12345-change-in-production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-67890-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
    issuer: 'maoga-backend',
    audience: 'maoga-app'
  },
  logging: {
    level: process.env.LOG_LEVEL || (env === 'development' ? 'info' : 'warn'),
    pretty: parseBoolean(process.env.LOG_PRETTY, env === 'development'),
    showConfig: parseBoolean(process.env.LOG_CONFIG_DEBUG, false),
    modules: parseModuleLogLevels(process.env.LOG_MODULE_LEVELS)
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) || [
      'http://localhost:3000',
      'http://localhost:8080'
    ] // Default for dev
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests:
      env === 'test'
        ? 1000 // Higher limit for tests unless specifically testing rate limits
        : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },
  database: {
    debug: parseBoolean(process.env.MONGOOSE_DEBUG, env === 'development'),
    allowInMemoryFallback: parseBoolean(
      process.env.DB_ALLOW_IN_MEMORY_FALLBACK,
      env !== 'production'
    ),
    memory: {
      dbName: process.env.MONGODB_MEMORY_DB_NAME || 'maoga_dev_memory'
    },
    // Default options that can be overridden by environment-specific files
    options: {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'maoga',
    allowMockFallback: parseBoolean(process.env.REDIS_ALLOW_MOCK_FALLBACK, env !== 'production'),
    lockTTL: parseInt(process.env.REDIS_LOCK_TTL_MS, 10) || 5000,
    requestLockTtl: parseInt(process.env.MATCH_REQUEST_LOCK_TTL_MS, 10) || 15 * 60 * 1000
  },
  // External API Configuration
  igdb: {
    clientId: process.env.IGDB_CLIENT_ID || 'your-igdb-client-id',
    clientSecret: process.env.IGDB_CLIENT_SECRET || 'your-igdb-client-secret',
    apiUrl: 'https://api.igdb.com/v4'
  },
  // Jobs Configuration
  jobs: {
    gameSyncInterval: parseInt(process.env.GAME_SYNC_INTERVAL, 10) || 24 * 60 * 60 * 1000, // 24 hours
    gameSyncEnabled: process.env.GAME_SYNC_ENABLED !== 'false' // Default true
  },
  socketIO: {
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || (env === 'test' ? 3000 : 60000),
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || (env === 'test' ? 1000 : 25000),
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE, 10) || 1e6,
    transports: env === 'test' ? ['websocket'] : ['polling', 'websocket'], // Websocket only for tests
    cors: {
      credentials: true
    }
  },
  // Notification configuration
  notification: {
    cleanupDaysToKeep: parseInt(process.env.NOTIFICATION_CLEANUP_DAYS, 10) || 30,
    batchSize: {
      push: parseInt(process.env.NOTIFICATION_PUSH_BATCH_SIZE, 10) || 10,
      email: parseInt(process.env.NOTIFICATION_EMAIL_BATCH_SIZE, 10) || 5
    }
  },

  // Firebase configuration
  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null,
    projectId: process.env.FIREBASE_PROJECT_ID
  },

  // Email configuration
  email: {
    from: process.env.EMAIL_FROM || 'noreply@maoga.com',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },

  // App configuration
  app: {
    name: process.env.APP_NAME || 'Maoga',
    url: process.env.APP_URL || 'http://localhost:3000'
  }
};

// Load environment-specific configuration
let envConfig = {};
const envConfigFile = path.join(__dirname, 'environments', `${env}.js`);

// Check if the environment-specific config file exists before requiring it
if (fs.existsSync(envConfigFile)) {
  envConfig = require(envConfigFile);
}

const mergedLogging = {
  ...baseConfig.logging,
  ...envConfig.logging,
  modules: {
    ...(baseConfig.logging?.modules || {}),
    ...(envConfig.logging?.modules || {})
  }
};

// Deep merge baseConfig and envConfig, envConfig takes precedence
// A simple merge strategy; for deeper nested objects, consider lodash.merge
const mergedConfig = {
  ...baseConfig,
  ...envConfig,
  jwt: { ...baseConfig.jwt, ...envConfig.jwt },
  logging: mergedLogging,
  cors: { ...baseConfig.cors, ...envConfig.cors },
  rateLimit: { ...baseConfig.rateLimit, ...envConfig.rateLimit },
  matchmaking: {
    // matchmaking-specific config
    processIntervalMs: env === 'test' ? 2000 : 5000 // 2s for test, 5s for others
  },
  database: {
    // Ensure database config is also well-merged
    uri:
      envConfig.database?.uri ||
      baseConfig.database?.uri ||
      process.env.MONGODB_URI ||
      (env === 'development'
        ? 'mongodb://localhost:27017/maoga_dev'
        : 'mongodb://localhost:27017/maoga_prod_default'), // Default for prod if not set
    options: { ...baseConfig.database.options, ...envConfig.database?.options },
    debug: envConfig.database?.debug ?? baseConfig.database.debug,
    allowInMemoryFallback:
      envConfig.database?.allowInMemoryFallback ?? baseConfig.database.allowInMemoryFallback,
    memory: {
      ...baseConfig.database.memory,
      ...envConfig.database?.memory
    }
  }
};

// Specifically for test environment, ensure MONGODB_TEST_URI is prioritized if set
if (env === 'test') {
  mergedConfig.database.uri =
    process.env.MONGODB_TEST_URI ||
    envConfig.database?.uri ||
    'mongodb://localhost:27017/maoga_test';
  // Ensure test logging level is applied if not already by envConfig
  if (!envConfig.logging || !envConfig.logging.level) {
    mergedConfig.logging.level = 'error';
  }
}

if (mergedConfig.logging.showConfig) {
  /* eslint-disable no-console */
  console.log('=== CONFIG DEBUG START ===');
  console.log(`NODE_ENV: ${mergedConfig.env}`);
  console.log(`Effective Log Level: ${mergedConfig.logging.level}`);
  console.log(`Module Log Levels: ${JSON.stringify(mergedConfig.logging.modules)}`);
  console.log(`CORS Origins: ${JSON.stringify(mergedConfig.cors.allowedOrigins)}`);
  console.log(`Rate Limit Window MS: ${mergedConfig.rateLimit.windowMs}`);
  console.log(`Rate Limit Max Requests: ${mergedConfig.rateLimit.maxRequests}`);
  console.log(`Database URI: ${mergedConfig.database.uri}`);
  console.log(`Database Options: ${JSON.stringify(mergedConfig.database.options)}`);
  console.log('=== CONFIG DEBUG END ===');
  /* eslint-enable no-console */
}

module.exports = mergedConfig;
