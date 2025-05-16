# Implementation Guidelines

This document outlines the coding standards, best practices, and implementation guidelines to be followed during the development of the gaming matchmaking platform.

## 1. Coding Standards

### 1.1 JavaScript/Node.js Style Guide

#### 1.1.1 General Guidelines
- Use **2 spaces** for indentation
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and constructor functions
- Use **UPPER_CASE** for constants
- Maximum line length of 100 characters
- Always terminate statements with semicolons
- Use single quotes (`'`) for strings consistently

#### 1.1.2 File Organization
- One class/component per file
- Group related files in appropriate directories
- Use clear, descriptive file names
- Place index.js files in directories to export public interfaces

#### 1.1.3 Code Structure
- Organize imports in logical groups (built-in, external, internal)
- Define constants/configurations at the top
- Place helper functions before their usage
- Export at the end of the file

#### 1.1.4 Function Guidelines
- Prefer arrow functions for callbacks and anonymous functions
- Keep functions small and focused on a single responsibility
- Use descriptive function names that indicate their purpose
- Limit function parameters (max 3, use an options object for more)

#### 1.1.5 Comment Guidelines
- Use JSDoc-style comments for function documentation
- Comment on complex logic or non-obvious behavior
- Avoid obvious comments that duplicate code
- Use TODO, FIXME, and NOTE tags for future work

### 1.2 MongoDB/Mongoose Guidelines

#### 1.2.1 Schema Design
- Define schemas in separate files
- Use schema validation for data integrity
- Define indexes in the schema
- Use pre/post hooks for consistent data manipulation
- Implement virtuals for computed properties

#### 1.2.2 Query Optimization
- Always use lean() for read-only operations
- Use projection to limit returned fields
- Create indexes for frequently queried fields
- Avoid deep population chains
- Use aggregation for complex data transformations

#### 1.2.3 Data Management
- Implement proper data validation before saving
- Use transactions for multi-document operations
- Implement soft deletion where appropriate
- Set up proper TTL indexes for temporary data

### 1.3 API Design Guidelines

#### 1.3.1 URL Structure
- Use noun-based resource URLs (e.g., `/users`, not `/getUsers`)
- Use plural nouns for collection endpoints
- Use URL parameters for resource identification
- Use query parameters for filtering, sorting, and pagination

#### 1.3.2 HTTP Methods
- `GET`: Retrieve resources
- `POST`: Create new resources
- `PUT`: Replace resources completely
- `PATCH`: Update resources partially
- `DELETE`: Remove resources

#### 1.3.3 Status Codes
- 200: OK
- 201: Created
- 204: No Content
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 422: Unprocessable Entity
- 500: Internal Server Error

#### 1.3.4 Response Format
- Use consistent response structure
- Always include status (success/error)
- Return meaningful error messages
- Include pagination metadata when applicable

## 2. Development Practices

### 2.1 Version Control (Git)

#### 2.1.1 Branching Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/<name>`: New features
- `bugfix/<name>`: Bug fixes
- `hotfix/<name>`: Critical fixes for production

#### 2.1.2 Commit Guidelines
- Write clear, concise commit messages
- Use present tense in commit messages
- Reference issue numbers in commits
- Keep commits focused on a single change
- Use conventional commit prefixes (feat, fix, docs, etc.)

#### 2.1.3 Pull Request Process
- Create descriptive PR titles
- Fill out PR template with details
- Link related issues
- Request appropriate reviewers
- Ensure all checks pass before merging

### 2.2 Testing Strategy

#### 2.2.1 Unit Testing
- Test individual functions and methods
- Use mocks and stubs for dependencies
- Focus on edge cases and error handling
- Aim for high coverage of business logic

#### 2.2.2 Integration Testing
- Test interaction between components
- Test API endpoints with realistic data
- Use a test database
- Cover happy paths and common error cases

#### 2.2.3 End-to-End Testing
- Test complete user flows
- Simulate real user interactions
- Test across different environments
- Focus on critical business processes

