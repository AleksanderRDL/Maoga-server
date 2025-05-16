# Real-time Communication Implementation

This document provides technical details for implementing the real-time communication features of the gaming matchmaking platform using Socket.IO.

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

```javascript
// src/services/socket/socketManager.js
const socketIO = require('socket.io');
const redisAdapter = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');
const { User } = require('../../modules/user/models');

class SocketManager {
  constructor(server) {
    // Create Redis pub/sub clients
    const pubClient = createClient({ url: config.redis.url });
    const subClient = pubClient.duplicate();
    
    // Initialize Socket.IO
    this.io = socketIO(server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 10000,
      pingInterval: 25000
    });
    
    // Apply Redis adapter
    this.io.adapter(redisAdapter(pubClient, subClient));
    
    // User mapping (userId -> socketId[])
    this.userSockets = new Map();
    
    // Initialize socket handlers
    this.initializeHandlers();
  }
  
  initializeHandlers() {
    // Authenticate socket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication error: Token missing'));
        }
        
        // Verify JWT token
        const decoded = jwt.verify(token, config.jwt.secret);
        
        // Get user from database
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }
        
        if (user.accountStatus !== 'active') {
          return next(new Error(`Account is ${user.accountStatus}`));
        }
        
        // Attach user to socket
        socket.user = user;
        
        next();
      } catch (err) {
        logger.error('Socket authentication error', { error: err.message });
        next(new Error('Authentication error: Invalid token'));
      }
    });
    
    // Handle connections
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }
  
  handleConnection(socket) {
    const userId = socket.user._id.toString();
    logger.info(`User connected: ${userId}`, { socketId: socket.id });
    
    // Store socket reference
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    
    // Join user's personal room
    socket.join(`user:${userId}`);
    
    // Update user's online status
    this.updateUserStatus(userId, 'online');
    
    // Set up event handlers
    this.setupEventHandlers(socket);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }
  
  handleDisconnection(socket) {
    const userId = socket.user._id.toString();
    logger.info(`User disconnected: ${userId}`, { socketId: socket.id });
    
    // Remove socket reference
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);
      
      // If no more active sockets, update status to offline
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
        this.updateUserStatus(userId, 'offline');
      }
    }
  }
  
  setupEventHandlers(socket) {
    // Register module event handlers
    require('./handlers/chatHandler')(socket, this);
    require('./handlers/lobbyHandler')(socket, this);
    require('./handlers/matchmakingHandler')(socket, this);
    
    // Handle presence events
    socket.on('user:status', (data) => {
      this.updateUserStatus(socket.user._id.toString(), data.status);
    });
  }
  
  async updateUserStatus(userId, status) {
    try {
      // Update user status in database
      await User.findByIdAndUpdate(userId, { 
        status, 
        lastActive: new Date() 
      });
      
      // Notify friends about status change
      this.notifyFriendsAboutStatusChange(userId, status);
    } catch (err) {
      logger.error('Error updating user status', { userId, error: err.message });
    }
  }
  
  async notifyFriendsAboutStatusChange(userId, status) {
    try {
      // Get user's friends
      const friends = await getFriendsList(userId);
      
      // Notify each friend
      for (const friendId of friends) {
        this.io.to(`user:${friendId}`).emit('user:status', {
          userId,
          status,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.error('Error notifying friends about status change', { userId, error: err.message });
    }
  }
  
  // Send event to specific user
  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
  
  // Send event to multiple users
  sendToUsers(userIds, event, data) {
    for (const userId of userIds) {
      this.sendToUser(userId, event, data);
    }
  }
  
  // Send event to all room members
  sendToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }
  
  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }
  
  // Get online status of multiple users
  getUsersOnlineStatus(userIds) {
    const statuses = {};
    
    for (const userId of userIds) {
      statuses[userId] = this.isUserOnline(userId);
    }
    
    return statuses;
  }
}

module.exports = SocketManager;
```

## 3. Event Handlers

### 3.1 Chat Event Handler

