# Database Models and Schema Design

## 1. Database Overview

The system uses MongoDB as its primary database, with Mongoose as the ODM (Object-Document Mapper). This document outlines the core collections, their schemas, relationships, and indexing strategies.

## 2. Collections and Schemas

### 2.1 User Collection

The `users` collection stores user account and profile information.

```javascript
// User Schema
{
  _id: ObjectId,                  // MongoDB ID
  email: String,                  // Unique, indexed
  username: String,               // Unique, indexed
  password: String,               // Hashed
  displayName: String,            // Public display name
  profileImage: String,           // URL to profile image
  bio: String,                    // User biography
  status: String,                 // Current status message
  location: {
    country: String,
    region: String,
    language: [String]
  },
  preferences: {
    // Matchmaking preferences
    preferredGames: [ObjectId],    // References Game collection
    gameWeights: [{                // Game preference weights
      gameId: ObjectId,            // References Game collection
      weight: Number               // 1-10 scale
    }],
    competitiveness: String,       // "casual", "competitive", "professional"
    playTimes: [{                  // When the user typically plays
      day: String,                 // "monday", "tuesday", etc.
      startTime: String,           // "18:00"
      endTime: String              // "22:00"
    }],
    regionPreference: String,      // "strict", "preferred", "any"
    languagePreference: String,    // "strict", "preferred", "any"
    skillPreference: String,       // "similar", "higher", "lower", "any"
    groupSize: {                   // Preferred group sizes
      min: Number,
      max: Number
    }
  },
  gameProfiles: [{                 // User's profiles for specific games
    gameId: ObjectId,              // References Game collection
    inGameName: String,            // Username in the game
    rank: String,                  // Rank/skill level
    playStyle: String,             // "aggressive", "strategic", etc.
    role: String,                  // Game-specific role
    experience: String             // Experience level
  }],
  socialLinks: [{                  // External social/platform links
    platform: String,              // "discord", "steam", etc.
    username: String,              // Username on that platform
    url: String                    // URL to profile (optional)
  }],
  karmaPoints: Number,             // Reputation points
  visibilitySettings: {            // Privacy controls
    profile: String,               // "public", "friends", "private"
    onlineStatus: String,          // "public", "friends", "private"
    gameActivity: String           // "public", "friends", "private"
  },
  notificationSettings: {          // Notification preferences
    email: Boolean,
    push: Boolean,
    matchmaking: Boolean,
    friendRequests: Boolean,
    messages: Boolean,
    systemUpdates: Boolean
  },
  deviceTokens: [String],          // For push notifications
  role: String,                    // "user", "admin", "moderator"
  lastActive: Date,                // Last activity timestamp
  accountStatus: String,           // "active", "suspended", "banned"
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ email: 1 }`, unique
- `{ username: 1 }`, unique
- `{ "gameProfiles.gameId": 1 }`
- `{ lastActive: -1 }`

### 2.2 Game Collection

The `games` collection stores information about available games.

```javascript
// Game Schema
{
  _id: ObjectId,
  name: String,                   // Game name
  slug: String,                   // URL-friendly name
  description: String,            // Game description
  coverImage: String,             // URL to cover image
  genres: [String],               // Game genres
  platforms: [String],            // Available platforms
  releaseDate: Date,
  developer: String,
  publisher: String,
  externalIds: {                  // IDs from external APIs
    igdb: String,
    rawg: String,
    steam: String
  },
  rankSystem: {                   // Description of the ranking system
    type: String,                 // "numeric", "tier", "level"
    tiers: [String],              // Available tiers or ranks
    description: String           // Explanation of the system
  },
  roles: [String],                // Available roles in the game
  playerCount: {                  // Player count requirements
    min: Number,
    max: Number
  },
  popularity: Number,             // Calculated popularity score
  isActive: Boolean,              // If the game is active for matchmaking
  lastUpdated: Date,
  createdAt: Date
}
```

**Indexes:**
- `{ slug: 1 }`, unique
- `{ name: "text", description: "text" }`
- `{ popularity: -1 }`
- `{ "externalIds.igdb": 1 }`

### 2.3 Friendship Collection

The `friendships` collection stores friend relationships between users.

```javascript
// Friendship Schema
{
  _id: ObjectId,
  user1Id: ObjectId,              // References User collection
  user2Id: ObjectId,              // References User collection
  status: String,                 // "pending", "accepted", "rejected", "blocked"
  requestedBy: ObjectId,          // Who initiated (References User)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ user1Id: 1, user2Id: 1 }`, unique
- `{ user1Id: 1, status: 1 }`
- `{ user2Id: 1, status: 1 }`

### 2.4 MatchRequest Collection

The `matchRequests` collection stores user matchmaking requests.

