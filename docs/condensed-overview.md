# Maoga Backend - Condensed Implementation Guide

## 🎯 Project Overview

**Goal**: Build a matchmaking platform backend for gamers to find compatible teammates based on preferences, games, and playstyle.

**Tech Stack**:
- **Runtime**: Node.js (v18+) with Express.js
- **Database**: MongoDB (Atlas for production) with Mongoose ODM
- **Real-time**: Socket.IO with Redis adapter for scaling
- **Authentication**: JWT (access + refresh tokens)
- **Deployment**: Docker → AWS ECS (Fargate) or similar

## 📁 Project Structure

```
/src
├── server.js              # Entry point
├── app.js                 # Express setup
├── config/                # Environment configs
├── middleware/            # Auth, validation, error handling
├── modules/               # Feature modules
│   ├── user/             # User & auth management
│   ├── game/             # Game catalog
│   ├── matchmaking/      # Core matching logic
│   ├── lobby/            # Post-match lobbies
│   ├── chat/             # Real-time messaging
│   ├── notification/     # Multi-channel notifications
│   └── admin/            # Admin tools
├── services/             # Shared services (socket, cache, storage)
└── utils/                # Helpers (errors, logger, async handler)
```

### Module Structure Pattern
```
/modules/[module-name]/
├── controllers/          # HTTP request handlers
├── services/            # Business logic
├── models/              # Mongoose schemas
├── routes/              # Express routes
├── validations/         # Input validation (Joi)
└── index.js            # Module exports
```

## 🗄️ Core Data Models

### User
```javascript
{
  email: String (unique),
  username: String (unique),
  hashedPassword: String,
  role: ['user', 'admin'],
  profile: {
    displayName: String,
    bio: String,
    profileImage: String
  },
  gamingPreferences: {
    competitiveness: String,
    preferredGames: [gameId],
    regions: [String],
    languages: [String]
  },
  gameProfiles: [{
    gameId: ObjectId,
    inGameName: String,
    rank: String,
    skillLevel: Number
  }],
  notificationSettings: {},
  karmaPoints: Number,
  virtualCurrency: Number
}
```

### MatchRequest
```javascript
{
  userId: ObjectId,
  status: ['searching', 'matched', 'cancelled'],
  criteria: {
    games: [{ gameId, weight }],
    gameMode: String,
    groupSize: { min, max },
    regionPreference: String,
    languages: [String],
    skillPreference: String
  },
  preselectedUsers: [userId],
  relaxationLevel: Number,
  matchedLobbyId: ObjectId
}
```

### Lobby
```javascript
{
  status: ['forming', 'ready', 'active', 'closed'],
  game: { gameId, gameMode },
  members: [{
    userId: ObjectId,
    status: String,
    isHost: Boolean,
    isReady: Boolean
  }],
  capacity: { min, max, current },
  chatId: ObjectId
}
```

## 🔑 Key Implementation Phases

### Phase 1: Foundation (Sprints 1-4)
1. **Sprint 1**: Project setup, Express server, MongoDB connection, JWT auth, error handling
2. **Sprint 2**: User registration/login, profile management, password reset
3. **Sprint 3**: Game catalog integration (IGDB/RAWG), caching layer
4. **Sprint 4**: Enhanced profiles, RBAC, admin tools, friend system foundation

### Phase 2: Core Features (Sprints 5-8)
5. **Sprint 5**: Matchmaking algorithm (queue management, compatibility scoring)
6. **Sprint 6**: Socket.IO integration for real-time updates
7. **Sprint 7**: Lobby system with chat functionality
8. **Sprint 8**: Multi-channel notification system (in-app, push, email)

### Phase 3: Enhancement (Sprints 9-12)
9. **Sprint 9**: Advanced matchmaking (multi-game, scheduled, group matching)
10. **Sprint 10**: Complete social features (friends, blocking, DMs, karma)
11. **Sprint 11**: Media uploads (S3), chat enhancements
12. **Sprint 12**: Analytics foundation, admin dashboard data

### Phase 4: Monetization (Sprints 13-16)
13. **Sprint 13**: Virtual shop system, inventory management
14. **Sprint 14**: Payment integration (Stripe or similar)
15. **Sprint 15**: Activity feeds, recommendations
16. **Sprint 16**: GDPR compliance, security hardening

### Phase 5: Production Ready (Sprints 17-18)
17. **Sprint 17**: Performance optimization, load testing
18. **Sprint 18**: Cloud deployment preparation, monitoring setup

## 🏗️ Architecture Patterns