#### 2.2.4 Test Organization
- Place tests adjacent to implementation files
- Name test files with `.test.js` or `.spec.js` suffixes
- Organize tests with describe/it blocks
- Use descriptive test names (should-style)

### 2.3 Documentation

#### 2.3.1 Code Documentation
- Document all public interfaces with JSDoc
- Include parameter types and return types
- Document exceptions and side effects
- Keep documentation up-to-date with code changes

#### 2.3.2 API Documentation
- Document all API endpoints
- Include request/response examples
- Document authentication requirements
- Document error responses

#### 2.3.3 Architecture Documentation
- Maintain high-level architecture diagrams
- Document module relationships
- Document deployment architecture
- Keep documentation in the repository

## 3. Error Handling

### 3.1 Error Classification

#### 3.1.1 Operational Errors
- Expected errors that occur during normal operation
- Examples: validation errors, authentication failures, not found
- Should be handled gracefully and return appropriate responses

#### 3.1.2 Programming Errors
- Bugs or unexpected errors
- Examples: undefined references, type errors
- Should be caught, logged, and fixed

#### 3.1.3 External Errors
- Errors from external services
- Examples: database errors, API failures
- Should be handled with retries or fallbacks where possible

### 3.2 Error Handling Strategy

#### 3.2.1 Custom Error Classes
```javascript
// src/utils/errors.js
class AppError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super('VALIDATION_ERROR', message, 400);
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message) {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message) {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super('NOT_FOUND', `${resource} with ID ${id} not found`, 404);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super('CONFLICT', message, 409);
  }
}

class ServerError extends AppError {
  constructor(message) {
    super('SERVER_ERROR', message || 'Internal server error', 500);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ServerError
};
```

#### 3.2.2 Error Middleware
```javascript
// src/middleware/errorHandler.js
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'SERVER_ERROR';
  let errorMessage = err.message || 'Internal server error';
  let errorDetails = err.details || {};
  
  // Log error
  if (statusCode >= 500) {
    logger.error(err.message, { 
      error: err,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: req.id
    });
  } else {
    logger.warn(err.message, {
      code: errorCode,
      path: req.path,
      method: req.method,
      requestId: req.id
    });
  }
  
  // Handle specific error types
  if (err.name === 'ValidationError' && err.errors) {
    // Mongoose validation error
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    errorMessage = 'Validation failed';
    errorDetails = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
  } else if (err.name === 'MongoError' && err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    errorCode = 'DUPLICATE_ERROR';
    errorMessage = 'Duplicate entry';
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    errorMessage = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    errorMessage = 'Token expired';
  }
  
  // Send error response
  res.status(statusCode).json({
    status: 'error',
    error: {
      code: errorCode,
      message: errorMessage,
      details: errorDetails
    }
  });
};
```

#### 3.2.3 Async Handler Wrapper
```javascript
// src/utils/asyncHandler.js
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
```

#### 3.2.4 Usage Example
```javascript
// src/modules/user/controllers/userController.js
const asyncHandler = require('../../../utils/asyncHandler');
const { NotFoundError } = require('../../../utils/errors');
const User = require('../models/User');

exports.getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User', userId);
  }
  
  res.json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        // other fields...
      }
    }
  });
});
```

### 3.3 Validation Strategy

#### 3.3.1 Request Validation
```javascript
// src/modules/user/validations/userValidation.js
const Joi = require('joi');
const { ValidationError } = require('../../../utils/errors');

const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  displayName: Joi.string().min(1).max(50).required()
});

exports.validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  
  if (error) {
    const details = error.details.reduce((acc, detail) => {
      acc[detail.path[0]] = detail.message;
      return acc;
    }, {});
    
    throw new ValidationError('Validation failed', details);
  }
  
  next();
};
```

#### 3.3.2 MongoDB Schema Validation
```javascript
// src/modules/user/models/User.js
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: props => `${props.value} is not a valid email address`
    }
  },
  // Other fields...
});
```

## 4. Security Practices

### 4.1 Authentication Security