```javascript
// Match Request Schema
{
  _id: ObjectId,
  userId: ObjectId,               // User who created the request
  status: String,                 // "searching", "matched", "cancelled", "expired"
  criteria: {
    games: [{                     // Games to match for
      gameId: ObjectId,           // References Game collection
      weight: Number              // Preference weight
    }],
    gameMode: String,             // "casual", "ranked", etc.
    groupSize: {                  // Desired group size
      min: Number,
      max: Number
    },
    regionPreference: String,     // "strict", "preferred", "any" 
    regions: [String],            // Specific regions if applicable
    languagePreference: String,   // "strict", "preferred", "any"
    languages: [String],          // Languages the user speaks
    skillPreference: String,      // "similar", "higher", "lower", "any"
    scheduledTime: Date,          // For planned matchmaking
  },
  preselectedUsers: [ObjectId],   // Friends to match with
  searchStartTime: Date,          // When the search started
  matchExpireTime: Date,          // When to expire the search
  matchedLobbyId: ObjectId,       // References Lobby collection
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ userId: 1, status: 1 }`
- `{ status: 1, "criteria.games.gameId": 1 }`
- `{ status: 1, searchStartTime: 1 }`

### 2.5 Lobby Collection

The `lobbies` collection stores created lobbies when users are matched.

```javascript
// Lobby Schema
{
  _id: ObjectId,
  name: String,                   // Auto-generated name 
  status: String,                 // "forming", "ready", "active", "closed"
  game: {
    gameId: ObjectId,             // References Game collection
    gameName: String,             // Denormalized for convenience
    gameMode: String              // Mode selected for this lobby
  },
  members: [{
    userId: ObjectId,             // References User collection
    status: String,               // "invited", "joined", "ready", "left"
    joinedAt: Date,
    leftAt: Date,
    isHost: Boolean,              // If this user is the lobby host
    readyStatus: Boolean          // If user is ready to play
  }],
  capacity: {
    min: Number,                  // Minimum players needed
    max: Number,                  // Maximum players allowed
    current: Number               // Current player count
  },
  chat: {
    enabled: Boolean,             // If chat is enabled
    history: [{                   // Limited recent history
      userId: ObjectId,           // Who sent the message
      username: String,           // Denormalized for convenience
      message: String,            // The message content
      messageType: String,        // "text", "emote", "system"
      timestamp: Date
    }]
  },
  lobbySettings: {
    public: Boolean,              // If lobby is discoverable
    joinable: Boolean,            // If others can join
    autoDisband: Boolean,         // Disband if host leaves
    disbandAfterMinutes: Number   // Auto-close after inactivity
  },
  autoMessage: String,            // Automated message
  createdAt: Date,
  updatedAt: Date,
  expiresAt: Date
}
```

**Indexes:**
- `{ status: 1 }`
- `{ "members.userId": 1 }`
- `{ "game.gameId": 1, status: 1 }`
- `{ expiresAt: 1 }` (TTL index to auto-expire inactive lobbies)

### 2.6 Chat Collection

The `chats` collection stores both lobby chats and direct messages.

```javascript
// Chat Schema
{
  _id: ObjectId,
  chatType: String,               // "direct", "lobby", "group"
  participants: [ObjectId],       // References User collection
  lobbyId: ObjectId,              // For lobby chats, references Lobby
  messages: [{
    _id: ObjectId,                // Message ID
    senderId: ObjectId,           // User who sent the message
    content: String,              // Message content
    contentType: String,          // "text", "emoji", "gif", "image"
    mediaUrl: String,             // URL for media content
    readBy: [ObjectId],           // Users who've read the message
    createdAt: Date
  }],
  lastMessageAt: Date,            // Timestamp of most recent message
  isActive: Boolean,              // If the chat is still active
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ participants: 1 }`
- `{ lobbyId: 1 }` (if applicable)
- `{ lastMessageAt: -1 }`

### 2.7 Notification Collection

The `notifications` collection stores user notifications.

```javascript
// Notification Schema
{
  _id: ObjectId,
  userId: ObjectId,               // Target user
  type: String,                   // "matchFound", "friendRequest", "message", etc.
  title: String,                  // Notification title
  message: String,                // Notification content
  data: {                         // Additional data for deep linking
    referenceType: String,        // "lobby", "chat", "user", "game", etc.
    referenceId: ObjectId         // ID of the referenced object
  },
  status: String,                 // "unread", "read", "clicked"
  deliveryChannels: [String],     // "inApp", "push", "email"
  deliveryStatus: [{              // Status per channel
    channel: String,
    status: String,               // "pending", "sent", "failed"
    sentAt: Date
  }],
  expiresAt: Date,                // When notification expires
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ userId: 1, status: 1 }`
- `{ userId: 1, createdAt: -1 }`
- `{ expiresAt: 1 }` (TTL index to auto-expire old notifications)

### 2.8 UserActivity Collection

The `userActivities` collection records user activity for analytics and history.

```javascript
// User Activity Schema
{
  _id: ObjectId,
  userId: ObjectId,               // References User collection
  activityType: String,           // "login", "matchJoin", "friendAdd", etc.
  details: Object,                // Activity-specific details
  metadata: {
    ip: String,                   // IP address (hashed)
    device: String,               // Device information
    location: String              // General location
  },
  timestamp: Date
}
```