```javascript
// src/services/socket/handlers/chatHandler.js
const { Chat, Message } = require('../../../modules/chat/models');
const { isUserInLobby } = require('../../../modules/lobby/services/lobbyService');
const logger = require('../../../utils/logger');

module.exports = function(socket, socketManager) {
  // Join a chat room
  socket.on('chat:join', async ({ chatId }) => {
    try {
      const userId = socket.user._id;
      
      // Check if user has access to this chat
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { 
          code: 'CHAT_NOT_FOUND', 
          message: 'Chat not found' 
        });
      }
      
      let hasAccess = false;
      
      if (chat.chatType === 'direct') {
        // For direct chats, check if user is a participant
        hasAccess = chat.participants.some(p => p.equals(userId));
      } else if (chat.chatType === 'lobby') {
        // For lobby chats, check if user is in the lobby
        hasAccess = await isUserInLobby(userId, chat.lobbyId);
      }
      
      if (!hasAccess) {
        return socket.emit('error', { 
          code: 'ACCESS_DENIED', 
          message: 'You do not have access to this chat' 
        });
      }
      
      // Join the chat room
      socket.join(`chat:${chatId}`);
      
      // Send joined event
      socket.emit('chat:joined', { chatId });
      
      // Optionally, notify other participants
      socket.to(`chat:${chatId}`).emit('chat:member:joined', {
        chatId,
        user: {
          id: userId,
          username: socket.user.username
        }
      });
    } catch (err) {
      logger.error('Error in chat:join', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'JOIN_ERROR', 
        message: 'Failed to join chat' 
      });
    }
  });
  
  // Leave a chat room
  socket.on('chat:leave', ({ chatId }) => {
    socket.leave(`chat:${chatId}`);
    
    // Notify other participants
    socket.to(`chat:${chatId}`).emit('chat:member:left', {
      chatId,
      user: {
        id: socket.user._id,
        username: socket.user.username
      }
    });
  });
  
  // Send a chat message
  socket.on('chat:message', async ({ chatId, content, contentType = 'text' }) => {
    try {
      const userId = socket.user._id;
      
      // Check if user is in the chat room
      const rooms = Array.from(socket.rooms);
      if (!rooms.includes(`chat:${chatId}`)) {
        return socket.emit('error', { 
          code: 'NOT_IN_CHAT', 
          message: 'You must join the chat before sending messages' 
        });
      }
      
      // Create message
      const message = await Message.create({
        chatId,
        senderId: userId,
        content,
        contentType,
        createdAt: new Date()
      });
      
      // Update chat's last message time
      await Chat.findByIdAndUpdate(chatId, { 
        lastMessageAt: new Date() 
      });
      
      // Emit message to all chat participants
      socketManager.io.to(`chat:${chatId}`).emit('chat:message', {
        chatId,
        message: {
          id: message._id,
          sender: {
            id: userId,
            username: socket.user.username,
            displayName: socket.user.displayName
          },
          content: message.content,
          contentType: message.contentType,
          createdAt: message.createdAt
        }
      });
      
      // Mark as read for sender
      await markMessageAsRead(chatId, userId, message._id);
    } catch (err) {
      logger.error('Error in chat:message', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'MESSAGE_ERROR', 
        message: 'Failed to send message' 
      });
    }
  });
  
  // User typing indicator
  socket.on('chat:typing', ({ chatId, isTyping }) => {
    // Broadcast typing status to other chat participants
    socket.to(`chat:${chatId}`).emit('chat:typing', {
      chatId,
      user: {
        id: socket.user._id,
        username: socket.user.username
      },
      isTyping
    });
  });
  
  // Mark messages as read
  socket.on('chat:read', async ({ chatId }) => {
    try {
      const userId = socket.user._id;
      
      // Mark all messages in the chat as read for this user
      await markAllMessagesAsRead(chatId, userId);
      
      // Notify other participants
      socket.to(`chat:${chatId}`).emit('chat:read', {
        chatId,
        userId: userId.toString()
      });
    } catch (err) {
      logger.error('Error in chat:read', { error: err.message, userId: socket.user._id });
    }
  });
};

// Helper function to mark message as read
async function markMessageAsRead(chatId, userId, messageId) {
  await Message.findByIdAndUpdate(messageId, {
    $addToSet: { readBy: userId }
  });
}

// Helper function to mark all messages in a chat as read
async function markAllMessagesAsRead(chatId, userId) {
  await Message.updateMany(
    { chatId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
}
```

### 3.2 Lobby Event Handler

