# Real-time Communication Implementation
This document includes thoughts regarding the real-time communication features of the backend.

## 1. Overview
The platform requires robust real-time communication for several key features:
- Live chat in lobbies
- Matchmaking status updates
- User presence and status tracking
- Notifications for various events
- Lobby state synchronization

Socket.IO will be used as the primary technology for implementing these real-time features, with Redis as a companion for scaling across multiple server instances.

## 2. Socket.IO Architecture
### 2.1 High-Level Architecture

```
                                +---------------+
                                | Load Balancer |
                                +---------------+
                                        |
        +-------------+-------------+-------------+
        |             |             |             |
+---------------+ +---------------+ +---------------+
| API Server 1  | | API Server 2  | | API Server N  |
| Socket.IO     | | Socket.IO     | | Socket.IO     |
+---------------+ +---------------+ +---------------+
        |             |             |
        +-------------+-------------+
                      |
                +------------+
                |   Redis    |
                | Pub/Sub    |
                +------------+
```

### 2.2 Connection Management
Each client will establish a WebSocket connection to the server, which is maintained throughout the user's session. Socket.IO will automatically handle reconnection attempts and fallback to HTTP long-polling when WebSockets are not available.

## 3. Event Handlers
### 3.1 Chat Event Handler
**Thoughts/Considerations regarding chat event handler**:
* **Location**: Likely within `src/services/socket/handlers/chatHandler.js` or directly integrated with `ChatService` if events are closely tied to service logic.
* **Responsibilities**:
* **`chat:join`**:
* Authenticate user (already done by socket auth middleware).
* Verify user has access to the chat room (e.g., member of the lobby for lobby chat, or one of the participants for direct chat).
* Add user's socket to the Socket.IO room for that `chatId`.
* Potentially emit a `chat:member:joined` event to other room members.
* Acknowledge success/failure to the client.
* **`chat:leave`**:
* Remove user's socket from the Socket.IO room.
* Potentially emit a `chat:member:left` event.
* **`chat:message` (Client to Server)**:
* Receive message content, `chatId`, `contentType` (text, emoji, GIF URL).
* Validate input (e.g., message length, content type).
* Persist the message to the database via `MessageService` (associating with `userId`, `chatId`).
* Broadcast the new message (`chat:message` Server to Client) to all users in the Socket.IO room for that `chatId`. Include sender info, message content, timestamp.
* Consider sending an acknowledgement back to the sender.
* Trigger notifications for unread messages if recipients are offline/not in chat.
* **`chat:typing` (Client to Server)**:
* Receive `chatId`.
* Broadcast `chat:typing` (Server to Client) to other users in the room with the sender's ID/name. Debounce this on the client to avoid excessive events.
* **`chat:read` (Client to Server)**:
* Receive `chatId` and potentially last read message timestamp/ID.
* Update user's read status for that chat in the database.
* Potentially emit `chat:read` (Server to Client) to the other participant(s) in a direct chat so they see "read receipts".
* **Error Handling**: All handlers should have robust error handling and send appropriate error responses/acknowledgements to the client.
* **Security**: Ensure users can only interact with chats they are part of.
* **Integration**: Works closely with `ChatService`, `MessageService`, `UserService` (for user details), and `NotificationService`.

### 3.2 Lobby Event Handler
**Thoughts/Considerations regarding Lobby Event Handler**:
* **Location**: `src/services/socket/handlers/lobbyHandler.js` or integrated with `LobbyService`.
* **Responsibilities**:
* **`lobby:subscribe` (or similar when a user enters a lobby view)**:
* Client sends `lobbyId`.
* Server verifies user is a member of the lobby.
* Adds user's socket to the Socket.IO room for that `lobbyId`.
* Sends current lobby state (`lobby:update`) to the joining client.
* **Events triggered by LobbyService actions (not directly client events, but result in emits)**:
* **`lobby:update` (Server to Client)**: Emitted to all members in a lobby room when lobby settings, game, status (forming, ready, active, closed), or member list changes. Payload includes the updated lobby object.
* **`lobby:member:joined` (Server to Client)**: When a new member joins. Payload includes the new member's details.
* **`lobby:member:left` (Server to Client)**: When a member leaves or is kicked. Payload includes the ID of the member who left.
* **`lobby:member:kicked` (Server to Client)**: Specific event for a kick, potentially to the kicked user and remaining members.
* **`lobby:member:ready` (Server to Client)**: When a member changes their ready status. Payload includes member ID and their new ready status.
* **`lobby:host:changed` (Server to Client)**: When lobby host changes.
* **`lobby:closed` (Server to Client)**: When the lobby is closed.
* **Client Actions that might trigger server-side emits (could be API calls that then trigger socket events via LobbyService)**:
* User sets ready status (API call -> `LobbyService` -> `lobby:member:ready` emit).
* Host changes lobby settings (API call -> `LobbyService` -> `lobby:update` emit).
* **State Synchronization**: The primary goal is to keep all connected lobby members' views in sync with the server-side state of the lobby.
* **Integration**: Tightly coupled with `LobbyService`. `LobbyService` methods would call a `SocketManager` or similar to emit events to the correct rooms.

