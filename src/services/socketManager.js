const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger').forModule('services:socket');
const { AuthenticationError } = require('../utils/errors');
const User = require('../modules/auth/models/User');
const socketMetrics = require('./socketMetrics');

// Forward declare matchmakingService to be loaded dynamically
let matchmakingServiceInstance;

class SocketManager {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set<socketId>
    this.socketUsers = new Map(); // socketId -> userId
    this.rooms = new Map(); // roomId -> Set<socketId> (for custom rooms like match/status)
  }

  initialize(httpServer) {
    // Dynamically import matchmakingService to avoid circular dependencies
    // This ensures matchmakingService is available when needed by socket event handlers
    if (!matchmakingServiceInstance) {
      matchmakingServiceInstance = require('../modules/matchmaking/services/matchmakingService');
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.allowedOrigins,
        credentials: true
      },
      pingTimeout: config.socketIO.pingTimeout,
      pingInterval: config.socketIO.pingInterval,
      maxHttpBufferSize: config.socketIO.maxHttpBufferSize,
      transports: config.socketIO.transports
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Socket.IO initialized');
    return this.io;
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        logger.debug('Socket auth middleware: Starting authentication', {
          socketId: socket.id,
          hasToken: !!socket.handshake.auth.token
        });

        const token = socket.handshake.auth.token;
        logger.debug('Socket auth middleware: Received token for verification', {
          socketId: socket.id,
          token: token ? 'present' : 'missing'
        });

        if (!token) {
          logger.warn('Socket auth middleware: No token provided', { socketId: socket.id });
          return next(new AuthenticationError('No token provided'));
        }

        let decoded;
        try {
          decoded = jwt.verify(token, config.jwt.secret, {
            issuer: config.jwt.issuer,
            audience: config.jwt.audience
          });
        } catch (jwtError) {
          logger.error('Socket auth middleware: JWT verification failed', {
            socketId: socket.id,
            errorName: jwtError.name,
            errorMessage: jwtError.message
          });
          if (jwtError.name === 'TokenExpiredError') {
            return next(new AuthenticationError('Authentication failed: Token expired'));
          }
          return next(
            new AuthenticationError(`Authentication failed: ${jwtError.message || 'Invalid token'}`)
          );
        }

        logger.debug('Socket auth middleware: Token decoded successfully', {
          socketId: socket.id,
          userId: decoded.id
        });

        const user = await User.findById(decoded.id).select('username status role').lean();
        logger.debug('Socket auth middleware: User fetched from database', {
          socketId: socket.id,
          userId: decoded.id,
          userFound: !!user
        });

        if (!user) {
          logger.warn('Socket auth middleware: User not found', {
            socketId: socket.id,
            userId: decoded.id
          });
          return next(new AuthenticationError('Invalid user: not found'));
        }

        if (user.status !== 'active') {
          logger.warn('Socket auth middleware: User not active', {
            socketId: socket.id,
            userId: user._id.toString(),
            status: user.status
          });
          return next(new AuthenticationError(`Invalid user: account is ${user.status}`));
        }

        socket.userId = user._id.toString();
        socket.user = {
          // Ensure all necessary user fields are attached
          id: user._id.toString(),
          username: user.username,
          role: user.role
        };

        logger.info('Socket auth middleware: Authentication successful', {
          socketId: socket.id,
          userId: socket.userId
        });
        next();
      } catch (error) {
        logger.error('Socket auth middleware: Unexpected error', {
          socketId: socket.id,
          errorName: error.name,
          errorMessage: error.message
          // stack: error.stack // Uncomment for deeper debugging
        });
        if (error instanceof AuthenticationError) {
          next(error);
        } else {
          next(new AuthenticationError('Authentication failed due to an internal server error.'));
        }
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Socket.IO connection event fired', {
        socketId: socket.id,
        userId: socket.userId
      });
      try {
        this.handleConnection(socket);
      } catch (error) {
        logger.error('Error in handleConnection attempt', {
          socketId: socket.id,
          error: error.message,
          stack: error.stack
        });
        socket.disconnect(true); // Disconnect if initial handling fails
      }

      socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
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

      // Lobby events
      socket.on('lobby:subscribe', (data) => this.handleLobbySubscribe(socket, data));
      socket.on('lobby:unsubscribe', (data) => this.handleLobbyUnsubscribe(socket, data));
      socket.on('chat:send', (data) => this.handleChatMessage(socket, data));
      socket.on('chat:typing', (data) => this.handleChatTyping(socket, data));
    });
  }

  handleConnection(socket) {
    logger.info('Socket.IO handleConnection: Entered', {
      socketId: socket.id,
      userId: socket.userId,
      remoteAddress: socket.handshake.address
    });

    if (!socket.userId) {
      logger.error(
        'CRITICAL_ERROR: socket.userId is STILL missing in handleConnection after auth middleware. Disconnecting socket.',
        {
          socketId: socket.id,
          handshakeAuth: socket.handshake.auth
        }
      );
      socket.emit('error', { message: 'Authentication context missing, disconnecting.' });
      socket.disconnect(true);
      return;
    }
    const userId = socket.userId;

    socketMetrics.recordConnection(true);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    this.socketUsers.set(socket.id, userId);

    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    logger.debug('handleConnection: Socket joined user room', {
      socketId: socket.id,
      room: userRoom,
      userId
    });

    this.updateUserStatus(userId, 'online');

    socket.emit('connected', {
      socketId: socket.id,
      userId: userId,
      message: 'Successfully connected and authenticated.'
    });
    logger.info('handleConnection: "connected" event emitted to client', {
      socketId: socket.id,
      userId
    });
  }

  handleDisconnect(socket, reason) {
    const userId = socket.userId || this.socketUsers.get(socket.id);
    logger.info('Socket disconnected', { socketId: socket.id, userId: userId, reason });

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
    this.cleanupSocketRooms(socket);
    socketMetrics.recordConnection(false); // Or have a specific metric for disconnections
  }

  handleError(socket, error) {
    logger.error('Socket error occurred', {
      socketId: socket.id,
      userId: socket.userId,
      errorName: error.name,
      errorMessage: error.message
      // stack: error.stack // Useful for debugging
    });
    socketMetrics.recordError(error);
    // Optionally, emit a generic error to the client if not already done
    // socket.emit('error', { message: 'A server-side socket error occurred.' });
  }

  handleMatchmakingSubscribe(socket, data) {
    try {
      const { requestId } = data;
      logger.debug('Handling matchmaking:subscribe', {
        socketId: socket.id,
        userId: socket.userId,
        data
      });

      if (!requestId || typeof requestId !== 'string') {
        logger.warn('Matchmaking subscribe attempt with invalid or no requestId', {
          socketId: socket.id,
          userId: socket.userId,
          data
        });
        socket.emit('error', {
          message: 'Request ID (string) required for matchmaking subscription'
        });
        return;
      }

      const roomName = `match:${requestId}`;
      socket.join(roomName);
      this.rooms.set(roomName, (this.rooms.get(roomName) || new Set()).add(socket.id));

      logger.info('Socket subscribed to matchmaking room', {
        socketId: socket.id,
        userId: socket.userId,
        requestId,
        roomName
      });
      socket.emit('matchmaking:subscribed', { requestId });

      if (matchmakingServiceInstance && socket.userId) {
        matchmakingServiceInstance
          .getCurrentMatchRequest(socket.userId)
          .then((currentRequestState) => {
            if (
              currentRequestState &&
              currentRequestState.request &&
              currentRequestState.request._id.toString() === requestId
            ) {
              const searchDuration =
                currentRequestState.request.searchDuration ||
                Date.now() - new Date(currentRequestState.request.searchStartTime).getTime();
              const estimatedTimeResult = matchmakingServiceInstance.estimateWaitTime(
                currentRequestState.request
              );
              const statusPayload = {
                status: currentRequestState.request.status,
                searchTime: searchDuration,
                potentialMatches: currentRequestState.queueInfo?.potentialMatches || 0,
                estimatedTime: estimatedTimeResult ? estimatedTimeResult.estimated : 300000,
                matchId: currentRequestState.request.matchedLobbyId
                  ? currentRequestState.request.matchedLobbyId.toString()
                  : null
              };
              this.emitMatchmakingStatus(requestId, statusPayload);
              logger.debug('Emitted current matchmaking status upon subscription', {
                requestId,
                statusPayload
              });
            } else {
              logger.debug('No active request or requestId mismatch on subscribe status emit', {
                requestId,
                currentRequestId: currentRequestState?.request?._id.toString()
              });
            }
          })
          .catch((err) => {
            logger.error('Error fetching current match request status on subscribe', {
              error: err.message,
              requestId,
              userId: socket.userId
            });
          });
      } else {
        logger.warn(
          'matchmakingServiceInstance not available or userId missing on subscribe status emit',
          { userId: socket.userId, matchmakingServiceAvailable: !!matchmakingServiceInstance }
        );
      }
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
      if (!requestId || typeof requestId !== 'string') {
        logger.warn('Matchmaking unsubscribe attempt with invalid or no requestId', {
          socketId: socket.id,
          userId: socket.userId
        });
        return;
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
          logger.warn('Invalid userId found in userIds array for status subscription', {
            socketId: socket.id,
            invalidUserId: userIdToWatch
          });
          return;
        }
        const roomName = `status:${userIdToWatch}`;
        socket.join(roomName);
        this.rooms.set(roomName, (this.rooms.get(roomName) || new Set()).add(socket.id));
        logger.debug(
          `Socket ${socket.id} joined room ${roomName} for watching userId ${userIdToWatch}`
        );
        statuses[userIdToWatch] = this.userSockets.has(userIdToWatch) ? 'online' : 'offline';
      });

      socket.emit('user:status:update', { statuses }); // Emit initial statuses
      logger.info('Socket subscribed to user statuses', {
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
        return;
      }

      userIds.forEach((userIdToUnwatch) => {
        if (typeof userIdToUnwatch !== 'string') {
          logger.warn('Invalid userId found in userIds array for status unsubscription', {
            socketId: socket.id,
            invalidUserId: userIdToUnwatch
          });
          return;
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
        socketId: socket.id,
        userIdsUnwatched: userIds
      });
    } catch (error) {
      logger.error('Failed to unsubscribe from user status', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
    }
  }

  handleLobbySubscribe(socket, data) {
    try {
      const { lobbyId } = data;

      if (!lobbyId || typeof lobbyId !== 'string') {
        socket.emit('error', { message: 'Invalid lobby ID' });
        return;
      }

      const roomName = `lobby:${lobbyId}`;
      socket.join(roomName);
      this.rooms.set(roomName, (this.rooms.get(roomName) || new Set()).add(socket.id));

      logger.info('Socket subscribed to lobby', {
        socketId: socket.id,
        userId: socket.userId,
        lobbyId,
        roomName
      });

      socket.emit('lobby:subscribed', { lobbyId });
    } catch (error) {
      logger.error('Failed to subscribe to lobby', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
      socket.emit('error', {
        message: 'Failed to subscribe to lobby: Internal server error'
      });
    }
  }

  handleLobbyUnsubscribe(socket, data) {
    try {
      const { lobbyId } = data;
      logger.debug('Handling lobby:unsubscribe', {
        socketId: socket.id,
        userId: socket.userId,
        data
      });

      if (!lobbyId || typeof lobbyId !== 'string') {
        // Added type check for safety
        logger.warn('Lobby unsubscribe attempt with invalid or no lobbyId', {
          socketId: socket.id,
          userId: socket.userId,
          data
        });
        socket.emit('error', { message: 'Lobby ID (string) required for unsubscription' });
        return;
      }

      const roomName = `lobby:${lobbyId}`;
      socket.leave(roomName);

      const roomMembers = this.rooms.get(roomName);
      if (roomMembers) {
        roomMembers.delete(socket.id);
        if (roomMembers.size === 0) {
          this.rooms.delete(roomName);
        }
      }

      logger.info('Socket unsubscribed from lobby', {
        socketId: socket.id,
        userId: socket.userId,
        lobbyId,
        roomName
      });

      socket.emit('lobby:unsubscribed', { lobbyId });
    } catch (error) {
      logger.error('Failed to unsubscribe from lobby', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId,
        data
      });
      socket.emit('error', { message: 'Failed to unsubscribe from lobby: Internal server error' });
    }
  }

  async handleChatMessage(socket, data) {
    try {
      const { lobbyId, content, contentType = 'text' } = data;
      const userId = socket.userId;

      if (!lobbyId || !content) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Delegate to chat service
      const chatService = require('../modules/chat/services/chatService');
      await chatService.sendLobbyMessage(lobbyId, userId, content, contentType);
    } catch (error) {
      logger.error('Failed to handle chat message', {
        error: error.message,
        socketId: socket.id,
        data
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  handleChatTyping(socket, data) {
    try {
      const { lobbyId, isTyping } = data;
      const userId = socket.userId;

      if (!lobbyId) {
        return;
      }

      const chatService = require('../modules/chat/services/chatService');
      chatService.emitTypingIndicator(lobbyId, userId, isTyping);
    } catch (error) {
      logger.error('Failed to handle typing indicator', {
        error: error.message,
        socketId: socket.id,
        data
      });
    }
  }

  // Add this method for emitting to room
  emitToRoom(roomName, event, data) {
    try {
      this.io.to(roomName).emit(event, data);
      logger.debug('Emitted event to room', { roomName, event });
      return true;
    } catch (error) {
      logger.error('Failed to emit to room', {
        error: error.message,
        roomName,
        event
      });
      return false;
    }
  }

  updateUserStatus(userId, status) {
    try {
      const statusRoomName = `status:${userId}`;
      logger.debug(`Updating user status and emitting to room ${statusRoomName}`, {
        userId,
        status
      });
      this.io.to(statusRoomName).emit('user:status', { userId, status, timestamp: new Date() });

      if (status === 'online') {
        User.findByIdAndUpdate(userId, { lastActive: new Date() }, { new: true })
          .exec()
          .catch((err) => {
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
    const currentRooms = Array.from(socket.rooms);
    currentRooms.forEach((roomName) => {
      if (roomName !== socket.id) {
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

  emitToUser(userId, event, data) {
    try {
      const userSocketSet = this.userSockets.get(userId);
      if (!userSocketSet || userSocketSet.size === 0) {
        logger.debug('User not connected, cannot emit', { userId, event });
        return false;
      }
      // Emit to the user-specific room which all their sockets join
      this.io.to(`user:${userId}`).emit(event, data);
      logger.debug('Emitted event to user room', { userId, event });
      return true;
    } catch (error) {
      logger.error('Failed to emit to user', { error: error.message, userId, event });
      return false;
    }
  }

  emitToUsers(userIds, event, data) {
    const results = new Map();
    userIds.forEach((userId) => {
      results.set(userId, this.emitToUser(userId, event, data));
    });
    return results;
  }

  getOnlineUsers(userIds) {
    return userIds.filter(
      (userId) => this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
  }

  getUserSocketCount(userId) {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size : 0;
  }

  getConnectedUsersCount() {
    return this.userSockets.size;
  }

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
      trackedRoomsCount: this.rooms.size,
      trackedRoomDetails: activeRooms,
      metrics: socketMetrics.getMetrics(),
      timestamp: new Date()
    };
  }
}

module.exports = new SocketManager();