```javascript
// src/services/socket/handlers/lobbyHandler.js
const { Lobby } = require('../../../modules/lobby/models');
const { isUserInLobby, getLobbyMembers } = require('../../../modules/lobby/services/lobbyService');
const logger = require('../../../utils/logger');

module.exports = function(socket, socketManager) {
  // Join a lobby
  socket.on('lobby:join', async ({ lobbyId }) => {
    try {
      const userId = socket.user._id;
      
      // Check if user has access to this lobby
      const hasAccess = await isUserInLobby(userId, lobbyId);
      
      if (!hasAccess) {
        return socket.emit('error', { 
          code: 'ACCESS_DENIED', 
          message: 'You do not have access to this lobby' 
        });
      }
      
      // Join the lobby room
      socket.join(`lobby:${lobbyId}`);
      
      // Send joined event
      socket.emit('lobby:joined', { lobbyId });
      
      // Notify other lobby members
      socket.to(`lobby:${lobbyId}`).emit('lobby:member:joined', {
        lobbyId,
        user: {
          id: userId,
          username: socket.user.username,
          displayName: socket.user.displayName
        }
      });
      
      // Automatically join associated chat
      const lobby = await Lobby.findById(lobbyId);
      if (lobby && lobby.chat && lobby.chat.enabled) {
        // Join lobby chat
        socket.emit('chat:join', { chatId: `lobby:${lobbyId}` });
      }
    } catch (err) {
      logger.error('Error in lobby:join', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'JOIN_ERROR', 
        message: 'Failed to join lobby' 
      });
    }
  });
  
  // Leave a lobby
  socket.on('lobby:leave', ({ lobbyId }) => {
    socket.leave(`lobby:${lobbyId}`);
    
    // Notify other members
    socket.to(`lobby:${lobbyId}`).emit('lobby:member:left', {
      lobbyId,
      user: {
        id: socket.user._id,
        username: socket.user.username
      }
    });
    
    // Also leave the associated chat
    socket.leave(`chat:lobby:${lobbyId}`);
  });
  
  // Update ready status
  socket.on('lobby:ready', async ({ lobbyId, isReady }) => {
    try {
      const userId = socket.user._id;
      
      // Update ready status in database
      const lobby = await Lobby.findOneAndUpdate(
        { 
          _id: lobbyId, 
          'members.userId': userId 
        },
        { 
          $set: { 'members.$.readyStatus': isReady } 
        },
        { new: true }
      );
      
      if (!lobby) {
        return socket.emit('error', { 
          code: 'LOBBY_ERROR', 
          message: 'Failed to update ready status' 
        });
      }
      
      // Broadcast ready status to all lobby members
      socketManager.sendToRoom(`lobby:${lobbyId}`, 'lobby:member:ready', {
        lobbyId,
        user: {
          id: userId,
          username: socket.user.username
        },
        isReady
      });
      
      // Check if all members are ready
      const allReady = lobby.members.every(member => member.readyStatus === true);
      
      if (allReady && lobby.members.length >= lobby.capacity.min) {
        // All members are ready - update lobby status
        lobby.status = 'ready';
        await lobby.save();
        
        // Notify all members
        socketManager.sendToRoom(`lobby:${lobbyId}`, 'lobby:ready', {
          lobbyId,
          readyAt: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.error('Error in lobby:ready', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'READY_ERROR', 
        message: 'Failed to update ready status' 
      });
    }
  });
  
  // Kick member (host only)
  socket.on('lobby:kick', async ({ lobbyId, userId: targetUserId }) => {
    try {
      const userId = socket.user._id;
      
      // Check if user is the host
      const lobby = await Lobby.findById(lobbyId);
      
      if (!lobby) {
        return socket.emit('error', { 
          code: 'LOBBY_NOT_FOUND', 
          message: 'Lobby not found' 
        });
      }
      
      const isHost = lobby.members.some(m => m.userId.equals(userId) && m.isHost);
      
      if (!isHost) {
        return socket.emit('error', { 
          code: 'NOT_HOST', 
          message: 'Only the host can kick members' 
        });
      }
      
      // Update member status to kicked
      await Lobby.findOneAndUpdate(
        { _id: lobbyId, 'members.userId': targetUserId },
        { 
          $set: { 
            'members.$.status': 'kicked',
            'members.$.leftAt': new Date()
          } 
        }
      );
      
      // Notify all members
      socketManager.sendToRoom(`lobby:${lobbyId}`, 'lobby:member:kicked', {
        lobbyId,
        userId: targetUserId
      });
      
      // Force disconnect the kicked user from the lobby
      socketManager.sendToUser(targetUserId, 'lobby:kicked', {
        lobbyId,
        reason: 'You have been kicked from the lobby'
      });
    } catch (err) {
      logger.error('Error in lobby:kick', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'KICK_ERROR', 
        message: 'Failed to kick member' 
      });
    }
  });
  
  // Other lobby events...
};
```

### 3.3 Matchmaking Event Handler

```javascript
// src/services/socket/handlers/matchmakingHandler.js
const { MatchRequest } = require('../../../modules/matchmaking/models');
const { getMatchStatus } = require('../../../modules/matchmaking/services/matchmakingService');
const logger = require('../../../utils/logger');

module.exports = function(socket, socketManager) {
  // Request matchmaking status updates
  socket.on('matchmaking:subscribe', async ({ requestId }) => {
    try {
      const userId = socket.user._id;
      
      // Check if this match request belongs to the user
      const matchRequest = await MatchRequest.findOne({
        _id: requestId,
        userId
      });
      
      if (!matchRequest) {
        return socket.emit('error', { 
          code: 'MATCH_NOT_FOUND', 
          message: 'Match request not found' 
        });
      }
      
      // Join the match request room
      socket.join(`match:${requestId}`);
      
      // Send initial status
      const status = await getMatchStatus(requestId);
      socket.emit('matchmaking:status', status);
    } catch (err) {
      logger.error('Error in matchmaking:subscribe', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'SUBSCRIPTION_ERROR', 
        message: 'Failed to subscribe to matchmaking updates' 
      });
    }
  });
  
  // Unsubscribe from matchmaking updates
  socket.on('matchmaking:unsubscribe', ({ requestId }) => {
    socket.leave(`match:${requestId}`);
  });
  
  // Cancel matchmaking
  socket.on('matchmaking:cancel', async ({ requestId }) => {
    try {
      const userId = socket.user._id;
      
      // Update match request status
      const matchRequest = await MatchRequest.findOneAndUpdate(
        {
          _id: requestId,
          userId,
          status: 'searching'
        },
        {
          status: 'cancelled',
          updatedAt: new Date()
        },
        { new: true }
      );
      
      if (!matchRequest) {
        return socket.emit('error', { 
          code: 'CANCEL_ERROR', 
          message: 'Match request not found or already matched/cancelled' 
        });
      }
      
      // Notify user
      socket.emit('matchmaking:cancelled', {
        requestId,
        cancelledAt: matchRequest.updatedAt
      });
    } catch (err) {
      logger.error('Error in matchmaking:cancel', { error: err.message, userId: socket.user._id });
      socket.emit('error', { 
        code: 'CANCEL_ERROR', 
        message: 'Failed to cancel matchmaking' 
      });
    }
  });
};
```

