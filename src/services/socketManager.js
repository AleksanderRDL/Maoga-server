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

  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.allowedOrigins,
        credentials: true
      },
      pingTimeout: config.socketIO.pingTimeout, // Use config
      pingInterval: config.socketIO.pingInterval, // Use config
      maxHttpBufferSize: config.socketIO.maxHttpBufferSize, // Use config
      transports: config.socketIO.transports // Use config
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Socket.IO initialized');
    return this.io;
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        logger.debug('Socket middleware: Attempting authentication', {
          socketId: socket.id,
          tokenProvided: !!token
        });

        if (!token) {
          logger.warn('Socket middleware: No token provided', { socketId: socket.id });
          return next(new AuthenticationError('No token provided'));
        }

        const decoded = jwt.verify(token, config.jwt.secret, {
          issuer: config.jwt.issuer,
          audience: config.jwt.audience
        });
        logger.debug('Socket middleware: Token decoded', {
          socketId: socket.id,
          userId: decoded.id
        });

        const user = await User.findById(decoded.id).select('username status role'); // Added role

        if (!user) {
          logger.warn('Socket middleware: User not found for token', {
            socketId: socket.id,
            userId: decoded.id
          });
          return next(new AuthenticationError('Invalid user: not found'));
        }

        if (user.status !== 'active') {
          logger.warn('Socket middleware: User not active', {
            socketId: socket.id,
            userId: user._id.toString(),
            status: user.status
          });
          return next(new AuthenticationError(`Invalid user: account is ${user.status}`));
        }

        socket.userId = user._id.toString();
        socket.user = {
          id: user._id.toString(),
          username: user.username,
          role: user.role // Added role
        };
        logger.info('Socket middleware: Authentication successful', {
          socketId: socket.id,
          userId: socket.userId
        });
        next();
      } catch (error) {
        logger.error('Socket authentication failed in middleware', {
          errorName: error.name,
          errorMessage: error.message,
          socketId: socket.id
          // stack: error.stack // Potentially too verbose for regular logs, but good for targeted debugging
        });
        // Ensure the error passed to next() is an instance of Error
        if (error instanceof AuthenticationError) {
          next(error);
        } else if (error.name === 'TokenExpiredError') {
          next(new AuthenticationError('Authentication failed: Token expired'));
        } else if (error.name === 'JsonWebTokenError') {
          next(new AuthenticationError(`Authentication failed: ${error.message}`));
        } else {
          next(new AuthenticationError('Authentication failed'));
        }
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.debug('Socket connection event received on server', {
        socketId: socket.id,
        userId: socket.userId
      });
      this.handleConnection(socket);

      socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason)); // Added reason
      socket.on('error', (error) => this.handleError(socket, error));

      socket.on('matchmaking:subscribe', (data) => this.handleMatchmakingSubscribe(socket, data));
      socket.on('matchmaking:unsubscribe', (data) =>
        this.handleMatchmakingUnsubscribe(socket, data)
      );

      socket.on('user:status:subscribe', (data) => this.handleUserStatusSubscribe(socket, data));
      socket.on('user:status:unsubscribe', (data) =>
        this.handleUserStatusUnsubscribe(socket, data)
      );
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;

    if (!userId) {
      logger.error(
          'CRITICAL: handleConnection called but socket.userId is missing. Disconnecting socket.',
          { socketId: socket.id }
      );
      socket.disconnect(true);
      return;
    }

    logger.debug(
        `handleConnection: Processing connection for socketId: ${socket.id}, userId: ${userId}`
    );

    socketMetrics.recordConnection(true);

    // Initialize user socket set if needed
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }

    // Add socket to user's set
    this.userSockets.get(userId).add(socket.id);
    this.socketUsers.set(socket.id, userId);

    // Join user-specific room
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    logger.debug(`Socket ${socket.id} joined room ${userRoom} for userId ${userId}`);

    // Update user status to online
    this.updateUserStatus(userId, 'online');

    logger.info('Socket connected and setup complete, emitting "connected" event', {
      socketId: socket.id,
      userId: userId,
      totalUserSockets: this.userSockets.get(userId)?.size || 0
    });

    // CRITICAL: This must always execute - emit the connected event
    socket.emit('connected', {
      socketId: socket.id,
      userId: userId
    });
  }

  handleDisconnect(socket, reason) {
    // Added reason parameter
    const userId = socket.userId || this.socketUsers.get(socket.id); // Fallback if socket.userId was cleared
    logger.info('Socket disconnected', {
      socketId: socket.id,
      userId: userId,
      reason: reason // Log the reason for disconnection
    });

    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        logger.debug(
          `Removed socket ${socket.id} from user ${userId}'s set. Remaining: ${userSocketSet.size}`
        );
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          this.updateUserStatus(userId, 'offline');
          logger.info(`User ${userId} is now offline.`);
        }
      } else {
        logger.warn(
          `User socket set not found for userId ${userId} during disconnect of socket ${socket.id}`
        );
      }
    } else {
      logger.warn(
        `No userId found for disconnecting socket ${socket.id}. Cannot update presence accurately.`
      );
    }

    this.socketUsers.delete(socket.id);
    this.cleanupSocketRooms(socket); // Ensure this is robust
  }

  handleError(socket, error) {
    logger.error('Socket error occurred', {
      // Changed log message for clarity
      socketId: socket.id,
      userId: socket.userId,
      errorName: error.name,
      errorMessage: error.message
      // stack: error.stack // Uncomment for deeper debugging
    });
    socketMetrics.recordError(error);
  }

  handleMatchmakingSubscribe(socket, data) {
    try {
      const { requestId } = data;
      logger.debug('Handling matchmaking:subscribe', {
        socketId: socket.id,
        userId: socket.userId,
        data
      });

      if (!requestId) {
        logger.warn('Matchmaking subscribe attempt with no requestId', {
          socketId: socket.id,
          userId: socket.userId
        });
        socket.emit('error', { message: 'Request ID required for matchmaking subscription' });
        return;
      }

      const roomName = `match:${requestId}`;
      socket.join(roomName);
      this.rooms.set(roomName, (this.rooms.get(roomName) || new Set()).add(socket.id)); // Track room members

      logger.info('Socket subscribed to matchmaking room', {
        socketId: socket.id,
        userId: socket.userId,
        requestId,
        roomName
      });
      socket.emit('matchmaking:subscribed', { requestId });
    } catch (error) {
      logger.error('Failed to subscribe to matchmaking', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
      socket.emit('error', {
        message: 'Failed to subscribe to matchmaking: Internal server error'
      });
    }
  }

  handleMatchmakingUnsubscribe(socket, data) {
    try {
      const { requestId } = data;
      logger.debug('Handling matchmaking:unsubscribe', {
        socketId: socket.id,
        userId: socket.userId,
        data
      });
      if (!requestId) {
        logger.warn('Matchmaking unsubscribe attempt with no requestId', {
          socketId: socket.id,
          userId: socket.userId
        });
        return; // No error event needed as it's a "best effort"
      }

      const roomName = `match:${requestId}`;
      socket.leave(roomName);
      const roomMembers = this.rooms.get(roomName);
      if (roomMembers) {
        roomMembers.delete(socket.id);
        if (roomMembers.size === 0) {
          this.rooms.delete(roomName);
        }
      }

      logger.info('Socket unsubscribed from matchmaking room', {
        // Changed from debug to info
        socketId: socket.id,
        userId: socket.userId,
        requestId,
        roomName
      });
      socket.emit('matchmaking:unsubscribed', { requestId });
    } catch (error) {
      logger.error('Failed to unsubscribe from matchmaking', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
      // Optionally emit error to client if critical
    }
  }

  handleUserStatusSubscribe(socket, data) {
    try {
      const { userIds } = data;
      logger.debug('Handling user:status:subscribe', {
        socketId: socket.id,
        currentUserId: socket.userId,
        data
      });

      if (!Array.isArray(userIds) || userIds.length === 0) {
        logger.warn('User status subscribe attempt with invalid or empty userIds array', {
          socketId: socket.id,
          data
        });
        socket.emit('error', { message: 'User IDs must be a non-empty array' });
        return;
      }

      const statuses = {};
      userIds.forEach((userIdToWatch) => {
        if (typeof userIdToWatch !== 'string') {
          // Basic validation
          logger.warn('Invalid userId found in userIds array for status subscription', {
            socketId: socket.id,
            invalidUserId: userIdToWatch
          });
          return; // Skip invalid userId
        }
        const roomName = `status:${userIdToWatch}`;
        socket.join(roomName);
        this.rooms.set(roomName, (this.rooms.get(roomName) || new Set()).add(socket.id));
        logger.debug(
          `Socket ${socket.id} joined room ${roomName} for watching userId ${userIdToWatch}`
        );
        statuses[userIdToWatch] = this.userSockets.has(userIdToWatch) ? 'online' : 'offline';
      });

      socket.emit('user:status:update', { statuses });
      logger.info('Socket subscribed to user statuses', {
        // Changed from debug to info
        socketId: socket.id,
        userIdsWatched: userIds,
        initialStatusesSent: statuses
      });
    } catch (error) {
      logger.error('Failed to subscribe to user status', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
      socket.emit('error', {
        message: 'Failed to subscribe to user status: Internal server error'
      });
    }
  }

  handleUserStatusUnsubscribe(socket, data) {
    try {
      const { userIds } = data;
      logger.debug('Handling user:status:unsubscribe', {
        socketId: socket.id,
        currentUserId: socket.userId,
        data
      });

      if (!Array.isArray(userIds)) {
        logger.warn('User status unsubscribe attempt with invalid userIds (not an array)', {
          socketId: socket.id,
          data
        });
        return; // No error to client needed, just log
      }

      userIds.forEach((userIdToUnwatch) => {
        if (typeof userIdToUnwatch !== 'string') {
          logger.warn('Invalid userId found in userIds array for status unsubscription', {
            socketId: socket.id,
            invalidUserId: userIdToUnwatch
          });
          return; // Skip invalid userId
        }
        const roomName = `status:${userIdToUnwatch}`;
        socket.leave(roomName);
        const roomMembers = this.rooms.get(roomName);
        if (roomMembers) {
          roomMembers.delete(socket.id);
          if (roomMembers.size === 0) {
            this.rooms.delete(roomName);
          }
        }
        logger.debug(
          `Socket ${socket.id} left room ${roomName} for watching userId ${userIdToUnwatch}`
        );
      });

      logger.info('Socket unsubscribed from user statuses', {
        // Changed from debug to info
        socketId: socket.id,
        userIdsUnwatched: userIds
      });
      // No explicit "unsubscribed" event typically needed for status, client just stops receiving updates.
    } catch (error) {
      logger.error('Failed to unsubscribe from user status', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
    }
  }

  updateUserStatus(userId, status) {
    try {
      const statusRoomName = `status:${userId}`;
      logger.debug(`Updating user status and emitting to room ${statusRoomName}`, {
        userId,
        status
      });
      this.io.to(statusRoomName).emit('user:status', {
        userId,
        status,
        timestamp: new Date()
      });

      if (status === 'online') {
        User.findByIdAndUpdate(userId, { lastActive: new Date() }, { new: true }) // Added new: true
          .exec() // Ensure it's a promise
          .catch((err) => {
            // Added .exec() and ensure proper catch
            logger.error('Failed to update user last active timestamp in DB', {
              error: err.message,
              userId
            });
          });
      }
      logger.info(`User status for ${userId} updated to ${status} and event emitted.`);
    } catch (error) {
      logger.error('Failed to update user status and emit event', {
        error: error.message,
        userId,
        status
      });
    }
  }

  emitMatchmakingStatus(requestId, statusData) {
    try {
      const roomName = `match:${requestId}`;
      logger.debug(`Emitting matchmaking:status to room ${roomName}`, { requestId, statusData });
      this.io.to(roomName).emit('matchmaking:status', {
        requestId,
        ...statusData,
        timestamp: new Date()
      });
      logger.info(`Matchmaking status emitted for requestId ${requestId}: ${statusData.status}`);
    } catch (error) {
      logger.error('Failed to emit matchmaking status', {
        error: error.message,
        requestId,
        statusData
      });
    }
  }

  cleanupSocketRooms(socket) {
    logger.debug(`Cleaning up rooms for socket ${socket.id}`);
    const currentRooms = Array.from(socket.rooms); // Get a copy of rooms Set
    currentRooms.forEach((roomName) => {
      if (roomName !== socket.id) {
        // Sockets are always in a room identified by their own ID
        socket.leave(roomName);
        const roomMembers = this.rooms.get(roomName);
        if (roomMembers) {
          roomMembers.delete(socket.id);
          if (roomMembers.size === 0) {
            this.rooms.delete(roomName);
          }
        }
        logger.debug(`Socket ${socket.id} left room ${roomName}`);
      }
    });
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

  getStats() {
    const activeRooms = {};
    this.rooms.forEach((sockets, roomName) => {
      activeRooms[roomName] = sockets.size;
    });

    return {
      connectedUsers: this.getConnectedUsersCount(),
      totalSockets: this.getTotalSocketsCount(),
      // rooms: this.io.sockets.adapter.rooms.size, // This counts internal adapter rooms, might be different
      trackedRoomsCount: this.rooms.size, // Count of rooms we are explicitly tracking
      trackedRoomDetails: activeRooms, // Details of our tracked rooms
      metrics: socketMetrics.getMetrics(),
      timestamp: new Date()
    };
  }
}

module.exports = new SocketManager();
