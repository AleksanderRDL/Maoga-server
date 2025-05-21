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
**Thoughts/Considerations regarding Main Configuration**:
* **Location**: `src/config/index.js` is a good central place.
* **Purpose**: To consolidate all application configurations, load environment-specific settings, and provide a single point of access for configuration values throughout the application.
* **Loading Strategy**:
1.  Load default configurations (e.g., from `src/config/default.js` or directly in `index.js`).
2.  Load environment-specific configurations based on `NODE_ENV` (e.g., from `src/config/environments/development.js` or `production.js`). These should override defaults.
3.  Load environment variables from `process.env` (potentially using `dotenv` for local development). These should override file-based configurations, especially for secrets.
* **Validation**: Optionally, validate that all required configurations are present and have sensible values at startup. If a critical config is missing (e.g., `MONGODB_URI` in production), fail fast.
* **Structure**: Organize the exported config object logically (e.g., `config.database.uri`, `config.jwt.secret`, `config.server.port`).
* **Immutability**: Consider making the exported config object immutable (e.g., using `Object.freeze`) to prevent accidental modifications at runtime. (Not critical, but a good practice)
* **Maoga Context**: The existing plan for `src/config/` with environment-specific files and a main `index.js` is solid. Ensure it prioritizes environment variables for secrets and critical settings.
### 7.2 Environment Configurations
**Thoughts/Considerations regarding Environment Configurations**:
* **Location**: `src/config/environments/` (e.g., `development.js`, `production.js`, `test.js`).
* **Purpose**: To store configuration values that differ between environments and are not secrets (secrets should come from `process.env` or a secure store).
* **What to Include**:
* `development.js`: Settings for local development (e.g., relaxed logging, specific ports if they differ, flags to enable debug features).
* `test.js`: Settings for automated testing (e.g., in-memory database connection string if used, disabled external API calls via mocks, specific test user credentials if needed).
* `production.js` / `staging.js`: Settings for these environments (e.g., production log levels, external service URLs if they differ and aren't secrets).
* **Merging**: These files should be merged with a base/default configuration, and then further overridden by actual environment variables. The `config` npm package handles this pattern well.
* **Keep it Minimal**: Only include settings that genuinely differ. Avoid duplicating configurations that are the same across environments or that should be controlled by environment variables.
* **Secrets**: **Reiterate that secrets (API keys, DB passwords, JWT secrets) should NOT be in these files.** They should be loaded from environment variables. These files might define *which* environment variable to look for, but not the secret value itself.
* **Maoga Context**: This structure is good for organizing non-sensitive, environment-specific settings.

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
**Thoughts/Considerations regarding Server Entry Point**:
* **File**: `src/server.js` as planned.
* **Responsibilities**:
1.  **Load Configuration**: Initialize and load application configuration (from `src/config/index.js`).
2.  **Initialize Logger**: Set up the application-wide logger.
3.  **Establish Database Connection**: Connect to MongoDB (and Redis if used). Handle connection errors.
4.  **Initialize Express App**: Import and initialize the Express app from `src/app.js`.
5.  **Start HTTP Server**: `app.listen(config.port, () => { ... })`.
6.  **Initialize Socket.IO Server**: If Socket.IO is integrated with the HTTP server, initialize it here.
7.  **Unhandled Error Handlers**: Set up `process.on('uncaughtException')` and `process.on('unhandledRejection')` for graceful shutdown on critical errors.
8.  **Graceful Shutdown Logic**: Implement logic to close server connections, database connections, etc., on `SIGINT` and `SIGTERM` signals.
* **Keep it Lean**: The `server.js` should focus on these startup/shutdown concerns. Most application setup (middleware, routes) should be in `app.js`.
* **Maoga Context**: This is a standard and good approach. Ensure robust error handling for startup (e.g., if DB connection fails) and graceful shutdown.
### 9.2 Express Application Setup
**Thoughts/Considerations regarding Express Application Setup**:
* **File**: `src/app.js` as planned.
* **Responsibilities**:
1.  **Create Express Instance**: `const app = express();`.
2.  **Middleware Setup (Order Matters)**:
* **Core Middleware**: `express.json()`, `express.urlencoded({ extended: true })`.
* **Security Middleware**: `helmet` (for security headers), `cors` (for Cross-Origin Resource Sharing).
* **Compression Middleware**: `compression`.
* **Request Logging Middleware**: Morgan or custom.
* **Authentication Middleware**: (e.g., JWT verification) - might be global or applied to specific routes.
* **(Optional) Request ID Middleware**: To add a unique ID to each request for tracing.
3.  **Route Definitions**: Mount routers from your modules (e.g., `app.use('/api/users', userRoutes);`, `app.use('/api/auth', authRoutes);`).
4.  **Static Assets (if any)**: `app.use(express.static('public'));` (though likely not much for a pure backend API).
5.  **Health Check Endpoint**: Define `/health` or similar.
6.  **404 Handler**: A route that catches all unhandled requests (e.g., `app.all('*', (req, res) => res.status(404).json({ message: 'Not Found' }));`). This should be *after* all your defined routes.
7.  **Global Error Handler**: The centralized error handling middleware. This should be the *last* piece of middleware added.
* **Export**: Export the configured `app` instance to be used by `server.js`.
* **Maoga Context**: This is a standard Express setup. The key is the correct ordering of middleware.

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
**Thoughts/Considerations regarding Dependency Injection (DI)**:
* **Concept**: A design pattern where a component's dependencies (other objects or services it needs to function) are provided to it from an external source, rather than the component creating them itself.
* **Benefits**:
* **Decoupling**: Components are less coupled, making the system more modular and easier to maintain.
* **Testability**: Easier to mock dependencies during unit testing.
* **Flexibility**: Easier to swap out implementations of dependencies.
* **Forms of DI**:
* **Constructor Injection**: Dependencies are passed via the class constructor.
* **Setter/Property Injection**: Dependencies are set via public setters or properties.
* **Parameter Injection**: Dependencies are passed as method parameters (less common for object dependencies, more for data).
* **DI Containers/Frameworks (for JavaScript/Node.js)**:
* Libraries like `Awilix`, `InversifyJS`, `NestJS` (which is a full framework with built-in DI).
* **Manual DI (Simpler Approach for Maoga)**:
* You can achieve many benefits of DI without a full container by simply instantiating and passing dependencies manually.
* Example:
```javascript
// services/userService.js
// module.exports = function(userRepository, notificationService) { // Function returning object, or class
//   return {
//     async createUser(data) {
//       const user = await userRepository.create(data);
//       await notificationService.sendWelcomeEmail(user);
//       return user;
//     }
//   };
// };

            // modules/user/index.js (or a central services setup file)
            // const userRepository = require('./repositories/userRepository'); // Assume this is set up
            // const notificationService = require('../../services/notificationService'); // Assume this is set up
            // const userServiceInstance = require('./services/userService')(userRepository, notificationService);
            // module.exports = { services: { userService: userServiceInstance, ... } };
```
Your current structure of importing services (e.g., `NotificationService` inside `UserService`) is a form of service location, not pure DI. Explicitly passing dependencies makes testing easier.
    * **Maoga Context**:
        * **Current Stage**: For the modular monolith, full-blown DI containers might be overkill initially.
        * **Recommendation**: Consider a "manual DI" approach for your services. When a service (e.g., `AuthService`) needs another service (e.g., `UserService`, `TokenService`, `EmailService` as per `project-structure.md` for Auth module), instantiate and pass these dependencies (e.g., in the constructor of the service class or to a factory function). This greatly improves testability by allowing you to mock these dependencies in tests.
        * Start by applying this to new services or when refactoring.
        * (This is a good practice to adopt for testability and modularity, can be introduced gradually. Not critical for MVP to use a DI *framework*, but the *pattern* is beneficial.)

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
**Thoughts/Considerations regarding Custom Error Classes**:
* **Covered in `implementation-guidelines.md` (Section 3.2.1)**.
* **Reiteration for Project Structure context**:
* Define these in `src/utils/errors.js` as planned.
* Ensure they capture `statusCode`, `errorCode`, and an `isOperational` flag.
* Examples: `NotFoundError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`.
* Use them consistently throughout your service layer to signal specific error conditions.
* The global error handler middleware (`src/middleware/errorHandler.js`) will then use the properties of these custom errors to formulate appropriate HTTP responses.
* **Maoga Context**: This is a foundational element for clean error handling and is well-integrated with the planned project structure.

## 13. Environment Variables
### 13.1 Required Environment Variables
**Thoughts/Considerations regarding Required Environment Variables**:
* **Covered in `implementation-guidelines.md` (Section 7.1.1)**.
* **List for Maoga (from previous analysis and docs)**:
* `NODE_ENV`: (e.g., "development", "production", "test") - Controls behavior of many libraries and your custom configs.
* `PORT`: Port the server listens on.
* `MONGODB_URI`: Connection string for MongoDB.
* `JWT_SECRET`: Secret key for signing JWTs.
* `JWT_REFRESH_SECRET`: Secret key for signing refresh tokens.
* `JWT_ACCESS_TOKEN_EXPIRY`: (e.g., "15m", "1h")
* `JWT_REFRESH_TOKEN_EXPIRY`: (e.g., "7d")
* `EXTERNAL_GAME_API_KEY`: For IGDB/RAWG.
* `EXTERNAL_GAME_API_URL`: Base URL for the external game API.
* `LOG_LEVEL`: (e.g., "info", "debug")
* `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS.
* `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`: If Redis is used.
* `FCM_SERVER_KEY`: For Firebase Cloud Messaging push notifications.
* `CLOUD_STORAGE_BUCKET_NAME`: (e.g., S3 bucket name for media uploads)
* `CLOUD_STORAGE_ACCESS_KEY_ID`: (If using access keys directly, though IAM roles are better for ECS/EC2)
* `CLOUD_STORAGE_SECRET_ACCESS_KEY`:
* `CLOUD_STORAGE_REGION`:
* `PAYMENT_PROVIDER_API_KEY`: (e.g., Stripe secret key)
* `PAYMENT_PROVIDER_WEBHOOK_SECRET`:
* **Documentation**: Maintain this list in `.env.example`.
* **Validation**: Consider adding a startup script that checks for the presence of essential environment variables in production/staging and exits if they are missing.
* **Maoga Context**: This list will grow as features like push notifications, media uploads, and payments are implemented.

### 13.2 Environment-specific Variables
**Thoughts/Considerations regarding Environment-specific Variables**:
* **Concept**: These are variables whose *values* change based on the environment, but the variable *name* remains the same. The list in 13.1 are all examples of this.
* **Examples of Value Differences**:
* `NODE_ENV`: "development" vs "production"
* `MONGODB_URI`: `mongodb://localhost:27017/maoga_dev` vs `mongodb+srv://prod_user:prod_pass@cluster.mongodb.net/maoga_prod`
* `LOG_LEVEL`: "debug" vs "info"
* `CORS_ALLOWED_ORIGINS`: `http://localhost:8080` vs `https://app.maoga.gg`
* API Keys: Dev keys vs Production keys for external services.
* **Management**:
* **Local Development**: Managed via `.env` file (loaded by `dotenv`).
* **Testing**: Can be set in `package.json` test scripts, a test-specific `.env` file, or by the CI environment.
* **Staging/Production**: Injected by the deployment platform (ECS, Kubernetes, Heroku) and often sourced from secure secret stores (AWS Secrets Manager, Parameter Store, Vault).
* **No Secrets in Code**: Reiterate that the *values* for production secrets should never be in version control.
* **Maoga Context**: Standard practice. The key is having a secure and reliable way to provide the correct values for each environment when the application is deployed.

## 14. Module Registration System
### 14.1 Module Registration
**Thoughts/Considerations regarding Module Registration**:
* **Purpose**: In a modular application, this refers to the process of making each module's components (especially routes, and sometimes services or event handlers) known to and integrated with the main application.
* **Current Approach in `project-structure.md`**: The `src/modules/[module-name]/index.js` file is planned to have an `initialize` function:
```javascript
// src/modules/user/index.js
module.exports = {
  // ...
  initialize: (app) => {
    app.use('/api/users', routes); // 'routes' is require('./routes') from within user module
  }
};
```
And then in `src/app.js` (or wherever modules are loaded):
```javascript
// src/app.js
// const userModule = require('./modules/user');
// const gameModule = require('./modules/game');
// ...
// userModule.initialize(app);
// gameModule.initialize(app);
```
* **This is a good, clear pattern for modular monoliths.**
* **Considerations**:
* **Route Prefixing**: The `initialize` function clearly defines the base API path for all routes within that module (e.g., `/api/users`).
* **Order of Initialization**: If modules have dependencies on each other during initialization (e.g., for event bus subscriptions), the order might matter. However, for simply registering routes, the order is usually less critical unless routes can conflict (which they shouldn't with proper prefixing).
* **Other Registrations**: Besides routes, a module's `initialize` function could also:
* Register event listeners with a shared event bus.
* Register cron jobs defined within the module.
* Perform any other setup tasks specific to that module.
* **Maoga Context**: The planned `initialize` function per module is a good system. It keeps module setup encapsulated.

### 14.2 Module Initialization
**Thoughts/Considerations regarding Module Initialization**:
* **Extends 14.1**. Module Initialization is the *act* of calling those `initialize` functions (or similar setup logic) when the application starts.
* **Centralized Initialization**: This should happen in a central place in your application, typically in `src/app.js` before the 404 and error handlers, but after core middleware is set up.
* **Responsibilities During Initialization (beyond route registration)**:
* **Service Instantiation**: If services within a module need to be instantiated with dependencies (especially if using manual DI), this could happen during initialization, or services could be singletons exported from the module.
* **Event Bus Subscriptions**: If modules communicate via an event bus, they would subscribe to relevant events during their initialization.
* **Background Tasks**: If a module needs to start any background tasks or timers, this could be triggered.
* **Health Checks**: A module could register its components for health checks.
* **Example Flow in `app.js`**:
1.  Setup core Express app (`app = express()`).
2.  Setup core middleware (JSON parser, CORS, helmet, logger).
3.  Initialize shared services (like an Event Bus if used).
4.  Loop through modules or explicitly import and call `module.initialize(app, { eventBus, otherSharedServices })`.
5.  Setup final catch-all (404) and error handling middleware.
* **Maoga Context**: The pattern described in `project-structure.md` for module `index.js` having an `initialize(app)` function that registers routes is the core of this. Ensure that if modules have other setup needs (like subscribing to a shared event bus, if you introduce one), the `initialize` function can handle that or a similar standardized setup function is called.