## 4. Real-time Notification System

### 4.1 Notification Service

```javascript
// src/services/notification/notificationService.js
const { Notification } = require('../../modules/notification/models');
const { User } = require('../../modules/user/models');
const socketManager = require('../socket/socketManager').getInstance();
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Create a new notification
   * @param {Object} notification - Notification data
   * @param {string} notification.userId - Target user ID
   * @param {string} notification.type - Notification type
   * @param {string} notification.title - Notification title
   * @param {string} notification.message - Notification message
   * @param {Object} notification.data - Additional data
   * @param {Array} notification.deliveryChannels - Delivery channels
   */
  async createNotification(notification) {
    try {
      const { userId, type, title, message, data, deliveryChannels = ['inApp'] } = notification;
      
      // Create the notification
      const newNotification = await Notification.create({
        userId,
        type,
        title,
        message,
        data,
        deliveryChannels,
        status: 'unread',
        deliveryStatus: deliveryChannels.map(channel => ({
          channel,
          status: 'pending'
        })),
        createdAt: new Date()
      });
      
      // Process delivery channels
      for (const channel of deliveryChannels) {
        await this.processDeliveryChannel(newNotification, channel);
      }
      
      // Send real-time notification via WebSocket
      if (deliveryChannels.includes('inApp')) {
        this.sendRealtimeNotification(userId, newNotification);
      }
      
      // Update unread count
      await this.updateUnreadCount(userId);
      
      return newNotification;
    } catch (err) {
      logger.error('Error creating notification', { error: err.message });
      throw err;
    }
  }
  
  /**
   * Process notification delivery for a specific channel
   * @param {Object} notification - Notification object
   * @param {string} channel - Delivery channel
   */
  async processDeliveryChannel(notification, channel) {
    try {
      switch (channel) {
        case 'inApp':
          // In-app notifications are handled via WebSocket
          await this.markChannelDelivered(notification._id, channel);
          break;
        case 'push':
          // Send push notification
          await this.sendPushNotification(notification);
          break;
        case 'email':
          // Send email notification
          await this.sendEmailNotification(notification);
          break;
        default:
          logger.warn(`Unknown delivery channel: ${channel}`);
      }
    } catch (err) {
      logger.error(`Error processing delivery channel ${channel}`, { 
        error: err.message, 
        notificationId: notification._id 
      });
      
      // Mark as failed
      await this.markChannelFailed(notification._id, channel, err.message);
    }
  }
  
  /**
   * Mark a delivery channel as delivered
   * @param {string} notificationId - Notification ID
   * @param {string} channel - Delivery channel
   */
  async markChannelDelivered(notificationId, channel) {
    await Notification.findOneAndUpdate(
      { 
        _id: notificationId, 
        'deliveryStatus.channel': channel 
      },
      { 
        $set: { 
          'deliveryStatus.$.status': 'sent',
          'deliveryStatus.$.sentAt': new Date()
        } 
      }
    );
  }
  
  /**
   * Mark a delivery channel as failed
   * @param {string} notificationId - Notification ID
   * @param {string} channel - Delivery channel
   * @param {string} errorMessage - Error message
   */
  async markChannelFailed(notificationId, channel, errorMessage) {
    await Notification.findOneAndUpdate(
      { 
        _id: notificationId, 
        'deliveryStatus.channel': channel 
      },
      { 
        $set: { 
          'deliveryStatus.$.status': 'failed',
          'deliveryStatus.$.error': errorMessage
        } 
      }
    );
  }
  
  /**
   * Send real-time notification via WebSocket
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   */
  sendRealtimeNotification(userId, notification) {
    socketManager.sendToUser(userId, 'notification:new', {
      notification: {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt
      }
    });
  }
  
  /**
   * Update and send unread notification count
   * @param {string} userId - User ID
   */
  async updateUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        userId,
        status: 'unread'
      });
      
      const total = await Notification.countDocuments({ userId });
      
      // Send count update via WebSocket
      socketManager.sendToUser(userId, 'notification:count', {
        total,
        unread: count
      });
      
      return { total, unread: count };
    } catch (err) {
      logger.error('Error updating notification count', { error: err.message, userId });
      throw err;
    }
  }
  
  /**
   * Mark notification as read
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   */
  async markAsRead(userId, notificationId) {
    try {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { 
          status: 'read',
          updatedAt: new Date()
        }
      );
      
      // Update unread count
      await this.updateUnreadCount(userId);
    } catch (err) {
      logger.error('Error marking notification as read', { 
        error: err.message, 
        userId, 
        notificationId 
      });
      throw err;
    }
  }
  
  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   */
  async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { userId, status: 'unread' },
        { 
          status: 'read',
          updatedAt: new Date()
        }
      );
      
      // Update unread count
      await this.updateUnreadCount(userId);
    } catch (err) {
      logger.error('Error marking all notifications as read', { 
        error: err.message, 
        userId 
      });
      throw err;
    }
  }
  
  /**
   * Send push notification
   * @param {Object} notification - Notification object
   */
  async sendPushNotification(notification) {
    try {
      const user = await User.findById(notification.userId);
      
      if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
        throw new Error('No device tokens available');
      }
      
      // Send push notification to all user devices
      // Implementation will vary based on push provider (Firebase, OneSignal, etc.)
      // This is a placeholder
      
      // Mark as delivered
      await this.markChannelDelivered(notification._id, 'push');
    } catch (err) {
      logger.error('Error sending push notification', { 
        error: err.message, 
        notificationId: notification._id 
      });
      throw err;
    }
  }
  
  /**
   * Send email notification
   * @param {Object} notification - Notification object
   */
  async sendEmailNotification(notification) {
    try {
      const user = await User.findById(notification.userId);
      
      if (!user || !user.email) {
        throw new Error('User email not available');
      }
      
      // Send email notification
      // Implementation will vary based on email provider
      // This is a placeholder
      
      // Mark as delivered
      await this.markChannelDelivered(notification._id, 'email');
    } catch (err) {
      logger.error('Error sending email notification', { 
        error: err.message, 
        notificationId: notification._id 
      });
      throw err;
    }
  }
}

module.exports = new NotificationService();
```