### API Design
- RESTful endpoints: `/api/[resource]`
- Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Consistent response format:
```javascript
// Success
{ status: 'success', data: {...}, meta: {...} }
// Error
{ status: 'error', error: { code: 'ERROR_CODE', message: '...' } }
```

### Error Handling
```javascript
// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
  }
}

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error middleware (last in chain)
app.use((err, req, res, next) => {
  // Log error
  // Send formatted response
});
```

### Authentication Flow
1. User login → Generate JWT + Refresh token
2. Protected routes use auth middleware
3. JWT in Authorization header: `Bearer <token>`
4. Short-lived access tokens (15min), longer refresh tokens (7d)
5. Socket.IO connections authenticated via JWT

### Real-time Communication
```javascript
// Socket.IO with Redis adapter for scaling
const io = require('socket.io')(server);
const redisAdapter = require('socket.io-redis');
io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

// User-specific rooms for targeted updates
socket.on('authenticated', () => {
  socket.join(`user:${socket.userId}`);
});

// Event patterns
// Client → Server: chat:message, matchmaking:subscribe
// Server → Client: notification:new, lobby:update, matchmaking:status
```

## 🛡️ Security Essentials

1. **Environment Variables**: Never commit secrets. Use `.env` locally, AWS Parameter Store in production
2. **Input Validation**: Joi schemas on all endpoints
3. **Rate Limiting**: Especially on auth endpoints (express-rate-limit + Redis)
4. **CORS**: Configure allowed origins explicitly
5. **Security Headers**: Use helmet middleware
6. **Password Hashing**: bcrypt with appropriate rounds
7. **HTTPS Only**: SSL/TLS termination at load balancer

## 🚀 Deployment Strategy

### Development
```bash
# Docker Compose for local dev
docker-compose -f docker-compose.dev.yml up

# Environment setup
cp .env.example .env
npm install
npm run dev
```

### Production
1. **Containerization**: Multi-stage Dockerfile, non-root user
2. **CI/CD**: GitHub Actions → Build → Test → Push to ECR
3. **Infrastructure**: AWS ECS Fargate (simpler than K8s for startups)
4. **Database**: MongoDB Atlas M20+ with backups enabled
5. **Monitoring**: CloudWatch logs, health checks on `/health`
6. **Scaling**: Auto-scaling based on CPU/memory metrics

## 📊 Critical Metrics to Track

1. **Performance**: API response times (p50, p95, p99)
2. **Matchmaking**: Average wait time, success rate
3. **User Engagement**: DAU/MAU, session duration
4. **System Health**: Error rates, database connection pool
5. **Business**: User growth, lobby completion rates

## 🔧 Development Best Practices

1. **Code Style**: ESLint + Prettier, 2-space indentation
2. **Testing**: Unit tests for services, integration tests for APIs
3. **Git Flow**: feature/* → develop → main
4. **Documentation**: Update API specs with each sprint
5. **Database Migrations**: Use migrate-mongo from Sprint 1
6. **Logging**: Structured JSON logs with request IDs

## ⚡ Performance Optimization Tips

1. **Database**:
    - Index frequently queried fields (userId, gameId, status)
    - Use `.lean()` for read-only queries
    - Implement pagination on all list endpoints

2. **Caching**:
    - In-memory cache for game data (changes rarely)
    - Redis for distributed cache when scaling

3. **API Optimization**:
    - Compression middleware
    - Minimize payload sizes
    - Use projections in MongoDB queries

## 🚨 Common Pitfalls to Avoid

1. **Don't** store secrets in code or Docker images
2. **Don't** use synchronous operations that block the event loop
3. **Don't** forget to handle WebSocket disconnections gracefully
4. **Don't** implement complex features without proper error boundaries
5. **Don't** skip input validation "because it's internal"

## 📋 Sprint Delivery Checklist

For each sprint:
- [ ] All tests passing (unit + integration)
- [ ] API documentation updated
- [ ] Database migrations created and tested
- [ ] Error handling covers all edge cases
- [ ] Logging implemented for new features
- [ ] Security considerations addressed
- [ ] Performance impact assessed

## 🎯 Next Steps Priority

1. **Immediate** (Sprint 1-2): Get auth, user management, and basic API structure solid
2. **Core MVP** (Sprint 3-8): Focus on matchmaking, lobbies, and real-time features
3. **Enhancement** (Sprint 9-12): Polish user experience with social features
4. **Growth** (Sprint 13-16): Add monetization when user base established
5. **Scale** (Sprint 17-18): Optimize only after you have real usage data

---

**Remember**: Start simple, iterate based on real user feedback. The modular architecture allows you to enhance features without major refactoring. Focus on getting a working MVP with core matchmaking first, then layer on complexity.