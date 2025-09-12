const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const Chat = require('../../../../../src/modules/chat/models/Chat');

describe('Chat Model', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('addMessage', () => {
    it('should add a text message', () => {
      const chat = new Chat({
        chatType: 'lobby',
        participants: [new mongoose.Types.ObjectId()]
      });

      const senderId = new mongoose.Types.ObjectId();
      const content = 'Hello, world!';

      const message = chat.addMessage(senderId, content, 'text');

      expect(message).to.exist;
      expect(message.senderId.toString()).to.equal(senderId.toString());
      expect(message.content).to.equal(content);
      expect(message.contentType).to.equal('text');
      expect(message.createdAt).to.be.instanceOf(Date);
      expect(chat.messages).to.have.lengthOf(1);
      expect(chat.lastMessageAt).to.equal(message.createdAt);
    });

    it('should default to text content type', () => {
      const chat = new Chat({
        chatType: 'lobby',
        participants: []
      });

      const message = chat.addMessage(new mongoose.Types.ObjectId(), 'Test');

      expect(message.contentType).to.equal('text');
    });

    it('should update lastMessageAt', () => {
      const chat = new Chat({
        chatType: 'lobby',
        participants: [],
        lastMessageAt: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const beforeTime = chat.lastMessageAt;
      const message = chat.addMessage(new mongoose.Types.ObjectId(), 'New message');

      expect(chat.lastMessageAt).to.be.greaterThan(beforeTime);
      expect(chat.lastMessageAt).to.equal(message.createdAt);
    });
  });

  describe('addSystemMessage', () => {
    it('should add a system message with null senderId', () => {
      const chat = new Chat({
        chatType: 'lobby',
        participants: []
      });

      const content = 'User joined the lobby';
      const message = chat.addSystemMessage(content);

      expect(message).to.exist;
      expect(message.senderId).to.be.null;
      expect(message.content).to.equal(content);
      expect(message.contentType).to.equal('system');
      expect(chat.messages).to.have.lengthOf(1);
    });
  });

  describe('createLobbyChat', () => {
    it('should create a lobby chat with participants', async () => {
      const lobbyId = new mongoose.Types.ObjectId();
      const participants = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

      const saveStub = sandbox.stub(Chat.prototype, 'save').resolves();

      const chat = await Chat.createLobbyChat(lobbyId, participants);

      expect(saveStub.calledOnce).to.be.true;
      expect(chat).to.be.instanceOf(Chat);
      expect(chat.chatType).to.equal('lobby');
      expect(chat.lobbyId.toString()).to.equal(lobbyId.toString());
      expect(chat.participants).to.have.lengthOf(2);
      expect(chat.participants[0].toString()).to.equal(participants[0].toString());
      expect(chat.participants[1].toString()).to.equal(participants[1].toString());
    });
  });
});