## 5. Real-time Event System

### 5.1 Event Emitter Service

```javascript
// src/services/event/eventEmitter.js
const EventEmitter = require('events');
const redisClient = require('../../config/redis');
const logger = require('../../utils/logger');

// Main event emitter
const eventEmitter = new EventEmitter();

// Event handlers
const eventHandlers = {
  // User events
  'user.registered': require('./handlers/userEventHandlers').onUserRegistered,
  'user.profile.updated': require('./handlers/userEventHandlers').onUserProfileUpdated,
  
  // Friendship events
  'friendship.requested': require('./handlers/friendshipEventHandlers').onFriendshipRequested,
  'friendship.accepted': require('./handlers/friendshipEventHandlers').onFriendshipAccepted,
  'friendship.rejected': require('./handlers/friendshipEventHandlers').onFriendshipRejected,
  
  // Matchmaking events
  'matchmaking.started': require('./handlers/matchmakingEventHandlers').onMatchmakingStarted,
  'matchmaking.matched': require('./handlers/matchmakingEventHandlers').onMatchmakingMatched,
  'matchmaking.cancelled': require('./handlers/matchmakingEventHandlers').onMatchmakingCancelled,
  
  // Lobby events
  'lobby.created': require('./handlers/lobbyEventHandlers').onLobbyCreated,
  'lobby.updated': require('./handlers/lobbyEventHandlers').onLobbyUpdated,
  'lobby.closed': require('./handlers/lobbyEventHandlers').onLobbyClosed,
  'lobby.member.joined': require('./handlers/lobbyEventHandlers').onLobbyMemberJoined,
  'lobby.member.left': require('./handlers/lobbyEventHandlers').onLobbyMemberLeft,
  
  // Chat events
  'chat.message.sent': require('./handlers/chatEventHandlers').onChatMessageSent
};

// Register event handlers
for (const [event, handler] of Object.entries(eventHandlers)) {
  eventEmitter.on(event, handler);
}

// Publish event (local and distributed)
async function publishEvent(eventName, data) {
  try {
    // Emit locally
    eventEmitter.emit(eventName, data);
    
    // Publish to Redis for distributed events
    if (redisClient.isReady) {
      await redisClient.publish('app:events', JSON.stringify({
        event: eventName,
        data,
        timestamp: Date.now()
      }));
    }
    
    logger.debug(`Event published: ${eventName}`, { data });
  } catch (err) {
    logger.error(`Error publishing event ${eventName}`, { error: err.message, data });
  }
}

// Initialize Redis subscriber for distributed events
async function initializeDistributedEvents() {
  try {
    if (!redisClient.isReady) {
      logger.warn('Redis client not ready, distributed events disabled');
      return;
    }
    
    // Create subscriber client
    const subscriber = redisClient.duplicate();
    
    // Subscribe to events channel
    await subscriber.subscribe('app:events', (message) => {
      try {
        const { event, data } = JSON.parse(message);
        
        // Only emit if we have a handler (and not emitted by this instance)
        if (eventHandlers[event]) {
          eventEmitter.emit(event, data);
        }
      } catch (err) {
        logger.error('Error processing distributed event', { error: err.message });
      }
    });
    
    logger.info('Distributed event system initialized');
  } catch (err) {
    logger.error('Error initializing distributed events', { error: err.message });
  }
}

module.exports = {
  publishEvent,
  initializeDistributedEvents
};
```