### 3.3 Matchmaking Event Handler
**Thoughts/Considerations regarding Matchmaking Event Handler**:
* **Location**: `src/services/socket/handlers/matchmakingHandler.js` or integrated with `MatchmakingService`.
* **Responsibilities**:
* **`matchmaking:subscribe` (Client to Server)**:
* Client sends their active `matchRequestId` (obtained after initiating matchmaking via API).
* Server verifies the `matchRequestId` belongs to the authenticated user.
* Adds the user's socket to a user-specific room (e.g., `user:${userId}`) or a request-specific room (e.g., `match:${matchRequestId}`). A user-specific room is often simpler for general status updates.
* Acknowledge success/failure.
* Potentially send initial status.
* **Server to Client Events (emitted by `MatchmakingService` via `SocketManager` to the user-specific/request-specific room)**:
* **`matchmaking:status`**: Regular updates about the search.
* Payload: `status` (searching, relaxing_criteria), `searchTimeElapsed`, `estimatedWaitTime` (if calculable), `currentRelaxationLevel`, `potentialMatchesFound` (count, if meaningful to show).
* Frequency: Emit periodically (e.g., every 5-10 seconds) or when significant changes occur.
* **`matchmaking:matched`**: When a match is found.
* Payload: `lobbyId`, game details, other matched players (or a signal to fetch lobby details).
* This event would typically trigger the client to navigate to the lobby.
* **`matchmaking:cancelled`**: Confirmation if the user cancelled matchmaking.
* **`matchmaking:error`**: If an error occurs specific to their matchmaking request.
* **`matchmaking:expired`**: If their request times out.
* **Purpose**: Provide real-time feedback to the user during the potentially lengthy matchmaking process, so they know the system is working.
* **Integration**: `MatchmakingService` would be responsible for triggering these events at various stages of its logic.

## 4. Real-time Notification System
### 4.1 Notification Service
**Thoughts/Considerations regarding Notification Service (Real-time Aspect)**:
* **Existing Plan**: Sprint 8 details a comprehensive `NotificationService` with in-app, push, and email channels. The real-time part focuses on in-app notifications via Socket.IO.
* **Socket.IO Events (Server to Client)**:
* **`notification:new`**: Emitted to a user-specific room (`user:${userId}`) when a new notification is generated for them.
* Payload: The full notification object (or essential parts like `id`, `type`, `title`, `message`, `data` for deep linking, `createdAt`).
* **`notification:count`**: Emitted to a user-specific room when their unread notification count changes.
* Payload: `{ unreadCount: number }`.
* **Triggering**: The main `NotificationService.createNotification()` method, after saving the notification to the database, would check if the user has active socket connections. If so, it uses the `SocketManager` to emit `notification:new` and `notification:count` to that user's sockets.
* **User-Specific Rooms**: Essential. Each user needs to be in their own Socket.IO room (e.g., named `user:${userId}`) so these notifications are targeted. Sockets should join this room upon successful authentication.
* **Efficiency**: `notification:count` is useful so the UI can update a badge without needing the full notification list immediately.
* **Maoga Context**: This aligns perfectly with Sprint 8 plans. The `SocketManager` would be the bridge between `NotificationService` and the connected clients.