#### 4.1.1 Password Handling
- Use bcrypt for password hashing
- Enforce strong password policies
- Implement proper password reset flows
- Never store plain text passwords

#### 4.1.2 JWT Security
- Use short expiration times
- Implement refresh token rotation
- Include only necessary payload data
- Use strong, secure keys

#### 4.1.3 Rate Limiting
```javascript
// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later'
    }
  }
});

exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});
```

### 4.2 Data Protection

#### 4.2.1 Input Sanitization
```javascript
// src/middleware/sanitizer.js
const sanitize = require('mongo-sanitize');

module.exports = (req, res, next) => {
  req.body = sanitize(req.body);
  req.params = sanitize(req.params);
  req.query = sanitize(req.query);
  next();
};
```

#### 4.2.2 XSS Prevention
```javascript
// src/app.js
const helmet = require('helmet');
app.use(helmet());
```

#### 4.2.3 CORS Configuration
```javascript
// src/app.js
const cors = require('cors');
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

### 4.3 Authorization Implementation

#### 4.3.1 Role-Based Access Control
```javascript
// src/middleware/auth.js
exports.authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to perform this action'
        }
      });
    }
    
    next();
  };
};
```

#### 4.3.2 Resource Ownership Check
```javascript
// src/utils/ownership.js
const { AuthorizationError } = require('./errors');

exports.checkOwnership = (resourceOwnerId, userId) => {
  if (resourceOwnerId.toString() !== userId.toString()) {
    throw new AuthorizationError('You do not have permission to modify this resource');
  }
};
```

## 5. Performance Optimization

### 5.1 Database Optimization

#### 5.1.1 Indexing Strategy
- Create indexes for frequently queried fields
- Use compound indexes for multi-field queries
- Add text indexes for search functionality
- Use TTL indexes for expiring data
- Monitor index usage and remove unused indexes

#### 5.1.2 Query Optimization
- Use projection to limit returned fields
- Limit results with pagination
- Use lean() for read-only queries
- Avoid deep nested populations
- Use aggregation for complex data transformations

#### 5.1.3 Connection Management
```javascript
// src/config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
      poolSize: 10, // Number of connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    logger.info('Connected to MongoDB');
    
    // Add connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (err) {
    logger.error('MongoDB connection error', err);
    process.exit(1);
  }
};
```

### 5.2 Caching Strategy

#### 5.2.1 In-Memory Caching
```javascript
// src/utils/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60 // Check for expired keys every 60 seconds
});

exports.get = (key) => {
  return cache.get(key);
};

exports.set = (key, value, ttl = 300) => {
  return cache.set(key, value, ttl);
};

exports.del = (key) => {
  return cache.del(key);
};

exports.flush = () => {
  return cache.flushAll();
};
```

#### 5.2.2 Cache Middleware
```javascript
// src/middleware/cache.js
const cache = require('../utils/cache');

exports.cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip caching for authenticated requests that are user-specific
    if (req.user) {
      return next();
    }
    
    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Store the original res.json method
    const originalJson = res.json;
    
    // Override res.json method
    res.json = function(body) {
      // Save the response in cache
      cache.set(key, body, duration);
      
      // Call the original method
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Cache invalidation middleware
exports.clearCache = (pattern) => {
  // Implementation to clear cache based on pattern
};
```

### 5.3 Response Optimization

#### 5.3.1 Compression
```javascript
// src/app.js
const compression = require('compression');
app.use(compression());
```

#### 5.3.2 Pagination
```javascript
// src/utils/pagination.js
exports.paginate = async (model, query, options) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 20;
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };
  
  const [results, total] = await Promise.all([
    model.find(query).sort(sort).skip(skip).limit(limit),
    model.countDocuments(query)
  ]);
  
  return {
    results,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
};
```

## 6. Logging and Monitoring

### 6.1 Logging Strategy

#### 6.1.1 Logger Configuration
```javascript
// src/utils/logger.js
const winston = require('winston');
const { format, transports } = winston;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'gamematch-api' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with level 'info' and below to combined.log
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    )
  }));
}