## 6. WebSocket Integration Points

### 6.1 Authentication Integration

```javascript
// src/modules/auth/controllers/authController.js

// Add to login function
exports.login = async (req, res, next) => {
  try {
    // Existing login logic...
    
    // Record last login and device info
    user.lastActive = Date.now();
    user.lastLoginIp = req.ip;
    user.lastLoginUserAgent = req.headers['user-agent'];
    await user.save();
    
    // Update user status via WebSocket (if connected with other devices)
    const socketManager = require('../../../services/socket/socketManager').getInstance();
    socketManager.updateUserStatus(user._id.toString(), 'online');
    
    // Return response...
  } catch (err) {
    next(err);
  }
};
```

### 6.2 Matchmaking Integration

```javascript
// src/modules/matchmaking/services/matchmakingService.js

// Add to processMatchQueue function
async function processMatchQueue(gameId, gameMode, region) {
  try {
    // Existing matchmaking logic...
    
    // When matches are formed, notify users via WebSocket
    const socketManager = require('../../../services/socket/socketManager').getInstance();
    
    // For each formed match, notify all participants
    for (const match of formedMatches) {
      for (const userId of match.userIds) {
        socketManager.sendToUser(userId, 'matchmaking:matched', {
          requestId: match.requestId,
          lobbyId: match.lobbyId,
          matchedAt: new Date().toISOString()
        });
      }
    }
    
    // Return result...
  } catch (err) {
    logger.error('Error processing match queue', { error: err.message });
    throw err;
  }
}
```

### 6.3 Lobby Integration

```javascript
// src/modules/lobby/services/lobbyService.js

// Add to updateLobby function
async function updateLobby(lobbyId, updateData, userId) {
  try {
    // Check if user is host...
    
    // Update lobby...
    
    // Notify all lobby members about the update
    const socketManager = require('../../../services/socket/socketManager').getInstance();
    
    socketManager.sendToRoom(`lobby:${lobbyId}`, 'lobby:update', {
      lobbyId,
      update: {
        // Relevant update fields
        status: lobby.status,
        settings: lobby.lobbySettings,
        updatedAt: lobby.updatedAt
      }
    });
    
    // Return updated lobby...
  } catch (err) {
    logger.error('Error updating lobby', { error: err.message, lobbyId });
    throw err;
  }
}
```

## 7. Scaling Considerations

### 7.1 Handling Multiple Server Instances

When running multiple server instances, Socket.IO connections need to be properly coordinated. Redis adapter helps with this:

```javascript
// src/config/redis.js
const { createClient } = require('redis');
const config = require('./index');

let redisClient = null;

async function initializeRedis() {
  try {
    redisClient = createClient({
      url: config.redis.url,
      password: config.redis.password
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis client error', err);
    });
    
    await redisClient.connect();
    console.log('Connected to Redis');
    
    return redisClient;
  } catch (err) {
    console.error('Redis initialization error:', err);
    throw err;
  }
}

async function getRedisClient() {
  if (!redisClient || !redisClient.isReady) {
    await initializeRedis();
  }
  return redisClient;
}

module.exports = {
  initializeRedis,
  getRedisClient
};
```

### 7.2 Connection Load Balancing

When using a load balancer, ensure sticky sessions are enabled:

```javascript
// src/server.js
const app = require('./app');
const http = require('http');
const server = http.createServer(app);
const SocketManager = require('./services/socket/socketManager');
const { initializeRedis } = require('./config/redis');
const { initializeDistributedEvents } = require('./services/event/eventEmitter');
const config = require('./config');

async function startServer() {
  try {
    // Initialize Redis
    await initializeRedis();
    
    // Initialize distributed event system
    await initializeDistributedEvents();
    
    // Initialize Socket.IO
    const socketManager = new SocketManager(server);
    
    // Start HTTP server
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

startServer();
```

## 8. Testing Real-time Features

### 8.1 Socket.IO Client Testing Utility

```javascript
// test/utils/socketClient.js
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');

/**
 * Create a test socket client
 * @param {Object} user - User object
 * @param {string} url - Server URL
 * @returns {Object} Socket.IO client
 */
function createSocketClient(user, url = 'http://localhost:3000') {
  // Generate token for authentication
  const token = jwt.sign({ id: user._id }, config.jwt.secret, {
    expiresIn: '1h'
  });
  
  // Create socket client
  const socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });
  
  return socket;
}

/**
 * Create multiple test socket clients
 * @param {Array} users - Array of user objects
 * @param {string} url - Server URL
 * @returns {Array} Array of Socket.IO clients
 */
function createSocketClients(users, url = 'http://localhost:3000') {
  return users.map(user => createSocketClient(user, url));
}

/**
 * Wait for a specific event
 * @param {Object} socket - Socket.IO client
 * @param {string} event - Event name
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Promise resolving to event data
 */
function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Close socket clients
 * @param {Array} sockets - Array of Socket.IO clients
 */
function closeSocketClients(sockets) {
  sockets.forEach(socket => {
    if (socket.connected) {
      socket.disconnect();
    }
  });
}

module.exports = {
  createSocketClient,
  createSocketClients,
  waitForEvent,
  closeSocketClients
};
```

