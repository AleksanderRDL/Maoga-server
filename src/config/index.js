// src/config/index.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger'); // Corrected: fs is not a constructor

const env = process.env.NODE_ENV || 'development';

// Base configuration
const baseConfig = {
  env: env,
  port: parseInt(process.env.PORT, 10) || 3000,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-key-12345-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-67890-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
    issuer: 'maoga-backend',
    audience: 'maoga-app'
  },
  logging: {
    level: process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info')
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ||
            ['http://localhost:3000', 'http://localhost:8080'] // Default for dev
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: env === 'test'
      ? 1000 // Higher limit for tests unless specifically testing rate limits
      : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100)
  },
  database: {
    // Default options that can be overridden by environment-specific files
    options: {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  }
};

// Load environment-specific configuration
let envConfig = {};
const envConfigFile = path.join(__dirname, 'environments', `${env}.js`);

// Check if the environment-specific config file exists before requiring it
if (fs.existsSync(envConfigFile)) {
  envConfig = require(envConfigFile);
}


// Deep merge baseConfig and envConfig, envConfig takes precedence
// A simple merge strategy; for deeper nested objects, consider lodash.merge
const mergedConfig = {
  ...baseConfig,
  ...envConfig,
  // Ensure nested objects like jwt, logging, cors, rateLimit, database.options are merged
  jwt: { ...baseConfig.jwt, ...envConfig.jwt },
  logging: { ...baseConfig.logging, ...envConfig.logging },
  cors: { ...baseConfig.cors, ...envConfig.cors },
  rateLimit: { ...baseConfig.rateLimit, ...envConfig.rateLimit },
  database: {
    uri: envConfig.database?.uri || baseConfig.database?.uri || process.env.MONGODB_URI || (env === 'development' ? 'mongodb://localhost:27017/maoga_dev' : 'mongodb://localhost:27017/maoga_prod_default'),
    options: { ...baseConfig.database?.options, ...envConfig.database?.options }
  }
};

// Specifically for test environment, ensure MONGODB_TEST_URI is prioritized if set
if (env === 'test') {
  mergedConfig.database.uri = process.env.MONGODB_TEST_URI || envConfig.database?.uri || 'mongodb://localhost:27017/maoga_test';
  // Ensure test logging level is applied if not already by envConfig
  if (!envConfig.logging || !envConfig.logging.level) {
    mergedConfig.logging.level = 'error';
  }
}


// Debug output (optional, can be removed or conditional)
if (env === 'development' || env === 'test') {
  logger.debug('=== CONFIG DEBUG START ===');
  logger.debug(`NODE_ENV: ${mergedConfig.env}`);
  logger.debug(`Effective Log Level: ${mergedConfig.logging.level}`);
  logger.debug(`CORS Origins: ${JSON.stringify(mergedConfig.cors.allowedOrigins)}`);
  logger.debug(`Rate Limit Window MS: ${mergedConfig.rateLimit.windowMs}`);
  logger.debug(`Rate Limit Max Requests: ${mergedConfig.rateLimit.maxRequests}`);
  logger.debug(`Database URI: ${mergedConfig.database.uri}`);
  logger.debug(`Database Options: ${JSON.stringify(mergedConfig.database.options)}`);
  logger.debug('=== CONFIG DEBUG END ===');
}

module.exports = mergedConfig;