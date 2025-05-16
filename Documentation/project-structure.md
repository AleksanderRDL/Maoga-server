# Project Structure and Codebase Organization

This document outlines the project structure for the gaming matchmaking platform, providing detailed information on the file and directory organization, code organization patterns, and module relationships.

## 1. Project Root Structure

```
/
├── .github/                    # GitHub configuration
│   └── workflows/              # GitHub Actions workflows
├── .vscode/                    # VS Code configuration (optional)
├── config/                     # Configuration files
├── coverage/                   # Test coverage reports
├── dist/                       # Compiled code (for production)
├── docs/                       # Documentation
├── logs/                       # Application logs
├── node_modules/               # Dependencies (not committed)
├── scripts/                    # Utility scripts
├── src/                        # Source code
├── test/                       # Test files
├── .dockerignore               # Docker ignore file
├── .env.example                # Example environment variables
├── .eslintrc.js                # ESLint configuration
├── .gitignore                  # Git ignore file
├── .nycrc                      # Test coverage configuration
├── .prettierrc                 # Prettier configuration
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Docker configuration
├── jest.config.js              # Jest configuration
├── package.json                # Package configuration
├── package-lock.json           # Package lock file
└── README.md                   # Project README
```

## 2. Source Code Structure

```
/src
├── app.js                      # Express application setup
├── server.js                   # Server entry point
├── config/                     # Configuration files
│   ├── index.js                # Main configuration exports
│   ├── database.js             # Database configuration
│   ├── redis.js                # Redis configuration
│   ├── socket.js               # Socket.IO configuration
│   └── environments/           # Environment-specific configs
│       ├── development.js
│       ├── production.js
│       └── test.js
├── middleware/                 # Shared middleware
│   ├── auth.js                 # Authentication middleware
│   ├── errorHandler.js         # Error handling middleware
│   ├── rateLimiter.js          # Rate limiting middleware
│   ├── requestLogger.js        # Request logging middleware
│   └── validator.js            # Request validation middleware
├── modules/                    # Application modules
│   ├── user/                   # User module
│   ├── auth/                   # Authentication module
│   ├── game/                   # Game module
│   ├── matchmaking/            # Matchmaking module
│   ├── lobby/                  # Lobby module
│   ├── chat/                   # Chat module
│   ├── notification/           # Notification module
│   ├── admin/                  # Admin module
│   └── shop/                   # Shop module (future)
├── services/                   # Shared services
│   ├── socket/                 # Socket.IO services
│   ├── event/                  # Event handling services
│   ├── cache/                  # Caching services
│   ├── notification/           # Notification services
│   └── storage/                # File storage services
└── utils/                      # Utility functions
    ├── errors.js               # Custom error classes
    ├── asyncHandler.js         # Async handler wrapper
    ├── logger.js               # Logging utility
    ├── pagination.js           # Pagination utility
    └── validation.js           # Validation utility
```

## 3. Module Structure

Each module follows a consistent structure:

```
/src/modules/[module-name]
├── controllers/                # Request handlers
│   ├── [resource]Controller.js # Controller for specific resource
│   └── index.js                # Export all controllers
├── models/                     # Database models
│   ├── [Model].js              # Mongoose model definition
│   └── index.js                # Export all models
├── routes/                     # Route definitions
│   ├── [resource]Routes.js     # Routes for specific resource
│   └── index.js                # Export all routes
├── services/                   # Business logic
│   ├── [resource]Service.js    # Service for specific resource
│   └── index.js                # Export all services
├── validations/                # Input validation schemas
│   ├── [resource]Validation.js # Validation for specific resource
│   └── index.js                # Export all validations
└── index.js                    # Module entry point
```

## 4. Detailed Module Breakdowns

### 4.1 User Module

```
/src/modules/user
├── controllers/
│   ├── userController.js       # User profile operations
│   ├── friendController.js     # Friend operations
│   └── index.js
├── models/
│   ├── User.js                 # User model
│   ├── Friendship.js           # Friendship model
│   └── index.js
├── routes/
│   ├── userRoutes.js           # User profile routes
│   ├── friendRoutes.js         # Friend routes
│   └── index.js
├── services/
│   ├── userService.js          # User business logic
│   ├── friendService.js        # Friend business logic
│   ├── profileService.js       # Profile customization logic
│   └── index.js
├── validations/
│   ├── userValidation.js       # User input validation
│   ├── friendValidation.js     # Friend input validation
│   └── index.js
└── index.js
```

### 4.2 Auth Module