### 8.2 Example Real-time Integration Test

```javascript
// test/integration/chat.test.js
const { expect } = require('chai');
const mongoose = require('mongoose');
const { createSocketClient, waitForEvent, closeSocketClients } = require('../utils/socketClient');
const { createTestUser, createTestLobby } = require('../utils/testHelpers');
const app = require('../../src/app');
const http = require('http');
const SocketManager = require('../../src/services/socket/socketManager');

describe('Chat Integration Tests', () => {
  let server;
  let socketManager;
  let users = [];
  let sockets = [];
  let lobby;
  
  before(async () => {
    // Start server
    server = http.createServer(app);
    socketManager = new SocketManager(server);
    server.listen(3001);
    
    // Create test users
    users = await Promise.all([
      createTestUser({ username: 'testuser1' }),
      createTestUser({ username: 'testuser2' })
    ]);
    
    // Create test lobby
    lobby = await createTestLobby({
      members: [
        { userId: users[0]._id, isHost: true },
        { userId: users[1]._id, isHost: false }
      ]
    });
  });
  
  beforeEach(async () => {
    // Create socket clients for each test
    sockets = users.map(user => createSocketClient(user, 'http://localhost:3001'));
    
    // Wait for connections
    await Promise.all(sockets.map(socket => 
      new Promise(resolve => socket.on('connect', resolve))
    ));
  });
  
  afterEach(() => {
    // Close socket clients after each test
    closeSocketClients(sockets);
    sockets = [];
  });
  
  after(async () => {
    // Close server and database connection
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.close();
  });
  
  it('should allow users to join a lobby chat', async () => {
    // User 1 joins lobby
    sockets[0].emit('lobby:join', { lobbyId: lobby._id.toString() });
    
    // Wait for lobby joined event
    const joinedEvent = await waitForEvent(sockets[0], 'lobby:joined');
    expect(joinedEvent).to.have.property('lobbyId').equal(lobby._id.toString());
    
    // User 1 joins lobby chat
    sockets[0].emit('chat:join', { chatId: `lobby:${lobby._id.toString()}` });
    
    // Wait for chat joined event
    const chatJoinedEvent = await waitForEvent(sockets[0], 'chat:joined');
    expect(chatJoinedEvent).to.have.property('chatId').equal(`lobby:${lobby._id.toString()}`);
  });
  
  it('should broadcast messages to all users in a chat', async () => {
    // Both users join lobby and chat
    for (const socket of sockets) {
      socket.emit('lobby:join', { lobbyId: lobby._id.toString() });
      await waitForEvent(socket, 'lobby:joined');
      
      socket.emit('chat:join', { chatId: `lobby:${lobby._id.toString()}` });
      await waitForEvent(socket, 'chat:joined');
    }
    
    // Set up promise to wait for message on second user
    const messagePromise = waitForEvent(sockets[1], 'chat:message');
    
    // First user sends a message
    sockets[0].emit('chat:message', {
      chatId: `lobby:${lobby._id.toString()}`,
      content: 'Hello, world!',
      contentType: 'text'
    });
    
    // Wait for message to be received
    const messageEvent = await messagePromise;
    
    // Verify message content
    expect(messageEvent).to.have.property('chatId').equal(`lobby:${lobby._id.toString()}`);
    expect(messageEvent).to.have.property('message');
    expect(messageEvent.message).to.have.property('content').equal('Hello, world!');
    expect(messageEvent.message).to.have.property('contentType').equal('text');
    expect(messageEvent.message.sender).to.have.property('username').equal(users[0].username);
  });
  
  it('should show typing indicators', async () => {
    // Both users join lobby and chat
    for (const socket of sockets) {
      socket.emit('lobby:join', { lobbyId: lobby._id.toString() });
      await waitForEvent(socket, 'lobby:joined');
      
      socket.emit('chat:join', { chatId: `lobby:${lobby._id.toString()}` });
      await waitForEvent(socket, 'chat:joined');
    }
    
    // Set up promise to wait for typing event on second user
    const typingPromise = waitForEvent(sockets[1], 'chat:typing');
    
    // First user sends typing indicator
    sockets[0].emit('chat:typing', {
      chatId: `lobby:${lobby._id.toString()}`,
      isTyping: true
    });
    
    // Wait for typing indicator to be received
    const typingEvent = await typingPromise;
    
    // Verify typing indicator
    expect(typingEvent).to.have.property('chatId').equal(`lobby:${lobby._id.toString()}`);
    expect(typingEvent).to.have.property('user');
    expect(typingEvent.user).to.have.property('username').equal(users[0].username);
    expect(typingEvent).to.have.property('isTyping').equal(true);
  });
});
```

