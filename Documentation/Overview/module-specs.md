# Module Specifications and Interfaces

This documents the internal structure and interfaces for each module, ensuring clear boundaries and well-defined communication patterns.

## 1. User Module
The User Module handles user registration, authentication, profile management, and friend relationships.

### 1.1 Internal Components
#### 1.1.1 Controllers
- `AuthController`: Handles user registration and authentication
- `UserController`: Manages user profile operations
- `FriendController`: Manages friend relationships
#### 1.1.2 Services
- `AuthService`: Business logic for authentication
- `UserService`: Business logic for user operations
- `FriendService`: Business logic for friend operations
- `ProfileService`: Business logic for profile customization
#### 1.1.3 Models
- `User`: Mongoose model for user data
- `Friendship`: Mongoose model for friend relationships
#### 1.1.4 Repositories
- `UserRepository`: Data access for user operations
- `FriendshipRepository`: Data access for friendship operations

### 1.2 Public Interfaces
#### 1.2.1 AuthController Interface
```typescript
interface AuthController {
  register(email: string, username: string, password: string): Promise<{ user: User, token: string }>;
  login(email: string, password: string): Promise<{ user: User, token: string }>;
  refreshToken(refreshToken: string): Promise<{ token: string, refreshToken: string }>;
  resetPassword(email: string): Promise<void>;
  confirmResetPassword(token: string, newPassword: string): Promise<void>;
  logout(userId: string): Promise<void>;
}
```
#### 1.2.2 UserController Interface
```typescript
interface UserController {
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile>;
  updatePreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences>;
  getGameProfiles(userId: string): Promise<GameProfile[]>;
  updateGameProfile(userId: string, gameId: string, profile: GameProfile): Promise<GameProfile>;
  updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<PrivacySettings>;
  updateNotificationSettings(userId: string, settings: NotificationSettings): Promise<NotificationSettings>;
  registerDevice(userId: string, deviceToken: string): Promise<void>;
  deactivateAccount(userId: string): Promise<void>;
}
```
#### 1.2.3 FriendController Interface
```typescript
interface FriendController {
  getFriends(userId: string, status?: FriendshipStatus): Promise<Friend[]>;
  sendFriendRequest(userId: string, targetUserId: string): Promise<Friendship>;
  respondToFriendRequest(userId: string, requestId: string, accept: boolean): Promise<Friendship>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  blockUser(userId: string, targetUserId: string): Promise<void>;
  unblockUser(userId: string, targetUserId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<User[]>;
}
```

### 1.3 Event Emissions
- `user.registered`: When a new user registers
- `user.profile.updated`: When a user profile is updated
- `friendship.requested`: When a friend request is sent
- `friendship.accepted`: When a friend request is accepted
- `friendship.rejected`: When a friend request is rejected
- `user.blocked`: When a user blocks another user

### 1.4 Event Subscriptions
- `game.added`: To update user game profiles
- `matchmaking.started`: To update user status
- `matchmaking.completed`: To update user status
- `lobby.joined`: To update user status
- `lobby.left`: To update user status

## 2. Game Module
The Game Module manages the game catalog and integration with external game APIs.

### 2.1 Internal Components
#### 2.1.1 Controllers
- `GameController`: Handles game-related operations
- `GameSyncController`: Manages external API synchronization
#### 2.1.2 Services
- `GameService`: Business logic for game operations
- `GameSyncService`: Business logic for syncing with external APIs
- `GameSearchService`: Business logic for game search operations
#### 2.1.3 Models
- `Game`: Mongoose model for game data
#### 2.1.4 Repositories
- `GameRepository`: Data access for game operations