```
/src/modules/auth
├── controllers/
│   ├── authController.js       # Authentication operations
│   └── index.js
├── models/
│   ├── RefreshToken.js         # Refresh token model
│   ├── PasswordReset.js        # Password reset model
│   └── index.js
├── routes/
│   ├── authRoutes.js           # Authentication routes
│   └── index.js
├── services/
│   ├── authService.js          # Authentication business logic
│   ├── tokenService.js         # Token management logic
│   ├── emailService.js         # Email notifications
│   └── index.js
├── validations/
│   ├── authValidation.js       # Authentication input validation
│   └── index.js
└── index.js
```

### 4.3 Game Module

```
/src/modules/game
├── controllers/
│   ├── gameController.js       # Game operations
│   ├── gameSyncController.js   # External API sync operations
│   └── index.js
├── models/
│   ├── Game.js                 # Game model
│   └── index.js
├── routes/
│   ├── gameRoutes.js           # Game routes
│   ├── adminGameRoutes.js      # Admin game routes
│   └── index.js
├── services/
│   ├── gameService.js          # Game business logic
│   ├── gameApiService.js       # External API integration
│   ├── gameSyncService.js      # Game data synchronization
│   ├── cacheService.js         # Game caching logic
│   └── index.js
├── validations/
│   ├── gameValidation.js       # Game input validation
│   └── index.js
└── index.js
```

### 4.4 Matchmaking Module

```
/src/modules/matchmaking
├── controllers/
│   ├── matchmakingController.js        # Matchmaking operations
│   ├── matchHistoryController.js       # Match history operations
│   └── index.js
├── models/
│   ├── MatchRequest.js                 # Match request model
│   ├── MatchHistory.js                 # Match history model
│   └── index.js
├── routes/
│   ├── matchmakingRoutes.js            # Matchmaking routes
│   ├── matchHistoryRoutes.js           # Match history routes
│   └── index.js
├── services/
│   ├── matchmakingService.js           # Matchmaking business logic
│   ├── matchQueueService.js            # Queue management logic
│   ├── matchAlgorithmService.js        # Matching algorithm
│   ├── matchHistoryService.js          # Match history logic
│   └── index.js
├── validations/
│   ├── matchmakingValidation.js        # Matchmaking input validation
│   └── index.js
└── index.js
```

### 4.5 Lobby Module

```
/src/modules/lobby
├── controllers/
│   ├── lobbyController.js              # Lobby operations
│   ├── lobbyMemberController.js        # Lobby member operations
│   └── index.js
├── models/
│   ├── Lobby.js                        # Lobby model
│   └── index.js
├── routes/
│   ├── lobbyRoutes.js                  # Lobby routes
│   └── index.js
├── services/
│   ├── lobbyService.js                 # Lobby business logic
│   ├── lobbyMemberService.js           # Lobby member logic
│   ├── lobbyStatusService.js           # Lobby state management
│   └── index.js
├── validations/
│   ├── lobbyValidation.js              # Lobby input validation
│   └── index.js
└── index.js
```

### 4.6 Chat Module

```
/src/modules/chat
├── controllers/
│   ├── chatController.js               # Chat operations
│   ├── messageController.js            # Message operations
│   └── index.js
├── models/
│   ├── Chat.js                         # Chat model
│   ├── Message.js                      # Message model
│   └── index.js
├── routes/
│   ├── chatRoutes.js                   # Chat routes
│   └── index.js
├── services/
│   ├── chatService.js                  # Chat business logic
│   ├── messageService.js               # Message business logic
│   ├── chatRoomService.js              # Chat room management
│   └── index.js
├── validations/
│   ├── chatValidation.js               # Chat input validation
│   ├── messageValidation.js            # Message input validation
│   └── index.js
└── index.js
```

### 4.7 Notification Module

```
/src/modules/notification
├── controllers/
│   ├── notificationController.js       # Notification operations
│   └── index.js
├── models/
│   ├── Notification.js                 # Notification model
│   └── index.js
├── routes/
│   ├── notificationRoutes.js           # Notification routes
│   └── index.js
├── services/
│   ├── notificationService.js          # Notification business logic
│   ├── pushNotificationService.js      # Push notification logic
│   ├── emailNotificationService.js     # Email notification logic
│   └── index.js
├── validations/
│   ├── notificationValidation.js       # Notification input validation
│   └── index.js
└── index.js
```

### 4.8 Admin Module