## 5. Real-time Event System
### 5.1 Event Emitter Service
**Thoughts/Considerations regarding Event Emitter Service (Internal Backend Events vs. Real-time Client Events)**:
* **Clarification**: This section in `real-time-communication.md` might be referring to an *internal* event bus within the backend (Node.js `EventEmitter` or a more robust library like `eventemitter2` or even KafkaJS/BullMQ for distributed events) for inter-module communication, rather than directly for client-facing real-time events. Socket.IO itself is an event emitter for client-server communication.
* **If Internal Backend Event Bus**:
* **Purpose**: Decouple modules. For example, when `UserService` creates a user, it emits a `user.created` event. `NotificationService` and `AnalyticsService` might subscribe to this event to send a welcome notification and log the event, without `UserService` needing to know about them directly.
* **How it Relates to Real-time**: Backend events can *trigger* real-time client events. E.g., `FriendService` emits `friendship.requested` internally -> `NotificationService` handles this internal event -> `NotificationService` then uses `SocketManager` to send a `notification:new` (a real-time client event) to the relevant user.
* **Tools**: Node.js `EventEmitter` (for in-process), or for more complex needs or future microservices, a message queue/broker.
* **If Referring to a Wrapper around Socket.IO Emits (less likely for this title)**:
* Could be a `SocketManager` service that standardizes how other services emit events to clients via Socket.IO, ensuring consistent room targeting, payload structure, etc. This `SocketManager` would use the actual Socket.IO server instance.
* **Maoga Context**:
* An internal event bus (`src/services/event/eventEmitter.js` is in project structure) is a good pattern for decoupling modules as the application grows.
* This internal event bus should be distinct from the Socket.IO server instance which handles client-facing real-time events.
* The `SocketManager` (as planned in Sprint 6 and `real-time-communication.md`) is the service responsible for interacting with the Socket.IO server instance to send messages to clients.

## 6. WebSocket Integration Points
### 6.1 Authentication Integration
**Thoughts/Considerations regarding Authentication Integration**:
* **Purpose**: To ensure that only authenticated users can establish and use Socket.IO connections for features like chat, lobby updates, and receiving personalized notifications.
* **Method**: JWT-based authentication, consistent with API authentication.
* **Implementation**:
1.  **Client Sends Token**: When the client initiates a Socket.IO connection, it should send the JWT (obtained via API login/registration) as part of the connection handshake. Common ways:
* In `auth` option of `io({ auth: { token: 'jwt_token_here' } })` (Socket.IO v3+).
* As a query parameter in the connection URL (less recommended as tokens can be logged).
2.  **Server-Side Middleware (Socket.IO)**: Socket.IO server instance can use middleware (`socket.server.use(...)`) to intercept new connections.
* This middleware extracts the token.
* Verifies the JWT (using the same logic/secret as API auth).
* If valid, attaches user information (e.g., `userId`, `role`) to the `socket` object (`socket.user = decodedToken;`).
* If invalid, rejects the connection (`next(new Error('Authentication error'))`).
3.  **User-Specific Room**: After successful authentication in the middleware, join the socket to a user-specific room (e.g., `socket.join('user:' + socket.user.id);`). This is crucial for targeted real-time updates like notifications.
* **Token Expiry & Refresh**: Socket.IO connections can be long-lived.
* If the JWT expires during an active connection, subsequent actions requiring auth might fail, or the connection might need to be gracefully re-authenticated.
* Frontends should handle token refresh for the API. If a new JWT is obtained, the Socket.IO connection might need to be disconnected and reconnected with the new token, or a custom event could be implemented to update the token on an existing socket (more complex and potentially less secure). Disconnecting and reconnecting is often simpler.
* **Maoga Context**: This is planned for Sprint 6. Using the `auth` option in the client is the modern way.

### 6.2 Matchmaking Integration
**Thoughts/Considerations regarding Matchmaking Integration**:
* **Purpose**: To provide users with real-time feedback during the matchmaking process.
* **Key Interactions**:
1.  **Initiation**: User initiates matchmaking via an API call (`POST /api/matchmaking`). This API call returns a `matchRequestId`.
2.  **Subscription**: Client, after getting `matchRequestId`, sends a Socket.IO event (e.g., `matchmaking:subscribe { matchRequestId }`) to the server. (Covered in 3.3)
3.  **Server-Side Logic**:
* `MatchmakingService` handles the core algorithm.
* As the service processes the request (e.g., initial search, criteria relaxation, potential match found, actual match made), it should trigger events.
* These internal events are then translated into Socket.IO emissions by a `SocketManager` or similar, targeted at the specific user or `matchRequestId` room.
4.  **Client Updates**: Client listens for events like `matchmaking:status`, `matchmaking:matched`, `matchmaking:cancelled`.
* **Events (Server to Client)**:
* `matchmaking:status`: Periodic updates (search time, criteria level, etc.).
* `matchmaking:matched`: Notifies user a match is found, provides `lobbyId`.
* `matchmaking:cancelled`: Confirms cancellation.
* `matchmaking:error`: If an error occurs.
* **Decoupling**: `MatchmakingService` itself shouldn't directly depend on Socket.IO. It should use an abstraction (like an internal event bus or call a `NotificationService`/`RealtimeUpdateService`) which then handles the Socket.IO emission. This keeps the core logic clean.
* **Maoga Context**: The flow described aligns with Sprint 5 (Matchmaking Foundation) and Sprint 6 (Real-time Communication).