### 2.2 Public Interfaces
#### 2.2.1 GameController Interface
```typescript
interface GameController {
  getGames(filter?: GameFilter, pagination?: Pagination): Promise<PaginatedResult<Game>>;
  getGameById(gameId: string): Promise<Game>;
  getGameBySlug(slug: string): Promise<Game>;
  searchGames(query: string, pagination?: Pagination): Promise<PaginatedResult<Game>>;
  getPopularGames(limit?: number): Promise<Game[]>;
  getGamesByPlatform(platform: string, pagination?: Pagination): Promise<PaginatedResult<Game>>;
  getGamesByGenre(genre: string, pagination?: Pagination): Promise<PaginatedResult<Game>>;
}
```
#### 2.2.2 GameSyncController Interface (Admin Only)
```typescript
interface GameSyncController {
  syncGames(): Promise<SyncResult>;
  updateGame(gameId: string, gameData: Partial<Game>): Promise<Game>;
  toggleGameActivity(gameId: string, isActive: boolean): Promise<Game>;
  manuallyAddGame(gameData: Game): Promise<Game>;
}
```

### 2.3 Event Emissions
- `game.added`: When a new game is added
- `game.updated`: When a game is updated
- `game.popularity.changed`: When a game's popularity changes significantly

### 2.4 Event Subscriptions
- `user.gameProfile.added`: To track game popularity
- `matchmaking.completed`: To track game popularity
- `scheduled.sync`: To trigger regular game data synchronization

## 3. Matchmaking Module
The Matchmaking Module handles the matchmaking algorithm and queue management.

### 3.1 Internal Components
#### 3.1.1 Controllers
- `MatchmakingController`: Handles matchmaking requests
- `MatchHistoryController`: Manages match history
#### 3.1.2 Services
- `MatchmakingService`: Business logic for matchmaking
- `MatchQueueService`: Business logic for queue management
- `MatchAlgorithmService`: Implements the matching algorithm
- `MatchHistoryService`: Business logic for match history
#### 3.1.3 Models
- `MatchRequest`: Mongoose model for matchmaking requests
- `MatchHistory`: Mongoose model for match history
#### 3.1.4 Repositories
- `MatchRequestRepository`: Data access for matchmaking requests
- `MatchHistoryRepository`: Data access for match history

### 3.2 Public Interfaces
#### 3.2.1 MatchmakingController Interface
```typescript
interface MatchmakingController {
  startMatchmaking(userId: string, criteria: MatchCriteria): Promise<MatchRequest>;
  cancelMatchmaking(userId: string, requestId: string): Promise<void>;
  updateMatchCriteria(userId: string, requestId: string, criteria: Partial<MatchCriteria>): Promise<MatchRequest>;
  getActiveRequest(userId: string): Promise<MatchRequest>;
  getMatchmakingStatus(userId: string, requestId: string): Promise<MatchmakingStatus>;
  addFriendsToMatch(userId: string, requestId: string, friendIds: string[]): Promise<MatchRequest>;
}
```
#### 3.2.2 MatchHistoryController Interface
```typescript
interface MatchHistoryController {
  getMatchHistory(userId: string, pagination?: Pagination): Promise<PaginatedResult<MatchHistory>>;
  getMatchDetails(userId: string, matchId: string): Promise<MatchDetail>;
}
```

### 3.3 Event Emissions
- `matchmaking.started`: When matchmaking begins
- `matchmaking.updated`: When matchmaking criteria are updated
- `matchmaking.cancelled`: When matchmaking is cancelled
- `matchmaking.matched`: When a match is found
- `matchmaking.expired`: When matchmaking times out
- `matchmaking.lobby.created`: When a lobby is created from a match

### 3.4 Event Subscriptions
- `user.preferences.updated`: To update matchmaking criteria
- `user.gameProfile.updated`: To update matchmaking criteria
- `lobby.created`: To associate lobby with matchmaking
- `lobby.closed`: To update match history

## 4. Lobby Module
The Lobby Module manages lobbies created from successful matches.

### 4.1 Internal Components
#### 4.1.1 Controllers
- `LobbyController`: Handles lobby operations
- `LobbyMemberController`: Manages lobby membership
#### 4.1.2 Services
- `LobbyService`: Business logic for lobby operations
- `LobbyMemberService`: Business logic for lobby membership
- `LobbyStatusService`: Maintains lobby state
#### 4.1.3 Models
- `Lobby`: Mongoose model for lobbies
#### 4.1.4 Repositories
- `LobbyRepository`: Data access for lobby operations

