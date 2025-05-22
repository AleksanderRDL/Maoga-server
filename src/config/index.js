const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Load environment-specific config
const env = process.env.NODE_ENV || 'development';
const envConfig = require(`./environments/${env}`);

// Base configuration
const baseConfig = {
    env,
    port: parseInt(process.env.PORT, 10) || 3000,

    // Database
    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/maoga_dev',
        options: {
            maxPoolSize: 10,
            minPoolSize: 5,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
            family: 4
        }
    },

    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
        issuer: 'maoga-backend',
        audience: 'maoga-app'
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    },

    // CORS
    cors: {
        allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
            ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
            : ['http://localhost:3000', 'http://localhost:8080']
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
    },

    // External APIs (for future use)
    external: {
        gameApi: {
            key: process.env.EXTERNAL_GAME_API_KEY,
            url: process.env.EXTERNAL_GAME_API_URL
        }
    }
};

// Merge with environment-specific config
const config = { ...baseConfig, ...envConfig };

// Validate required configuration
const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'MONGODB_URI'
];

if (env === 'production') {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

// Freeze config to prevent accidental modifications
module.exports = Object.freeze(config);