### 6.3 Lobby Integration
**Thoughts/Considerations regarding Lobby Integration**:
* **Purpose**: To keep all lobby members' UI in sync with the lobby's state (members, ready status, chat, game start, etc.).
* **Key Interactions**:
1.  **Lobby Creation/Joining**: When a match is made, `LobbyService` creates a lobby. Users are directed to this lobby (e.g., client navigates to lobby view upon `matchmaking:matched` event).
2.  **Subscription**: When a client's UI loads a lobby, it should inform the server it's now actively viewing that lobby (e.g., `lobby:subscribe { lobbyId }`). The server adds this client's socket to the `lobby:${lobbyId}` Socket.IO room.
3.  **Server-Side Logic**: `LobbyService` manages lobby state. Any action that changes the lobby state (member join/leave, ready status change, host change, settings update, lobby closed) should:
* Update the lobby data in MongoDB.
* Trigger an event (e.g., via `SocketManager`) to broadcast the change to all sockets in the `lobby:${lobbyId}` room.
4.  **Client Updates**: Clients listen for `lobby:update`, `lobby:member:joined`, `lobby:member:left`, etc., and update their UI accordingly.
5.  **Lobby Chat**: Chat messages within the lobby are also sent via Socket.IO, scoped to the lobby's chat room. (Covered by Chat Event Handler)
* **Events (Server to Client, to lobby room)**:
* `lobby:update` (full or partial lobby state).
* `lobby:member:joined` / `lobby:member:left` / `lobby:member:kicked`.
* `lobby:member:ready`.
* `lobby:host:changed`.
* `lobby:closed`.
* **Maoga Context**: This is core to the user experience after a match. Sprint 7 (Lobby System) details this. The `LobbyService` will be the main driver of these real-time updates through a `SocketManager`.

## 7. Scaling Considerations
### 7.1 Handling Multiple Server Instances
When running multiple server instances, Socket.IO connections need to be properly coordinated. Redis adapter helps with this.

### 7.2 Connection Load Balancing
When using a load balancer, ensure sticky sessions are enabled:

## 8. Testing Real-time Features
### 8.1 Socket.IO Client Testing Utility
**Thoughts/Considerations regarding Socket.IO Client Testing Utility**:
* **Purpose**: To facilitate automated testing (integration or E2E tests) of your Socket.IO event handlers and real-time features.
* **Tool**: Use the official `socket.io-client` library in your test environment (e.g., within Mocha/Chai tests).
* **Key Features of Utility/Helper**:
* **Connection Management**: Helper functions to easily connect a test client to your Socket.IO server (running as part of the test setup). Needs to handle authentication (passing test JWTs).
* **Event Emission**: Functions to simulate a client emitting an event to the server (e.g., `testClient.emit('chat:message', { ... })`).
* **Event Listening**: Functions to allow tests to listen for specific events from the server and assert their payloads. This often involves promises to handle asynchronous nature of events:
```javascript
// Conceptual
async function waitForEvent(socket, eventName) {
  return new Promise(resolve => {
    socket.once(eventName, (data) => resolve(data));
  });
}
// const messageData = await waitForEvent(testClientSocket, 'chat:message');
// expect(messageData.content).to.equal('Hello');
```
* **Room Logic Testing**: May need ways to assert that sockets have joined or left specific rooms (though this might be harder to directly test from client-side, could be inferred from broadcast behavior).
* **Multiple Clients**: Ability to easily spin up multiple connected test clients to simulate interactions (e.g., two users in a chat, multiple users in a lobby).
* **Authentication**: Easily pass authentication tokens for test clients.
* **Test Setup**:
* Your tests will need to start your Express/Socket.IO server.
* Use a different port for testing to avoid conflicts.
* Connect test clients to this server instance.
* **Maoga Context**: Essential for verifying real-time functionality. Planned for `testing-strategy.md` and key for Sprint 6 (Real-time Communication) delivery.