### 4.2 Public Interfaces
#### 4.2.1 LobbyController Interface
```typescript
interface LobbyController {
  getLobby(lobbyId: string): Promise<Lobby>;
  getUserLobbies(userId: string): Promise<Lobby[]>;
  createLobby(creatorId: string, gameId: string, settings: LobbySettings): Promise<Lobby>;
  updateLobbySettings(userId: string, lobbyId: string, settings: Partial<LobbySettings>): Promise<Lobby>;
  closeLobby(userId: string, lobbyId: string): Promise<void>;
  setAutoMessage(userId: string, lobbyId: string, message: string): Promise<Lobby>;
}
```
#### 4.2.2 LobbyMemberController Interface
```typescript
interface LobbyMemberController {
  joinLobby(userId: string, lobbyId: string): Promise<Lobby>;
  leaveLobby(userId: string, lobbyId: string): Promise<void>;
  kickMember(hostId: string, lobbyId: string, userId: string): Promise<void>;
  inviteToLobby(userId: string, lobbyId: string, targetUserId: string): Promise<void>;
  setReadyStatus(userId: string, lobbyId: string, isReady: boolean): Promise<Lobby>;
  transferHost(hostId: string, lobbyId: string, newHostId: string): Promise<Lobby>;
}
```

### 4.3 Event Emissions
- `lobby.created`: When a lobby is created
- `lobby.updated`: When lobby settings are updated
- `lobby.closed`: When a lobby is closed
- `lobby.member.joined`: When a user joins a lobby
- `lobby.member.left`: When a user leaves a lobby
- `lobby.member.kicked`: When a user is kicked from a lobby
- `lobby.member.invited`: When a user is invited to a lobby
- `lobby.member.readyStatus`: When a user's ready status changes
- `lobby.host.changed`: When the lobby host changes

### 4.4 Event Subscriptions
- `matchmaking.matched`: To create a lobby from a match
- `chat.message.sent`: To update lobby activity status
- `user.status.changed`: To update member status

## 5. Chat Module
The Chat Module manages real-time chat functionality for lobbies and direct messages.

### 5.1 Internal Components
#### 5.1.1 Controllers
- `ChatController`: Handles chat operations
- `MessageController`: Manages message operations
#### 5.1.2 Services
- `ChatService`: Business logic for chat operations
- `MessageService`: Business logic for message operations
- `ChatRoomService`: Manages chat room membership
#### 5.1.3 Models
- `Chat`: Mongoose model for chat rooms
- `Message`: Mongoose model for chat messages
#### 5.1.4 Repositories
- `ChatRepository`: Data access for chat operations
- `MessageRepository`: Data access for message operations

### 5.2 Public Interfaces
#### 5.2.1 ChatController Interface
```typescript
interface ChatController {
  getLobbyChat(lobbyId: string): Promise<Chat>;
  getDirectChat(userId: string, targetUserId: string): Promise<Chat>;
  getUserChats(userId: string): Promise<Chat[]>;
  markChatAsRead(userId: string, chatId: string): Promise<void>;
}
```
#### 5.2.2 MessageController Interface
```typescript
interface MessageController {
  sendMessage(userId: string, chatId: string, content: string, contentType: ContentType): Promise<Message>;
  getMessages(chatId: string, pagination?: Pagination): Promise<PaginatedResult<Message>>;
  deleteMessage(userId: string, messageId: string): Promise<void>;
  uploadMedia(userId: string, chatId: string, file: File): Promise<{ mediaUrl: string }>;
}
```

### 5.3 WebSocket Events (Socket.IO)
#### 5.3.1 Client to Server Events
- `chat:join`: Join a chat room
- `chat:leave`: Leave a chat room
- `chat:message`: Send a new message
- `chat:typing`: Indicate the user is typing
- `chat:read`: Mark messages as read

#### 5.3.2 Server to Client Events
- `chat:message`: New message received
- `chat:typing`: User is typing
- `chat:read`: Messages marked as read
- `chat:member:joined`: Member joined the chat
- `chat:member:left`: Member left the chat

