# Database Models and Schema Design
## 1. Database Overview
The server uses MongoDB as its primary database, with Mongoose as the ODM (Object-Document Mapper). This document will document the core collections, their schemas, relationships, and indexing strategies.
It will be updated as sprints get delivered to reflect the current state of the backend.

## 2. Collections and Schemas
### 2.1 User Collection
The `users` collection stores user account and profile information.

### 2.2 Game Collection
The `games` collection stores information about available games.

### 2.3 Friendship Collection
The `friendships` collection stores friend relationships between users.

### 2.4 MatchRequest Collection
The `matchRequests` collection stores user matchmaking requests.

### 2.5 Lobby Collection
The `lobbies` collection stores created lobbies when users are matched.

### 2.6 Chat Collection
The `chats` collection stores both lobby chats and direct messages.

### 2.7 Notification Collection
The `notifications` collection stores user notifications.

### 2.8 UserActivity Collection
The `userActivities` collection records user activity for analytics and history.

### 2.9 ShopItem Collection (Future)
The `shopItems` collection stores items available in the shop.

### 2.10 UserInventory Collection (Future)
The `userInventories` collection stores items owned by users.

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

### 7.3 Caching Strategy (Future)
1. **Game Data**: Cache in memory or Redis (rarely changes)
2. **User Profiles**: Cache with short TTL (5-10 minutes)
3. **Active Lobbies**: Cache with very short TTL (30 seconds)
