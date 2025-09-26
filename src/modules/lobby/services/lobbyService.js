const Lobby = require('../models/Lobby');
const Chat = require('../../chat/models/Chat');
const _MatchHistory = require('../../matchmaking/models/MatchHistory');
const User = require('../../auth/models/User');
const socketManager = require('../../../services/socketManager');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class LobbyService {
  /**
   * Create a lobby from a match
   */

  async createLobby(matchData, options = {}) {
    try {
      const { matchHistory, participants } = matchData;
      const { session } = options;

      if (!matchHistory) {
        throw new BadRequestError('Match history is required to create a lobby');
      }

      const hostId = participants[0].userId;

      const lobby = new Lobby({
        name: `Match ${matchHistory._id.toString().slice(-6)}`,
        gameId: matchHistory.gameId,
        gameMode: matchHistory.gameMode,
        matchHistoryId: matchHistory._id,
        hostId,
        capacity: {
          min: participants.length,
          max: participants.length
        },
        region: matchHistory.region,
        status: 'forming'
      });

      if (session) {
        lobby.$session(session);
        matchHistory.$session(session);
      }

      participants.forEach((participant, index) => {
        lobby.addMember(participant.userId, index === 0);
      });

      await lobby.save({ session });

      const chat = await Chat.createLobbyChat(
        lobby._id,
        participants.map((p) => p.userId),
        { session }
      );

      lobby.chatId = chat._id;
      await lobby.save({ session });

      matchHistory.lobbyId = lobby._id;
      await matchHistory.save({ session });

      const MatchRequest = require('../../matchmaking/models/MatchRequest');
      await MatchRequest.updateMany(
        { _id: { $in: participants.map((p) => p.requestId) } },
        { matchedLobbyId: lobby._id },
        { session }
      );

      if (!session) {
        await lobby.populate('gameId', 'name slug');
        await lobby.populate('members.userId', 'username profile.displayName');

        await this.sendSystemMessage(
          lobby._id,
          'Lobby created! Waiting for all players to be ready.'
        );

        this.emitLobbyUpdate(lobby);
      }

      logger.info('Lobby created from match', {
        lobbyId: lobby._id,
        matchId: matchHistory._id,
        participantCount: participants.length,
        deferredSideEffects: Boolean(session)
      });

      return lobby;
    } catch (error) {
      logger.error('Failed to create lobby', {
        error: error.message,
        matchData
      });
      throw error;
    }
  }

  async getLobbyById(lobbyId, userId = null) {
    try {
      const lobby = await Lobby.findById(lobbyId)
        .populate('gameId', 'name slug coverImage')
        .populate('members.userId', 'username profile.displayName profile.profileImage')
        .populate('hostId', 'username');

      if (!lobby) {
        throw new NotFoundError('Lobby not found');
      }

      // Check if user is a member (if userId provided)
      if (userId) {
        const isMember = lobby.members.some(
          (m) =>
            m.userId._id.toString() === userId && (m.status === 'joined' || m.status === 'ready')
        );

        if (!isMember && lobby.settings.isPrivate) {
          throw new NotFoundError('Lobby not found');
        }
      }

      return lobby;
    } catch (error) {
      logger.error('Failed to get lobby', {
        error: error.message,
        lobbyId
      });
      throw error;
    }
  }

  /**
   * Join lobby
   */
  async joinLobby(lobbyId, userId) {
    try {
      const lobby = await this.getLobbyById(lobbyId);

      if (lobby.status !== 'forming') {
        throw new BadRequestError('Lobby is not accepting new members');
      }

      if (lobby.memberCount >= lobby.capacity.max) {
        throw new BadRequestError('Lobby is full');
      }

      const user = await User.findById(userId);
      if (!user || user.status !== 'active') {
        throw new BadRequestError('User cannot join lobby');
      }

      // Check if user is already in another active lobby
      const activeLobby = await Lobby.findActiveLobby(userId);
      if (activeLobby && activeLobby._id.toString() !== lobbyId) {
        throw new ConflictError('User is already in another lobby');
      }

      // Add member
      lobby.addMember(userId);
      await lobby.save();

      // Add to chat
      const chat = await Chat.findById(lobby.chatId);
      if (chat && !chat.participants.includes(userId)) {
        chat.participants.push(userId);
        await chat.save();
      }

      // Send system message
      await this.sendSystemMessage(lobbyId, `${user.username} joined the lobby`);

      // Populate and emit update
      await lobby.populate('members.userId', 'username profile.displayName profile.profileImage');
      this.emitLobbyUpdate(lobby);
      this.emitMemberJoined(lobby, userId);

      logger.info('User joined lobby', {
        lobbyId,
        userId,
        memberCount: lobby.memberCount
      });

      return lobby;
    } catch (error) {
      logger.error('Failed to join lobby', {
        error: error.message,
        lobbyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Leave lobby
   */
  async leaveLobby(lobbyId, userId) {
    try {
      const lobby = await this.getLobbyById(lobbyId, userId);

      const member = lobby.removeMember(userId, 'left');
      if (!member) {
        throw new BadRequestError('User is not in this lobby');
      }

      // Handle host leaving
      if (member.isHost && lobby.memberCount > 0) {
        await this.transferHost(lobby);
      }

      await lobby.save();

      const user = await User.findById(userId);
      await this.sendSystemMessage(lobbyId, `${user.username} left the lobby`);

      // Check if lobby should be closed
      if (lobby.memberCount === 0 && lobby.settings.autoClose) {
        await this.closeLobby(lobby._id, 'All members left');
      } else {
        await lobby.populate('members.userId', 'username profile.displayName profile.profileImage');
        this.emitLobbyUpdate(lobby);
        this.emitMemberLeft(lobby, userId);
      }

      logger.info('User left lobby', {
        lobbyId,
        userId,
        remainingMembers: lobby.memberCount
      });

      return lobby;
    } catch (error) {
      logger.error('Failed to leave lobby', {
        error: error.message,
        lobbyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Set member ready status
   */
  async setMemberReady(lobbyId, userId, readyStatus) {
    try {
      const lobby = await this.getLobbyById(lobbyId, userId);

      if (lobby.status !== 'forming' && lobby.status !== 'ready') {
        throw new BadRequestError('Cannot change ready status in current lobby state');
      }

      const member = lobby.setMemberReady(userId, readyStatus);
      if (!member) {
        throw new BadRequestError('User is not an active member of this lobby');
      }

      await lobby.save();

      // If lobby was ready and a member unreadies, revert to forming
      if (lobby.status === 'ready' && !lobby.isReady) {
        await this.transitionLobbyState(lobby, 'forming');
      } else if (lobby.canTransitionToReady()) {
        // Check if all members are ready to transition to ready state
        await this.transitionLobbyState(lobby, 'ready');
      }

      await lobby.populate('members.userId', 'username profile.displayName profile.profileImage');
      this.emitMemberReady(lobby, userId, readyStatus);

      logger.info('Member ready status updated', {
        lobbyId,
        userId,
        readyStatus,
        readyCount: lobby.readyCount,
        memberCount: lobby.memberCount
      });

      return lobby;
    } catch (error) {
      logger.error('Failed to set member ready', {
        error: error.message,
        lobbyId,
        userId,
        readyStatus
      });
      throw error;
    }
  }

  /**
   * Transition lobby state
   */
  async transitionLobbyState(lobby, newState) {
    const oldState = lobby.status;
    lobby.status = newState;

    switch (newState) {
      case 'ready':
        lobby.readyAt = new Date();
        await this.sendSystemMessage(lobby._id, 'All players ready! Game starting soon...');

        // Auto-transition to active after delay
        if (lobby.settings.autoStart) {
          setTimeout(() => {
            this.transitionLobbyState(lobby, 'active').catch((err) => {
              logger.error('Failed to auto-start lobby', {
                error: err.message,
                lobbyId: lobby._id
              });
            });
          }, 5000); // 5 second delay
        }
        break;

      case 'active':
        lobby.activeAt = new Date();
        await this.sendSystemMessage(lobby._id, 'Game started! Good luck!');
        break;

      case 'closed':
        lobby.closedAt = new Date();
        break;

      case 'forming':
        // Reset ready timestamp when reverting from ready state
        lobby.readyAt = undefined;
        break;
    }

    await lobby.save();
    this.emitLobbyUpdate(lobby);

    logger.info('Lobby state transitioned', {
      lobbyId: lobby._id,
      oldState,
      newState
    });
  }

  /**
   * Close lobby
   */
  async closeLobby(lobbyId, reason = 'Lobby closed') {
    try {
      const lobby = await Lobby.findById(lobbyId);
      if (!lobby) {
        throw new NotFoundError('Lobby not found');
      }

      if (lobby.status === 'closed') {
        return lobby;
      }

      await this.sendSystemMessage(lobbyId, reason);
      await this.transitionLobbyState(lobby, 'closed');

      // Notify all members
      lobby.members.forEach((member) => {
        if (member.status === 'joined' || member.status === 'ready') {
          socketManager.emitToUser(member.userId.toString(), 'lobby:closed', {
            lobbyId: lobby._id,
            reason
          });
        }
      });

      logger.info('Lobby closed', {
        lobbyId,
        reason
      });

      return lobby;
    } catch (error) {
      logger.error('Failed to close lobby', {
        error: error.message,
        lobbyId
      });
      throw error;
    }
  }

  /**
   * Transfer host to another member
   */
  async transferHost(lobby) {
    const activeMember = lobby.members.find(
      (m) => (m.status === 'joined' || m.status === 'ready') && !m.isHost
    );

    if (activeMember) {
      // Remove host status from current host
      const currentHost = lobby.members.find((m) => m.isHost);
      if (currentHost) {
        currentHost.isHost = false;
      }

      // Set new host
      activeMember.isHost = true;
      lobby.hostId = activeMember.userId;

      await this.sendSystemMessage(lobby._id, `Host transferred to ${activeMember.userId}`);

      logger.info('Host transferred', {
        lobbyId: lobby._id,
        newHostId: activeMember.userId
      });
    }
  }

  /**
   * Send system message to lobby chat
   */
  async sendSystemMessage(lobbyId, content) {
    try {
      const lobby = await Lobby.findById(lobbyId);
      if (!lobby || !lobby.chatId) {
        return;
      }

      const chat = await Chat.findById(lobby.chatId);
      if (!chat) {
        return;
      }

      const message = chat.addSystemMessage(content);
      await chat.save();

      // Emit to lobby members
      socketManager.emitToRoom(`lobby:${lobbyId}`, 'chat:message', {
        lobbyId,
        message: {
          _id: message._id,
          content: message.content,
          contentType: 'system',
          createdAt: message.createdAt
        }
      });

      return message;
    } catch (error) {
      logger.error('Failed to send system message', {
        error: error.message,
        lobbyId,
        content
      });
    }
  }

  /**
   * Emit lobby update to all members
   */
  emitLobbyUpdate(lobby) {
    socketManager.emitToRoom(`lobby:${lobby._id}`, 'lobby:update', {
      lobby: lobby.toJSON()
    });
  }

  /**
   * Emit member joined event
   */
  emitMemberJoined(lobby, userId) {
    const member = lobby.members.find((m) => m.userId._id.toString() === userId);

    socketManager.emitToRoom(`lobby:${lobby._id}`, 'lobby:member:joined', {
      lobbyId: lobby._id,
      member: member
        ? {
            userId: member.userId._id,
            username: member.userId.username,
            displayName: member.userId.profile?.displayName,
            isHost: member.isHost
          }
        : null
    });
  }

  /**
   * Emit member left event
   */
  emitMemberLeft(lobby, userId) {
    socketManager.emitToRoom(`lobby:${lobby._id}`, 'lobby:member:left', {
      lobbyId: lobby._id,
      userId
    });
  }

  /**
   * Emit member ready event
   */
  emitMemberReady(lobby, userId, readyStatus) {
    socketManager.emitToRoom(`lobby:${lobby._id}`, 'lobby:member:ready', {
      lobbyId: lobby._id,
      userId,
      readyStatus,
      lobbyReadyCount: lobby.readyCount,
      lobbyMemberCount: lobby.memberCount
    });
  }

  /**
   * Get user's active lobbies
   */
  async getUserLobbies(userId, options = {}) {
    try {
      const { includeHistory = false, limit = 10 } = options;

      const query = {
        'members.userId': userId,
        'members.status': {
          $in: includeHistory ? ['joined', 'ready', 'left'] : ['joined', 'ready']
        }
      };

      if (!includeHistory) {
        query.status = { $in: ['forming', 'ready', 'active'] };
      }

      const lobbies = await Lobby.find(query)
        .populate('gameId', 'name slug coverImage')
        .populate('members.userId', 'username profile.displayName')
        .sort({ updatedAt: -1 })
        .limit(limit);

      return lobbies;
    } catch (error) {
      logger.error('Failed to get user lobbies', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

module.exports = new LobbyService();