### 5.4 Event Emissions
- `chat.created`: When a new chat is created
- `chat.message.sent`: When a message is sent
- `chat.message.deleted`: When a message is deleted

### 5.5 Event Subscriptions
- `lobby.created`: To create a lobby chat
- `lobby.member.joined`: To add member to lobby chat
- `lobby.member.left`: To remove member from lobby chat
- `friendship.accepted`: To enable direct messaging

## 6. Notification Module
The Notification Module handles sending and tracking notifications to users.

### 6.1 Internal Components
#### 6.1.1 Controllers
- `NotificationController`: Handles notification operations
#### 6.1.2 Services
- `NotificationService`: Business logic for notifications
- `PushNotificationService`: Handles push notifications
- `EmailNotificationService`: Handles email notifications
- `NotificationPreferenceService`: Manages notification preferences
#### 6.1.3 Models
- `Notification`: Mongoose model for notifications
#### 6.1.4 Repositories
- `NotificationRepository`: Data access for notifications

### 6.2 Public Interfaces
#### 6.2.1 NotificationController Interface
```typescript
interface NotificationController {
  getNotifications(userId: string, status?: NotificationStatus, pagination?: Pagination): Promise<PaginatedResult<Notification>>;
  markAsRead(userId: string, notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  deleteNotification(userId: string, notificationId: string): Promise<void>;
  getNotificationCount(userId: string): Promise<{ total: number, unread: number }>;
}
```

### 6.3 WebSocket Events (Socket.IO)
#### 6.3.1 Server to Client Events
- `notification:new`: New notification received
- `notification:count`: Updated notification count

### 6.4 Event Emissions
- `notification.created`: When a notification is created
- `notification.read`: When a notification is read
- `notification.deleted`: When a notification is deleted

### 6.5 Event Subscriptions
Multiple events from various modules trigger notifications:
- `user.registered`: Welcome notification
- `friendship.requested`: Friend request notification
- `friendship.accepted`: Friend request accepted notification
- `matchmaking.matched`: Match found notification
- `lobby.member.invited`: Lobby invitation notification
- `chat.message.sent`: New message notification
- `lobby.created`: Lobby created notification

## 7. Admin Module
The Admin Module provides functionality for administrators to manage the platform.

### 7.1 Internal Components
#### 7.1.1 Controllers
- `AdminUserController`: Manages user administration
- `AdminGameController`: Manages game administration
- `AdminReportController`: Handles reported content
- `AdminStatsController`: Provides system statistics
#### 7.1.2 Services
- `AdminUserService`: Business logic for user administration
- `AdminGameService`: Business logic for game administration
- `AdminReportService`: Business logic for handling reports
- `AdminStatsService`: Business logic for system statistics
#### 7.1.3 Models
- `Report`: Mongoose model for user reports
- `AdminAction`: Mongoose model for admin actions
#### 7.1.4 Repositories
- `ReportRepository`: Data access for reports
- `AdminActionRepository`: Data access for admin actions

### 7.2 Public Interfaces
#### 7.2.1 AdminUserController Interface
```typescript
interface AdminUserController {
  listUsers(filter?: UserFilter, pagination?: Pagination): Promise<PaginatedResult<User>>;
  getUserDetails(userId: string): Promise<UserDetail>;
  updateUserStatus(adminId: string, userId: string, status: UserStatus, reason: string): Promise<User>;
  deleteUser(adminId: string, userId: string, reason: string): Promise<void>;
  impersonateUser(adminId: string, userId: string): Promise<{ token: string }>;
}
```
#### 7.2.2 AdminReportController Interface
```typescript
interface AdminReportController {
  getReports(status?: ReportStatus, pagination?: Pagination): Promise<PaginatedResult<Report>>;
  getReportDetails(reportId: string): Promise<ReportDetail>;
  updateReportStatus(adminId: string, reportId: string, status: ReportStatus, action?: AdminAction): Promise<Report>;
}
```

### 7.3 Event Emissions
- `admin.user.updated`: When an admin updates a user
- `admin.report.resolved`: When an admin resolves a report
- `admin.system.notification`: When an admin sends a system notification