```
/src/modules/admin
├── controllers/
│   ├── adminUserController.js          # Admin user operations
│   ├── adminReportController.js        # Admin report operations
│   ├── adminStatsController.js         # Admin stats operations
│   └── index.js
├── models/
│   ├── Report.js                       # Report model
│   ├── AdminAction.js                  # Admin action model
│   └── index.js
├── routes/
│   ├── adminUserRoutes.js              # Admin user routes
│   ├── adminReportRoutes.js            # Admin report routes
│   ├── adminStatsRoutes.js             # Admin stats routes
│   └── index.js
├── services/
│   ├── adminUserService.js             # Admin user business logic
│   ├── adminReportService.js           # Admin report business logic
│   ├── adminStatsService.js            # Admin stats business logic
│   └── index.js
├── validations/
│   ├── adminValidation.js              # Admin input validation
│   └── index.js
└── index.js
```

## 5. Services Structure

### 5.1 Socket Service

```
/src/services/socket
├── socketManager.js                    # Socket.IO manager
├── handlers/                           # Event handlers
│   ├── chatHandler.js                  # Chat event handlers
│   ├── lobbyHandler.js                 # Lobby event handlers
│   ├── matchmakingHandler.js           # Matchmaking event handlers
│   └── index.js
└── index.js                            # Export socket service
```

### 5.2 Event Service

```
/src/services/event
├── eventEmitter.js                     # Event emitter
├── handlers/                           # Event handlers
│   ├── userEventHandlers.js            # User event handlers
│   ├── friendshipEventHandlers.js      # Friendship event handlers
│   ├── matchmakingEventHandlers.js     # Matchmaking event handlers
│   ├── lobbyEventHandlers.js           # Lobby event handlers
│   ├── chatEventHandlers.js            # Chat event handlers
│   └── index.js
└── index.js                            # Export event service
```

### 5.3 Cache Service

```
/src/services/cache
├── cacheManager.js                     # Cache manager
├── strategies/                         # Caching strategies
│   ├── memoryCache.js                  # In-memory cache
│   ├── redisCache.js                   # Redis cache
│   └── index.js
└── index.js                            # Export cache service
```

## 6. Test Structure

```
/test
├── unit/                               # Unit tests
│   ├── modules/                        # Module unit tests
│   │   ├── user/                       # User module tests
│   │   ├── auth/                       # Auth module tests
│   │   └── ...                         # Other module tests
│   ├── services/                       # Service unit tests
│   └── utils/                          # Utility unit tests
├── integration/                        # Integration tests
│   ├── api/                            # API integration tests
│   │   ├── user.test.js                # User API tests
│   │   ├── auth.test.js                # Auth API tests
│   │   └── ...                         # Other API tests
│   └── services/                       # Service integration tests
├── socket/                             # Socket.IO tests
│   ├── chat.test.js                    # Chat socket tests
│   ├── lobby.test.js                   # Lobby socket tests
│   └── matchmaking.test.js             # Matchmaking socket tests
├── security/                           # Security tests
│   ├── authentication.test.js          # Authentication security tests
│   ├── authorization.test.js           # Authorization security tests
│   └── input-validation.test.js        # Input validation tests
├── performance/                        # Performance tests
│   ├── artillery/                      # Artillery load tests
│   └── benchmark/                      # Benchmarking tests
├── fixtures/                           # Test fixtures
│   ├── users.js                        # User fixtures
│   ├── games.js                        # Game fixtures
│   └── ...                             # Other fixtures
└── utils/                              # Test utilities
    ├── testHelpers.js                  # Common test helpers
    ├── socketClient.js                 # Socket.IO client helper
    └── setupTestEnv.js                 # Test environment setup
```

## 7. Configuration Structure

### 7.1 Main Configuration

```javascript
// src/config/index.js
require('dotenv').config();

// Import environment-specific configurations
const env = process.env.NODE_ENV || 'development';
const envConfig = require(`./environments/${env}`);

// Base configuration
const config = {
  env,
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gamematch',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || ''
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  },
  igdb: {
    clientId: process.env.IGDB_CLIENT_ID,
    clientSecret: process.env.IGDB_CLIENT_SECRET
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || 'logs'
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    from: process.env.EMAIL_FROM || 'noreply@gamematch.com'
  }
};

// Merge with environment-specific configuration
module.exports = { ...config, ...envConfig };
```

### 7.2 Environment Configurations

```javascript
// src/config/environments/development.js
module.exports = {
  // Development-specific overrides
  logging: {
    level: 'debug'
  }
};

// src/config/environments/production.js
module.exports = {
  // Production-specific overrides
  logging: {
    level: 'info'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://app.gamematch.com'
  }
};

// src/config/environments/test.js
module.exports = {
  // Test-specific overrides
  mongodb: {
    uri: process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/gamematch_test'
  },
  logging: {
    level: 'error'
  }
};
```

