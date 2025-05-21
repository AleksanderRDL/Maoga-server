# Project Structure and Codebase Organization

This document outlines the project structure for the backend server, providing detailed information on the file and directory organization, code organization patterns, and module relationships.

## 1. Project Root Structure
```
/
├── .github/                    # GitHub configuration
│   └── workflows/              # GitHub Actions workflows
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
- Thoughts/Considerations regarding Main Configuration
### 7.2 Environment Configurations
- Thoughts/Considerations regarding Environment Configurations

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
- Thoughts/Considerations regarding Server Entry Point
### 9.2 Express Application Setup
- Thoughts/Considerations regarding Express Application Setup

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
- Thoughts/Considerations regarding Dependency Injection

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
- Thoughts/Considerations regarding Custom Error Classes

## 13. Environment Variables
### 13.1 Required Environment Variables
- Thoughts/Considerations regarding Required Environment Variables

### 13.2 Environment-specific Variables
- Thoughts/Considerations regarding Environment-specific Variables

## 14. Module Registration System
### 14.1 Module Registration
- Thoughts/Considerations regarding Module Registration

### 14.2 Module Initialization
- Thoughts/Considerations regarding Module Initialization
