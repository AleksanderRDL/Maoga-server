const Chat = require('../models/Chat');
const socketManager = require('../../../services/socketManager');
const { NotFoundError, BadRequestError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class ChatService {
  /**
   * Send message to lobby chat
   */
  async sendLobbyMessage(lobbyId, userId, content, contentType = 'text') {
    try {
      const chat = await Chat.findOne({ lobbyId, chatType: 'lobby' });

      if (!chat) {
        throw new NotFoundError('Chat not found');
      }

      const mongoose = require('mongoose');
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Verify user is a participant
      const isParticipant = chat.participants.some((p) => p.equals(userObjectId));
      if (!isParticipant) {
        throw new BadRequestError('User is not a participant in this chat');
      }

      // Add message
      const message = chat.addMessage(userObjectId, content, contentType);
      await chat.save();

      // Get sender info
      const User = require('../../auth/models/User');
      const sender = await User.findById(userObjectId, 'username profile.displayName');

      // Emit to lobby members
      socketManager.emitToRoom(`lobby:${lobbyId}`, 'chat:message', {
        lobbyId,
        message: {
          _id: message._id,
          senderId: userId,
          senderName: sender.username,
          senderDisplayName: sender.profile?.displayName,
          content: message.content,
          contentType: message.contentType,
          createdAt: message.createdAt
        }
      });

      logger.info('Lobby message sent', {
        lobbyId,
        userId,
        messageId: message._id
      });

      return message;
    } catch (error) {
      logger.error('Failed to send lobby message', {
        error: error.message,
        lobbyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get lobby chat history
   */
  async getLobbyChatHistory(lobbyId, userId, options = {}) {
    try {
      const { limit = 50, before } = options;

      const chat = await Chat.findOne({ lobbyId, chatType: 'lobby' }).populate(
        'messages.senderId',
        'username profile.displayName profile.profileImage'
      );

      if (!chat) {
        throw new NotFoundError('Chat not found');
      }

      // Verify user is a participant
      const isParticipant = chat.participants.some((p) => p.toString() === userId);
      if (!isParticipant) {
        throw new BadRequestError('User is not authorized to view this chat');
      }

      let messages = chat.messages;

      // Filter by before timestamp if provided
      if (before) {
        messages = messages.filter((m) => m.createdAt < new Date(before));
      }

      // Get latest messages up to limit
      messages = messages.slice(-limit);

      return {
        chatId: chat._id,
        messages,
        hasMore: chat.messages.length > messages.length
      };
    } catch (error) {
      logger.error('Failed to get lobby chat history', {
        error: error.message,
        lobbyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Handle typing indicator
   */
  emitTypingIndicator(lobbyId, userId, isTyping) {
    socketManager.emitToRoom(`lobby:${lobbyId}`, 'chat:typing', {
      lobbyId,
      userId,
      isTyping
    });
  }
}

module.exports = new ChatService();