## 8. Module Relationships and Dependencies

### 8.1 Module Dependencies Diagram

```
+-------------+     +-----------------+     +----------------+
| Auth Module | <-- | User Module     | --> | Friend Module  |
+-------------+     +-----------------+     +----------------+
       ^                   ^                        ^
       |                   |                        |
+-------------+     +-----------------+     +----------------+
| Game Module |     | Matchmaking     | --> | Lobby Module   |
+-------------+     | Module          |     +----------------+
       ^            +-----------------+            ^
       |                   ^                       |
       |                   |                       v
+-------------+     +-----------------+     +----------------+
| Admin Module|     | Notification    | <-- | Chat Module    |
+-------------+     | Module          |     +----------------+
                    +-----------------+
```

### 8.2 Critical Module Interactions

1. **User & Auth Modules**:
   - Auth module depends on User module for user data
   - User registration and login flow crosses these modules

2. **User & Friend Modules**:
   - Friend module depends on User module for user data
   - Friend requests and management involve both modules

3. **Matchmaking & Lobby Modules**:
   - Successful matches create lobbies
   - Lobby module depends on matchmaking results

4. **Lobby & Chat Modules**:
   - Each lobby has an associated chat
   - Chat module depends on lobby data for access control

5. **Notification & Multiple Modules**:
   - Many modules trigger notifications
   - Friend requests, matchmaking, lobby invites all create notifications

## 9. Application Entry Points

### 9.1 Server Entry Point

```javascript
// src/server.js
const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const socketManager = require('./services/socket');
const { connectDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Connected to MongoDB');
    
    // Initialize Redis (if configured)
    if (config.redis.url) {
      await initRedis();
      logger.info('Connected to Redis');
    }
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    socketManager.initialize(server);
    logger.info('Socket.IO initialized');
    
    // Start server
    server.listen(config.port, () => {
      logger.info(`Server running in ${config.env} mode on port ${config.port}`);
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      // Close server
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Close database connection
      await mongoose.connection.close();
      logger.info('Database connection closed');
      
      // Exit process
      process.exit(0);
    };
    
    // Handle termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

### 9.2 Express Application Setup

```javascript
// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import route modules
const authRoutes = require('./modules/auth/routes');
const userRoutes = require('./modules/user/routes');
const gameRoutes = require('./modules/game/routes');
const matchmakingRoutes = require('./modules/matchmaking/routes');
const lobbyRoutes = require('./modules/lobby/routes');
const chatRoutes = require('./modules/chat/routes');
const notificationRoutes = require('./modules/notification/routes');
const adminRoutes = require('./modules/admin/routes');

// Create Express app
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging middleware
if (config.env !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: message => logger.http(message.trim()) }
    })
  );
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      service: 'gamematch-api',
      version: require('../package.json').version,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
```

## 10. File Naming Conventions

### 10.1 General Naming Conventions

- **Files**: Use `camelCase` for files (e.g., `userService.js`)
- **Directories**: Use `kebab-case` for directories (e.g., `user-service`)
- **Classes**: Use `PascalCase` for classes (e.g., `UserService`)
- **Constants**: Use `UPPER_SNAKE_CASE` for constants (e.g., `MAX_USERS`)
- **Variables/Functions**: Use `camelCase` for variables and functions (e.g., `getUserById`)

### 10.2 Specific File Naming Patterns

- **Controllers**: `[resource]Controller.js` (e.g., `userController.js`)
- **Models**: `[Model].js` (e.g., `User.js`)
- **Routes**: `[resource]Routes.js` (e.g., `userRoutes.js`)
- **Services**: `[resource]Service.js` (e.g., `userService.js`)
- **Validations**: `[resource]Validation.js` (e.g., `userValidation.js`)
- **Tests**: `[filename].test.js` (e.g., `userService.test.js`)

## 11. Import/Export Patterns

### 11.1 Named Exports Pattern

```javascript
// src/modules/user/services/userService.js
async function getUserById(userId) {
  // Implementation
}

async function createUser(userData) {
  // Implementation
}

async function updateUser(userId, userData) {
  // Implementation
}

async function deleteUser(userId) {
  // Implementation
}