## 9. Client Integration Guidelines

### 9.1 Client Connection Example

```javascript
// Example client-side integration
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.events = {};
  }
  
  // Connect to server
  connect(token) {
    this.socket = io('https://api.gamematch.com', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });
    
    // Set up connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.emit('user:status', { status: 'online' });
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log(`Disconnected: ${reason}`);
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Set up handling for common events
    this.setupEventHandlers();
  }
  
  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  // Send event to server
  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }
  
  // Listen for event
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
    
    return () => this.off(event, callback);
  }
  
  // Remove event listener
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
  
  // Set up handlers for common events
  setupEventHandlers() {
    // Handle notifications
    this.socket.on('notification:new', (data) => {
      console.log('New notification:', data);
      // Dispatch to notification store/handler
    });
    
    this.socket.on('notification:count', (data) => {
      console.log('Notification count:', data);
      // Update UI with new count
    });
    
    // Handle lobby events
    this.socket.on('lobby:update', (data) => {
      console.log('Lobby update:', data);
      // Update lobby state
    });
    
    // Handle user status events
    this.socket.on('user:status', (data) => {
      console.log('User status update:', data);
      // Update friend list UI
    });
    
    // Handle matchmaking events
    this.socket.on('matchmaking:matched', (data) => {
      console.log('Match found:', data);
      // Navigate to lobby or show match notification
    });
  }
  
  // Join a lobby
  joinLobby(lobbyId) {
    this.emit('lobby:join', { lobbyId });
  }
  
  // Leave a lobby
  leaveLobby(lobbyId) {
    this.emit('lobby:leave', { lobbyId });
  }
  
  // Join a chat
  joinChat(chatId) {
    this.emit('chat:join', { chatId });
  }
  
  // Send chat message
  sendMessage(chatId, content, contentType = 'text') {
    this.emit('chat:message', { chatId, content, contentType });
  }
  
  // Subscribe to matchmaking updates
  subscribeToMatchmaking(requestId) {
    this.emit('matchmaking:subscribe', { requestId });
  }
}

export default new SocketService();
```

### 9.2 React Component Integration Example

```jsx
// Example React component using the Socket Service
import React, { useEffect, useState } from 'react';
import socketService from '../services/socketService';

function LobbyChat({ lobbyId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(socketService.socket?.connected || false);
  
  useEffect(() => {
    // Join lobby and chat when component mounts
    socketService.joinLobby(lobbyId);
    socketService.joinChat(`lobby:${lobbyId}`);
    
    // Set up event listeners
    const onChatMessage = (data) => {
      if (data.chatId === `lobby:${lobbyId}`) {
        setMessages(prevMessages => [...prevMessages, data.message]);
      }
    };
    
    const onChatTyping = (data) => {
      if (data.chatId === `lobby:${lobbyId}`) {
        if (data.isTyping) {
          setTypingUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user]);
        } else {
          setTypingUsers(prev => prev.filter(u => u.id !== data.user.id));
        }
      }
    };
    
    const onConnect = () => {
      setIsConnected(true);
      // Rejoin on reconnection
      socketService.joinLobby(lobbyId);
      socketService.joinChat(`lobby:${lobbyId}`);
    };
    
    const onDisconnect = () => {
      setIsConnected(false);
    };
    
    // Register event listeners
    socketService.on('chat:message', onChatMessage);
    socketService.on('chat:typing', onChatTyping);
    socketService.on('connect', onConnect);
    socketService.on('disconnect', onDisconnect);
    
    // Cleanup function
    return () => {
      // Leave lobby and chat when component unmounts
      socketService.leaveLobby(lobbyId);
      
      // Remove event listeners
      socketService.off('chat:message', onChatMessage);
      socketService.off('chat:typing', onChatTyping);
      socketService.off('connect', onConnect);
      socketService.off('disconnect', onDisconnect);
    };
  }, [lobbyId]);
  
  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    
    // Send typing indicator if value changes from empty to non-empty or vice versa
    if ((value === '' && inputValue !== '') || (value !== '' && inputValue === '')) {
      socketService.emit('chat:typing', {
        chatId: `lobby:${lobbyId}`,
        isTyping: value !== ''
      });
    }
    
    setInputValue(value);
  };
  
  // Handle message submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputValue.trim() === '') {
      return;
    }
    
    socketService.sendMessage(`lobby:${lobbyId}`, inputValue);
    
    // Reset input and typing indicator
    setInputValue('');
    socketService.emit('chat:typing', {
      chatId: `lobby:${lobbyId}`,
      isTyping: false
    });
  };
  
  return (
    <div className="lobby-chat">
      <div className="chat-status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={message.id || index} className="chat-message">
            <div className="message-sender">{message.sender.displayName}</div>
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {new Date(message.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
      
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.length === 1
            ? `${typingUsers[0].username} is typing...`
            : `${typingUsers.length} people are typing...`}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || inputValue.trim() === ''}>
          Send
        </button>
      </form>
    </div>
  );
}

export default LobbyChat;
```