module.exports = logger;
```

#### 6.1.2 Request Logging Middleware
```javascript
// src/middleware/requestLogger.js
const morgan = require('morgan');
const logger = require('../utils/logger');

// Create a custom Morgan format
morgan.token('id', req => req.id);
morgan.token('body', req => JSON.stringify(req.body));

const requestFormat = ':id :method :url :status :response-time ms - :res[content-length] :body';

// Create request ID middleware
const requestId = (req, res, next) => {
  req.id = require('crypto').randomBytes(16).toString('hex');
  next();
};

// Create Morgan stream that writes to Winston
const stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

module.exports = [
  requestId,
  morgan(requestFormat, { stream })
];
```

### 6.2 Error Monitoring

#### 6.2.1 Uncaught Exception Handling
```javascript
// src/app.js
const logger = require('./utils/logger');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err,
    stack: err.stack
  });
  
  // Perform graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise
  });
});
```

#### 6.2.2 Health Check Endpoint
```javascript
// src/routes/health.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');

router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  const health = {
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    hostname: os.hostname(),
    database: {
      status: dbStatus
    },
    memory: {
      free: os.freemem(),
      total: os.totalmem()
    },
    cpu: os.loadavg()
  };
  
  res.json({
    status: 'success',
    data: health
  });
});

module.exports = router;
```

### 6.3 Metrics Collection

#### 6.3.1 Basic Metrics Middleware
```javascript
// src/middleware/metrics.js
const metrics = {
  requestCount: 0,
  errorCount: 0,
  requestDurations: {},
  
  recordRequest() {
    this.requestCount += 1;
  },
  
  recordError() {
    this.errorCount += 1;
  },
  
  recordDuration(route, duration) {
    if (!this.requestDurations[route]) {
      this.requestDurations[route] = [];
    }
    
    this.requestDurations[route].push(duration);
    
    // Keep only the last 100 measurements
    if (this.requestDurations[route].length > 100) {
      this.requestDurations[route].shift();
    }
  },
  
  getStats() {
    const routeStats = {};
    
    for (const [route, durations] of Object.entries(this.requestDurations)) {
      const total = durations.reduce((sum, duration) => sum + duration, 0);
      const avg = total / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      
      routeStats[route] = {
        count: durations.length,
        avg,
        max,
        min
      };
    }
    
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      routes: routeStats
    };
  },
  
  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.requestDurations = {};
  }
};

exports.metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  metrics.recordRequest();
  
  // Add listener for response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = `${req.method} ${req.route ? req.route.path : req.path}`;
    
    metrics.recordDuration(route, duration);
    
    if (res.statusCode >= 400) {
      metrics.recordError();
    }
  });
  
  next();
};

exports.getMetrics = (req, res) => {
  res.json({
    status: 'success',
    data: metrics.getStats()
  });
};
```

#### 6.3.2 Metrics Route
```javascript
// src/routes/metrics.js
const express = require('express');
const router = express.Router();
const { getMetrics } = require('../middleware/metrics');
const { authenticate, authorize } = require('../middleware/auth');

// Secure metrics endpoint for admin only
router.get('/', authenticate, authorize(['admin']), getMetrics);

module.exports = router;
```

## 7. Deployment and Operations

### 7.1 Environment Configuration

#### 7.1.1 Environment Variables
```javascript
// src/config/index.js
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gamematch',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@gamematch.com'
  },
  igdb: {
    clientId: process.env.IGDB_CLIENT_ID,
    clientSecret: process.env.IGDB_CLIENT_SECRET,
    accessToken: process.env.IGDB_ACCESS_TOKEN
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || 'logs'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  }
};
```

#### 7.1.2 Environment-Specific Configurations
```javascript
// src/config/environments/development.js
module.exports = {
  // Development-specific overrides
};

// src/config/environments/production.js
module.exports = {
  // Production-specific overrides
};