### 7.4 Event Subscriptions
- `user.reported`: When a user reports content
- `chat.message.reported`: When a message is reported
- `lobby.reported`: When a lobby is reported

## 8. Shop Module (Future)
The Shop Module will handle virtual item purchases and inventory management.

### 8.1 Internal Components
#### 8.1.1 Controllers
- `ShopController`: Handles shop operations
- `InventoryController`: Manages user inventories
- `TransactionController`: Handles payment transactions
#### 8.1.2 Services
- `ShopService`: Business logic for shop operations
- `InventoryService`: Business logic for inventory operations
- `TransactionService`: Business logic for transactions
- `PaymentProviderService`: Integration with payment providers
#### 8.1.3 Models
- `ShopItem`: Mongoose model for shop items
- `UserInventory`: Mongoose model for user inventories
- `Transaction`: Mongoose model for transactions
#### 8.1.4 Repositories
- `ShopItemRepository`: Data access for shop items
- `UserInventoryRepository`: Data access for user inventories
- `TransactionRepository`: Data access for transactions

### 8.2 Public Interfaces
#### 8.2.1 ShopController Interface
```typescript
interface ShopController {
  getShopItems(category?: string, pagination?: Pagination): Promise<PaginatedResult<ShopItem>>;
  getItemDetails(itemId: string): Promise<ShopItem>;
  getFeaturedItems(): Promise<ShopItem[]>;
}
```
#### 8.2.2 InventoryController Interface
```typescript
interface InventoryController {
  getUserInventory(userId: string): Promise<UserInventory>;
  equipItem(userId: string, itemId: string, location: string): Promise<UserInventory>;
  unequipItem(userId: string, itemId: string): Promise<UserInventory>;
}
```
#### 8.2.3 TransactionController Interface
```typescript
interface TransactionController {
  createPurchase(userId: string, itemId: string): Promise<Transaction>;
  getPaymentIntent(userId: string, transactionId: string): Promise<PaymentIntent>;
  confirmPurchase(userId: string, transactionId: string, paymentInfo: PaymentInfo): Promise<Transaction>;
  getUserTransactions(userId: string, pagination?: Pagination): Promise<PaginatedResult<Transaction>>;
}
```

### 8.3 Event Emissions
- `shop.item.purchased`: When a user purchases an item
- `shop.item.equipped`: When a user equips an item
- `transaction.created`: When a transaction is created
- `transaction.completed`: When a transaction is completed

### 8.4 Event Subscriptions
- `user.registered`: To create an inventory for new users
- `user.profile.updated`: To update equipped items

## 9. Shared Components
These components are shared across multiple modules and provide common functionality.

### 9.1 Authentication Middleware
```typescript
interface AuthMiddleware {
  authenticate(req: Request, res: Response, next: NextFunction): void;
  authorize(roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
  refreshToken(req: Request, res: Response, next: NextFunction): void;
}
```

### 9.2 Validation Middleware
```typescript
interface ValidationMiddleware {
  validate(schema: Schema): (req: Request, res: Response, next: NextFunction) => void;
}
```

### 9.3 Error Handling Middleware
```typescript
interface ErrorHandlingMiddleware {
  handleError(err: Error, req: Request, res: Response, next: NextFunction): void;
}
```

### 9.4 Logging Service
```typescript
interface LoggingService {
  info(message: string, metadata?: object): void;
  error(message: string, error?: Error, metadata?: object): void;
  warn(message: string, metadata?: object): void;
  debug(message: string, metadata?: object): void;
  requestLog(req: Request, res: Response): void;
}
```

### 9.5 Event Bus
```typescript
interface EventBus {
  publish(eventName: string, data: any): void;
  subscribe(eventName: string, handler: (data: any) => void): Subscription;
  unsubscribe(subscription: Subscription): void;
}
```

### 9.6 Cache Service
```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  flush(): Promise<void>;
}
```

### 9.7 File Storage Service
```typescript
interface FileStorageService {
  uploadFile(file: Buffer, path: string, metadata?: object): Promise<{ url: string }>;
  getFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
}
```
