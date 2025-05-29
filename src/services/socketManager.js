// src/services/socketManager.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { AuthenticationError } = require('../utils/errors');
const User = require('../modules/auth/models/User');
const socketMetrics = require('./socketMetrics');

class SocketManager {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set<socketId>
    this.socketUsers = new Map(); // socketId -> userId
    this.rooms = new Map(); // roomId -> Set<socketId>
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.allowedOrigins,
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Socket.IO initialized');
    return this.io;
  }

  /**
   * Setup authentication middleware
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new AuthenticationError('No token provided'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.jwt.secret);

        // Get user from database
        const user = await User.findById(decoded.id).select('username status');

        if (!user || user.status !== 'active') {
          return next(new AuthenticationError('Invalid user'));
        }

        // Attach user info to socket
        socket.userId = user._id.toString();
        socket.user = {
          id: user._id.toString(),
          username: user.username
        };

        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          error: error.message,
          socketId: socket.id
        });
        next(new AuthenticationError('Authentication failed'));
      }
    });
  }

  /**
   * Setup core event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);

      // Core events
      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('error', (error) => this.handleError(socket, error));

      // Matchmaking events
      socket.on('matchmaking:subscribe', (data) => this.handleMatchmakingSubscribe(socket, data));
      socket.on('matchmaking:unsubscribe', (data) =>
        this.handleMatchmakingUnsubscribe(socket, data)
      );

      // User status events
      socket.on('user:status:subscribe', (data) => this.handleUserStatusSubscribe(socket, data));
      socket.on('user:status:unsubscribe', (data) =>
        this.handleUserStatusUnsubscribe(socket, data)
      );
    });
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;

    // Record successful connection
    socketMetrics.recordConnection(true);

    // Add to user sockets mapping
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    // Add to socket users mapping
    this.socketUsers.set(socket.id, userId);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Update user status to online
    this.updateUserStatus(userId, 'online');

    logger.info('Socket connected', {
      socketId: socket.id,
      userId: userId,
      totalUserSockets: this.userSockets.get(userId).size
    });

    // Send connection confirmation
    socket.emit('connected', {
      socketId: socket.id,
      userId: userId
    });
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket) {
    const userId = socket.userId;

    // Remove from mappings
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);

      // If no more sockets for this user, mark offline
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.updateUserStatus(userId, 'offline');
      }
    }

    this.socketUsers.delete(socket.id);

    // Clean up room memberships
    this.cleanupSocketRooms(socket);

    logger.info('Socket disconnected', {
      socketId: socket.id,
      userId: userId,
      remainingUserSockets: userSocketSet ? userSocketSet.size : 0
    });
  }

  /**
   * Handle socket errors
   */
  handleError(socket, error) {
    logger.error('Socket error', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message
    });

    // Record error metric
    socketMetrics.recordError(error);
  }

  /**
   * Handle matchmaking subscription
   */
  handleMatchmakingSubscribe(socket, data) {
    try {
      const { requestId } = data;

      if (!requestId) {
        socket.emit('error', { message: 'Request ID required' });
        return;
      }

      const roomName = `match:${requestId}`;
      socket.join(roomName);

      logger.debug('Socket subscribed to matchmaking', {
        socketId: socket.id,
        userId: socket.userId,
        requestId
      });

      socket.emit('matchmaking:subscribed', { requestId });
    } catch (error) {
      logger.error('Failed to subscribe to matchmaking', {
        error: error.message,
        socketId: socket.id,
        data
      });
      socket.emit('error', { message: 'Failed to subscribe to matchmaking' });
    }
  }

  /**
   * Handle matchmaking unsubscription
   */
  handleMatchmakingUnsubscribe(socket, data) {
    try {
      const { requestId } = data;

      if (!requestId) {
        return;
      }

      const roomName = `match:${requestId}`;
      socket.leave(roomName);

      logger.debug('Socket unsubscribed from matchmaking', {
        socketId: socket.id,
        userId: socket.userId,
        requestId
      });

      socket.emit('matchmaking:unsubscribed', { requestId });
    } catch (error) {
      logger.error('Failed to unsubscribe from matchmaking', {
        error: error.message,
        socketId: socket.id
      });
    }
  }

  /**
   * Handle user status subscription
   */
  handleUserStatusSubscribe(socket, data) {
    try {
      const { userIds } = data;

      if (!Array.isArray(userIds)) {
        socket.emit('error', { message: 'User IDs must be an array' });
        return;
      }

      // Join status rooms for each user
      userIds.forEach((userId) => {
        socket.join(`status:${userId}`);
      });

      // Send current status for requested users
      const statuses = {};
      userIds.forEach((userId) => {
        statuses[userId] = this.userSockets.has(userId) ? 'online' : 'offline';
      });

      socket.emit('user:status:update', { statuses });

      logger.debug('Socket subscribed to user statuses', {
        socketId: socket.id,
        userIds: userIds.length
      });
    } catch (error) {
      logger.error('Failed to subscribe to user status', {
        error: error.message,
        socketId: socket.id
      });
      socket.emit('error', { message: 'Failed to subscribe to user status' });
    }
  }

  /**
   * Handle user status unsubscription
   */
  handleUserStatusUnsubscribe(socket, data) {
    try {
      const { userIds } = data;

      if (!Array.isArray(userIds)) {
        return;
      }

      userIds.forEach((userId) => {
        socket.leave(`status:${userId}`);
      });

      logger.debug('Socket unsubscribed from user statuses', {
        socketId: socket.id,
        userIds: userIds.length
      });
    } catch (error) {
      logger.error('Failed to unsubscribe from user status', {
        error: error.message,
        socketId: socket.id
      });
    }
  }

  /**
   * Update user online status
   */
  updateUserStatus(userId, status) {
    try {
      // Emit to all sockets watching this user's status
      this.io.to(`status:${userId}`).emit('user:status', {
        userId,
        status,
        timestamp: new Date()
      });

      // Update last active in database (non-blocking)
      if (status === 'online') {
        User.findByIdAndUpdate(userId, { lastActive: new Date() }).catch((err) => {
          logger.error('Failed to update user last active', {
            error: err.message,
            userId
          });
        });
      }
    } catch (error) {
      logger.error('Failed to update user status', {
        error: error.message,
        userId,
        status
      });
    }
  }

  /**
   * Emit matchmaking status update
   */
  emitMatchmakingStatus(requestId, statusData) {
    try {
      const roomName = `match:${requestId}`;
      this.io.to(roomName).emit('matchmaking:status', {
        requestId,
        ...statusData,
        timestamp: new Date()
      });

      logger.debug('Emitted matchmaking status', {
        requestId,
        status: statusData.status
      });
    } catch (error) {
      logger.error('Failed to emit matchmaking status', {
        error: error.message,
        requestId
      });
    }
  }

  /**
   * Emit to specific user
   */
  emitToUser(userId, event, data) {
    try {
      const userSocketSet = this.userSockets.get(userId);
      if (!userSocketSet || userSocketSet.size === 0) {
        logger.debug('User not connected, cannot emit', { userId, event });
        return false;
      }

      this.io.to(`user:${userId}`).emit(event, data);
      return true;
    } catch (error) {
      logger.error('Failed to emit to user', {
        error: error.message,
        userId,
        event
      });
      return false;
    }
  }

  /**
   * Emit to multiple users
   */
  emitToUsers(userIds, event, data) {
    const results = new Map();

    userIds.forEach((userId) => {
      results.set(userId, this.emitToUser(userId, event, data));
    });

    return results;
  }

  /**
   * Clean up socket room memberships
   */
  cleanupSocketRooms(socket) {
    // Leave all rooms except default room
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
  }

  /**
   * Get online users from a list
   */
  getOnlineUsers(userIds) {
    return userIds.filter((userId) => this.userSockets.has(userId));
  }

  /**
   * Get socket count for a user
   */
  getUserSocketCount(userId) {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size : 0;
  }

  /**
   * Get total connected users
   */
  getConnectedUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Get total active sockets
   */
  getTotalSocketsCount() {
    return this.socketUsers.size;
  }

  /**
   * Get socket statistics
   */
  getStats() {
    return {
      connectedUsers: this.getConnectedUsersCount(),
      totalSockets: this.getTotalSocketsCount(),
      rooms: this.io.sockets.adapter.rooms.size,
      metrics: socketMetrics.getMetrics(),
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new SocketManager();