module.exports = {
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
```

### 11.2 Index File Pattern

```javascript
// src/modules/user/services/index.js
const userService = require('./userService');
const friendService = require('./friendService');
const profileService = require('./profileService');

module.exports = {
  ...userService,
  ...friendService,
  ...profileService
};
```

### 11.3 Module Exports Pattern

```javascript
// src/modules/user/index.js
const routes = require('./routes');
const controllers = require('./controllers');
const services = require('./services');
const models = require('./models');

module.exports = {
  routes,
  controllers,
  services,
  models,
  // Initialize function to register routes
  initialize: (app) => {
    app.use('/api/users', routes);
  }
};
```

## 12. Code Organization Best Practices

### 12.1 Separation of Concerns

1. **Routes**: Handle URL routing and parameter parsing
2. **Controllers**: Handle HTTP request/response
3. **Services**: Contain business logic
4. **Models**: Define data structure and database operations
5. **Validations**: Handle input validation

### 12.2 Dependency Injection

Use dependency injection to make code more testable:

```javascript
// src/modules/user/services/userService.js
class UserService {
  constructor(userModel, cacheService) {
    this.userModel = userModel;
    this.cacheService = cacheService;
  }
  
  async getUserById(userId) {
    // Check cache first
    const cachedUser = await this.cacheService.get(`user:${userId}`);
    if (cachedUser) return cachedUser;
    
    // Get from database
    const user = await this.userModel.findById(userId);
    
    // Cache for future requests
    if (user) {
      await this.cacheService.set(`user:${userId}`, user, 300); // 5 minutes
    }
    
    return user;
  }
  
  // Other methods...
}

// Dependency injection in module index
const User = require('../models/User');
const cacheService = require('../../../services/cache');
const userService = new UserService(User, cacheService);

module.exports = userService;
```

### 12.3 Error Handling

Centralize error handling:

```javascript
// src/utils/asyncHandler.js
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage in controllers
const asyncHandler = require('../../../utils/asyncHandler');

exports.getUser = asyncHandler(async (req, res) => {
  // Implementation that can throw errors
  // No try/catch needed here, errors are caught by asyncHandler
});
```

### 12.4 Custom Error Classes

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

class NotFoundError extends AppError {
  constructor(resource, id) {
    super('NOT_FOUND', `${resource} with ID ${id} not found`, 404);
  }
}

// Export other error classes...

module.exports = {
  AppError,
  NotFoundError,
  // Other error classes...
};
```

## 13. Environment Variables

### 13.1 Required Environment Variables

```
# .env.example

# Application
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/gamematch

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# CORS
CORS_ORIGIN=*

# IGDB API
IGDB_CLIENT_ID=your_igdb_client_id
IGDB_CLIENT_SECRET=your_igdb_client_secret

# Logging
LOG_LEVEL=info
LOG_DIRECTORY=logs

# Email
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email_user
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@gamematch.com
```

### 13.2 Environment-specific Variables

```
# .env.development
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/gamematch_dev
LOG_LEVEL=debug

# .env.test
NODE_ENV=test
PORT=3001
MONGODB_URI=mongodb://localhost:27017/gamematch_test
LOG_LEVEL=error

# .env.production
NODE_ENV=production
PORT=80
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/gamematch
LOG_LEVEL=info
CORS_ORIGIN=https://app.gamematch.com
```

## 14. Module Registration System

### 14.1 Module Registration

```javascript
// src/moduleRegistry.js
class ModuleRegistry {
  constructor() {
    this.modules = new Map();
  }
  
  register(name, module) {
    this.modules.set(name, module);
    return this;
  }
  
  get(name) {
    return this.modules.get(name);
  }
  
  getAll() {
    return Array.from(this.modules.values());
  }
  
  initialize(app) {
    // Initialize all modules
    this.getAll().forEach(module => {
      if (typeof module.initialize === 'function') {
        module.initialize(app);
      }
    });
  }
}

const registry = new ModuleRegistry();

// Register modules
registry
  .register('auth', require('./modules/auth'))
  .register('user', require('./modules/user'))
  .register('game', require('./modules/game'))
  .register('matchmaking', require('./modules/matchmaking'))
  .register('lobby', require('./modules/lobby'))
  .register('chat', require('./modules/chat'))
  .register('notification', require('./modules/notification'))
  .register('admin', require('./modules/admin'));

module.exports = registry;
```

### 14.2 Module Initialization

```javascript
// src/app.js
const express = require('express');
const moduleRegistry = require('./moduleRegistry');
// Import other middleware...

const app = express();

// Apply middleware...

// Initialize all modules
moduleRegistry.initialize(app);

// Error handling middleware...

module.exports = app;
```