**Indexes:**
- `{ userId: 1, timestamp: -1 }`
- `{ activityType: 1, timestamp: -1 }`
- `{ timestamp: 1 }` (TTL index for data retention policy)

### 2.9 ShopItem Collection (Future)

The `shopItems` collection stores items available in the shop.

```javascript
// Shop Item Schema
{
  _id: ObjectId,
  type: String,                   // "profile", "emote", "background", etc.
  name: String,                   // Item name
  description: String,            // Item description
  imageUrl: String,               // Preview image
  price: {
    amount: Number,               // Price amount
    currency: String              // "real", "virtual"
  },
  rarity: String,                 // "common", "rare", "legendary", etc.
  availability: {
    available: Boolean,           // If item is available for purchase
    startDate: Date,              // When item becomes available
    endDate: Date                 // When item becomes unavailable
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ type: 1 }`
- `{ "price.amount": 1 }`
- `{ "availability.available": 1 }`

### 2.10 UserInventory Collection (Future)

The `userInventories` collection stores items owned by users.

```javascript
// User Inventory Schema
{
  _id: ObjectId,
  userId: ObjectId,               // References User collection
  items: [{
    itemId: ObjectId,             // References ShopItem collection
    acquiredAt: Date,             // When the item was acquired
    isEquipped: Boolean,          // If the item is currently in use
    equipLocation: String         // Where the item is equipped
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ userId: 1 }`
- `{ "items.itemId": 1 }`

## 3. Relationships and References

### 3.1 Core Relationships

```
User 1:N GameProfiles
User 1:N MatchRequests
User N:N Friendships
User 1:N Notifications
User N:N Lobbies
User 1:1 UserInventory
Game 1:N GameProfiles
MatchRequest N:1 Lobby
Lobby 1:1 Chat
```

### 3.2 Denormalization Strategy

For performance optimization, certain fields are denormalized:

1. **Username in Chat Messages**: Store sender's username to avoid lookups when displaying messages
2. **Game Names in Lobbies**: Store the game name to avoid lookups when listing lobbies
3. **Limited Chat History in Lobbies**: Store recent messages in lobby document for quick access

## 4. Indexing Strategy

### 4.1 Primary Indexes

- **Unique Identifiers**: email, username (unique)
- **Foreign Keys**: userId, gameId (for fast joins)
- **Status Filters**: status fields (for filtering active/inactive records)
- **Timestamp Sorting**: createdAt, updatedAt (for chronological displays)

### 4.2 Compound Indexes

- **Relationship Indexes**: user1Id + user2Id (friendships)
- **Filtered Sorting**: status + timestamp (for filtered, sorted lists)
- **Search Optimization**: multiple fields for complex queries

### 4.3 Text Indexes

- Game name and description for search functionality
- User bio and status for search functionality

### 4.4 TTL Indexes

- Notifications (auto-expire old notifications)
- Lobbies (auto-close inactive lobbies)
- Match requests (auto-expire old requests)

## 5. Schema Evolution Strategy

As the application evolves, the database schema will need to adapt. Follow these guidelines:

1. **Additive Changes**: Add new fields without removing old ones
2. **Versioning**: Use schema version fields if needed
3. **Migration Scripts**: Create scripts for schema migrations
4. **Backwards Compatibility**: Ensure code works with both old and new schemas during transition

## 6. Data Access Patterns

### 6.1 Common Query Patterns

1. **User Profile Lookup**: By username or ID
2. **Friend List Retrieval**: All friends for a user
3. **Active Lobby Listing**: All active lobbies for a game
4. **Matchmaking Queries**: Find potential matches based on criteria
5. **Notification Retrieval**: Recent unread notifications for a user

### 6.2 Write-Heavy Operations

1. **Chat Messages**: High-frequency writes
2. **User Activity Logging**: Frequent logging of user actions
3. **Matchmaking Status Updates**: Frequent updates during active matchmaking

### 6.3 Read-Heavy Operations

1. **Game Listings**: Frequently read, rarely updated
2. **User Profiles**: Frequently viewed
3. **Lobby Status Checks**: Frequent polling by clients

## 7. Performance Considerations

### 7.1 Pagination

All list endpoints should implement pagination:
- `limit`: Number of items per page (default: 20, max: 100)
- `skip`: Number of items to skip (for offset-based pagination)
- `lastId`: Last ID seen (for cursor-based pagination)

### 7.2 Projection

Use MongoDB projections to limit the fields returned:
- Exclude large objects when listing multiple items
- Include only necessary fields for specific operations

### 7.3 Caching Strategy

1. **Game Data**: Cache in memory or Redis (rarely changes)
2. **User Profiles**: Cache with short TTL (5-10 minutes)
3. **Active Lobbies**: Cache with very short TTL (30 seconds)