// src/config/environments/test.js
module.exports = {
  // Test-specific overrides
};
```

### 7.2 Docker Configuration

#### 7.2.1 Dockerfile
```dockerfile
# Use Node 16 as the base image
FROM node:16-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]
```

#### 7.2.2 Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/gamematch
      - JWT_SECRET=your_jwt_secret
      - JWT_REFRESH_SECRET=your_refresh_secret
    depends_on:
      - mongo
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  mongo:
    image: mongo:4.4
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

### 7.3 CI/CD Configuration

#### 7.3.1 GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: Node.js CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:4.4
        ports:
          - 27017:27017

    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint code
      run: npm run lint
    
    - name: Run tests
      run: npm test
      env:
        MONGODB_URI: mongodb://localhost:27017/gamematch_test
        JWT_SECRET: test_jwt_secret
        JWT_REFRESH_SECRET: test_refresh_secret
    
    - name: Build
      run: npm run build --if-present

  deploy:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    # Add deployment steps for your specific hosting environment
    # This could be AWS, Azure, Heroku, Digital Ocean, etc.
```

### 7.4 Backup and Disaster Recovery

#### 7.4.1 MongoDB Backup Script
```javascript
// scripts/backup.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

// Create backup directory if it doesn't exist
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Generate timestamp for backup file
const timestamp = new Date().toISOString().replace(/:/g, '-');
const backupPath = path.join(backupDir, `backup-${timestamp}`);

// Get database name from connection string
const dbName = config.mongodb.uri.split('/').pop().split('?')[0];

// Build mongodump command
const command = `mongodump --uri="${config.mongodb.uri}" --out="${backupPath}"`;

console.log(`Starting backup of ${dbName} to ${backupPath}`);

// Execute mongodump
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Backup failed: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Backup stderr: ${stderr}`);
  }
  
  console.log(`Backup completed successfully: ${backupPath}`);
  
  // Cleanup old backups (keep last 7 days)
  const keepDays = 7;
  fs.readdir(backupDir, (err, files) => {
    if (err) {
      console.error(`Failed to read backup directory: ${err.message}`);
      return;
    }
    
    const now = new Date();
    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(stats.mtime);
      const daysDiff = (now - fileDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > keepDays) {
        console.log(`Removing old backup: ${filePath}`);
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    });
  });
});
```

#### 7.4.2 Restore Script
```javascript
// scripts/restore.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const readline = require('readline');

// Get backup directory
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  console.error('Backup directory does not exist');
  process.exit(1);
}

// List available backups
const backups = fs.readdirSync(backupDir)
  .filter(file => fs.statSync(path.join(backupDir, file)).isDirectory())
  .sort()
  .reverse();

if (backups.length === 0) {
  console.error('No backups found');
  process.exit(1);
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Display available backups
console.log('Available backups:');
backups.forEach((backup, index) => {
  console.log(`${index + 1}. ${backup}`);
});

// Prompt for backup selection
rl.question('Select a backup to restore (number): ', (answer) => {
  const index = parseInt(answer, 10) - 1;
  
  if (isNaN(index) || index < 0 || index >= backups.length) {
    console.error('Invalid selection');
    rl.close();
    process.exit(1);
  }
  
  const selectedBackup = backups[index];
  const backupPath = path.join(backupDir, selectedBackup);
  
  // Get database name
  const dbName = config.mongodb.uri.split('/').pop().split('?')[0];
  
  // Confirmation prompt
  rl.question(`Are you sure you want to restore ${dbName} from ${selectedBackup}? (yes/no): `, (confirm) => {
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Restore canceled');
      rl.close();
      return;
    }
    
    // Build mongorestore command
    const command = `mongorestore --uri="${config.mongodb.uri}" --drop "${backupPath}"`;
    
    console.log(`Starting restore of ${dbName} from ${backupPath}`);
    
    // Execute mongorestore
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Restore failed: ${error.message}`);
        rl.close();
        return;
      }
      
      if (stderr) {
        console.error(`Restore stderr: ${stderr}`);
      }
      
      console.log(`Restore completed successfully`);
      rl.close();
    });
  });
});
```
