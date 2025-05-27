const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const config = require('./config');
const { requestLogger } = require('./middleware/requestLogger');
const { globalErrorHandler } = require('./middleware/errorHandler');
const { NotFoundError } = require('./utils/errors');

// Module imports
const authModule = require('./modules/auth');
const userModule = require('./modules/user');

// Create Express app
const app = express();

// Trust proxy - important for rate limiting and logging when behind a load balancer
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = config.cors.allowedOrigins;
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '0.1.0'
    }
  });
});

// API routes
app.use('/api', authModule.routes);
app.use('/api/users', userModule.routes);

// Future module routes will be added here:
// app.use('/api/users', userModule.routes);
// app.use('/api/games', gameModule.routes);
// app.use('/api/matchmaking', matchmakingModule.routes);
// app.use('/api/lobbies', lobbyModule.routes);
// app.use('/api/chat', chatModule.routes);
// app.use('/api/notifications', notificationModule.routes);

// 404 handler - must be after all routes
app.all('*', (req, res, next) => {
  next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
});

// Global error handler - must be last middleware
app.use(globalErrorHandler);

module.exports = app;
