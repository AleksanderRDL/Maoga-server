const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const chatService = require('../../../../../src/modules/chat/services/chatService');
const Chat = require('../../../../../src/modules/chat/models/Chat');
const User = require('../../../../../src/modules/auth/models/User');
const socketManager = require('../../../../../src/services/socketManager');
const { NotFoundError, BadRequestError } = require('../../../../../src/utils/errors');

describe('ChatService', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('sendLobbyMessage', () => {
    it('should send a message successfully', async () => {
      const lobbyId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const content = 'Test message';

      const mockMessage = {
        _id: new mongoose.Types.ObjectId(),
        content,
        contentType: 'text',
        createdAt: new Date()
      };

      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: [userId],
        addMessage: sandbox.stub().returns(mockMessage),
        save: sandbox.stub().resolves()
      };

      const mockUser = {
        _id: userId,
        username: 'testuser',
        profile: { displayName: 'Test User' }
      };

      sandbox.stub(Chat, 'findOne').resolves(mockChat);
      sandbox.stub(User, 'findById').resolves(mockUser);
      sandbox.stub(socketManager, 'emitToRoom');

      const result = await chatService.sendLobbyMessage(
        lobbyId.toString(),
        userId.toString(),
        content
      );

      expect(result).to.equal(mockMessage);
      expect(mockChat.addMessage.calledWith(userId, content, 'text')).to.be.true;
      expect(mockChat.save.calledOnce).to.be.true;
      expect(socketManager.emitToRoom.calledOnce).to.be.true;

      const emitCall = socketManager.emitToRoom.getCall(0);
      expect(emitCall.args[0]).to.equal(`lobby:${lobbyId}`);
      expect(emitCall.args[1]).to.equal('chat:message');
      expect(emitCall.args[2].message.content).to.equal(content);
    });

    it('should throw NotFoundError if chat not found', async () => {
      sandbox.stub(Chat, 'findOne').resolves(null);

      try {
        await chatService.sendLobbyMessage('lobbyId', 'userId', 'content');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('Chat not found');
      }
    });

    it('should throw BadRequestError if user not participant', async () => {
      const mockChat = {
        participants: [new mongoose.Types.ObjectId()]
      };

      sandbox.stub(Chat, 'findOne').resolves(mockChat);

      try {
        await chatService.sendLobbyMessage(
          'lobbyId',
          new mongoose.Types.ObjectId().toString(),
          'content'
        );
        expect.fail('Should have thrown BadRequestError');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestError);
        expect(error.message).to.equal('User is not a participant in this chat');
      }
    });
  });

  describe('getLobbyChatHistory', () => {
    it('should retrieve chat history with pagination', async () => {
      const lobbyId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const messages = [
        {
          _id: new mongoose.Types.ObjectId(),
          senderId: userId,
          content: 'Message 1',
          createdAt: new Date(Date.now() - 3600000)
        },
        {
          _id: new mongoose.Types.ObjectId(),
          senderId: userId,
          content: 'Message 2',
          createdAt: new Date()
        }
      ];

      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: [userId],
        messages,
        populate: sandbox.stub().returnsThis()
      };

      sandbox.stub(Chat, 'findOne').returns({
        populate: sandbox.stub().resolves(mockChat)
      });

      const result = await chatService.getLobbyChatHistory(lobbyId.toString(), userId.toString(), {
        limit: 10
      });

      expect(result.chatId).to.equal(mockChat._id);
      expect(result.messages).to.have.lengthOf(2);
      expect(result.hasMore).to.be.false;
    });

    it('should filter messages by before timestamp', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cutoffTime = new Date();

      const messages = [
        {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(cutoffTime.getTime() - 7200000) // 2 hours before
        },
        {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(cutoffTime.getTime() - 3600000) // 1 hour before
        },
        {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(cutoffTime.getTime() + 3600000) // 1 hour after
        }
      ];

      const mockChat = {
        _id: new mongoose.Types.ObjectId(),
        participants: [userId],
        messages,
        populate: sandbox.stub().returnsThis()
      };

      sandbox.stub(Chat, 'findOne').returns({
        populate: sandbox.stub().resolves(mockChat)
      });

      const result = await chatService.getLobbyChatHistory('lobbyId', userId.toString(), {
        before: cutoffTime
      });

      expect(result.messages).to.have.lengthOf(2);
    });
  });

  describe('emitTypingIndicator', () => {
    it('should emit typing indicator event', () => {
      const lobbyId = 'lobby123';
      const userId = 'user123';

      sandbox.stub(socketManager, 'emitToRoom');

      chatService.emitTypingIndicator(lobbyId, userId, true);

      expect(socketManager.emitToRoom.calledOnce).to.be.true;
      const call = socketManager.emitToRoom.getCall(0);
      expect(call.args[0]).to.equal(`lobby:${lobbyId}`);
      expect(call.args[1]).to.equal('chat:typing');
      expect(call.args[2]).to.deep.equal({
        lobbyId,
        userId,
        isTyping: true
      });
    });
  });
});
