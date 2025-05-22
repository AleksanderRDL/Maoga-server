// src/config/index.js - COMPLETE REPLACEMENT
require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,

    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/maoga_dev',
        options: {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-key-12345-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-67890-change-in-production',
        accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
        issuer: 'maoga-backend',
        audience: 'maoga-app'
    },

    logging: {
        level: process.env.LOG_LEVEL || 'debug'
    },

    cors: {
        allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ||
            ['http://localhost:3000', 'http://localhost:8080']
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
        maxRequests: process.env.NODE_ENV === 'test'
            ? 1000
            : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100)

    }
};

// Debug output
console.log('=== CONFIG DEBUG ===');
console.log('MONGODB_URI from env:', process.env.MONGODB_URI);
console.log('Final config.database.uri:', config.database.uri);
console.log('==================');

module.exports = config;