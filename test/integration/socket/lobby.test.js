// test/integration/socket/lobby.test.js
const { expect } = require('chai');
const app = require('../../../src/app');
const socketManager = require('../../../src/services/socketManager');
const authService = require('../../../src/modules/auth/services/authService');
const lobbyService = require('../../../src/modules/lobby/services/lobbyService');
const chatService = require('../../../src/modules/chat/services/chatService');
const User = require('../../../src/modules/auth/models/User');
const Game = require('../../../src/modules/game/models/Game');
const Lobby = require('../../../src/modules/lobby/models/Lobby');
const Chat = require('../../../src/modules/chat/models/Chat');
const TestSocketClient = require('../../utils/socketClient');
const { testUsers, testGames } = require('../../fixtures');
const http = require('http');

describe('Socket.IO Lobby Events', () => {
  let server;
  let serverUrl;
  let authToken1, authToken2;
  let user1, user2;
  let testGame;
  let testLobby;
  let client1, client2;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, 'localhost', () => {
        const address = server.address();
        serverUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
    socketManager.initialize(server);
  });

  after(async () => {
    if (socketManager.io) {
      socketManager.io.close();
    }
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Game.deleteMany({});
    await Lobby.deleteMany({});
    await Chat.deleteMany({});

    // Create test game
    testGame = await Game.create(testGames[0]);

    // Create test users
    const result1 = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    authToken1 = result1.accessToken;
    user1 = result1.user;

    const result2 = await authService.register({
      email: testUsers[1].email,
      username: testUsers[1].username,
      password: testUsers[1].password
    });
    authToken2 = result2.accessToken;
    user2 = result2.user;

    // Create test lobby
    testLobby = await Lobby.create({
      name: 'Test Lobby',
      gameId: testGame._id,
      gameMode: 'casual',
      hostId: user1.id,
      members: [
        { userId: user1.id, status: 'joined', isHost: true },
        { userId: user2.id, status: 'joined' }
      ]
    });

    const chat = await Chat.create({
      chatType: 'lobby',
      lobbyId: testLobby._id,
      participants: [user1.id, user2.id]
    });

    testLobby.chatId = chat._id;
    await testLobby.save();

    // Create socket clients
    client1 = new TestSocketClient(serverUrl, authToken1);
    client2 = new TestSocketClient(serverUrl, authToken2);
  });

  afterEach(async () => {
    if (client1 && client1.socket && client1.socket.connected) client1.disconnect();
    if (client2 && client2.socket && client2.socket.connected) client2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Lobby Subscription/Unsubscription', () => {
    it('should subscribe to lobby updates', async () => {
      await client1.connect();

      client1.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });

      const subscribed = await client1.waitForEvent('lobby:subscribed', 3000);
      expect(subscribed.lobbyId).to.equal(testLobby._id.toString());
    });

    it('should unsubscribe from lobby updates', async () => {
      await client1.connect();

      // Subscribe first
      client1.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });
      await client1.waitForEvent('lobby:subscribed', 3000);

      // Unsubscribe
      client1.emit('lobby:unsubscribe', { lobbyId: testLobby._id.toString() });

      const unsubscribed = await client1.waitForEvent('lobby:unsubscribed', 3000);
      expect(unsubscribed.lobbyId).to.equal(testLobby._id.toString());
    });
  });

  describe('Real-time Lobby Updates', () => {
    beforeEach(async () => {
      await client1.connect();
      await client2.connect();

      // Subscribe both clients to lobby
      client1.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });
      client2.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });

      await client1.waitForEvent('lobby:subscribed', 3000);
      await client2.waitForEvent('lobby:subscribed', 3000);
    });

    it('should broadcast member join', async () => {
      // Create a third user
      const result3 = await authService.register({
        email: 'user3@example.com',
        username: 'user3',
        password: 'Password123!'
      });
      const user3 = result3.user;

      const memberJoinedPromise = client1.waitForEvent('lobby:member:joined', 5000);

      // User3 joins lobby
      await lobbyService.joinLobby(testLobby._id.toString(), user3.id);

      const event = await memberJoinedPromise;
      expect(event.lobbyId).to.equal(testLobby._id.toString());
      expect(event.member.userId).to.equal(user3.id);
      expect(event.member.username).to.equal('user3');
    });

    it('should broadcast member leave', async () => {
      const memberLeftPromise = client1.waitForEvent('lobby:member:left', 5000);

      await lobbyService.leaveLobby(testLobby._id.toString(), user2.id);

      const event = await memberLeftPromise;
      expect(event.lobbyId).to.equal(testLobby._id.toString());
      expect(event.userId).to.equal(user2.id);
    });

    it('should broadcast ready status changes', async () => {
      const readyPromise = client2.waitForEvent('lobby:member:ready', 5000);

      await lobbyService.setMemberReady(testLobby._id.toString(), user1.id, true);

      const event = await readyPromise;
      expect(event.lobbyId).to.equal(testLobby._id.toString());
      expect(event.userId).to.equal(user1.id);
      expect(event.readyStatus).to.be.true;
    });

    it('should broadcast lobby state changes', async () => {
      const updatePromise = client1.waitForEvent('lobby:update', 5000);

      // Set both members ready to trigger state change
      await lobbyService.setMemberReady(testLobby._id.toString(), user1.id, true);
      await lobbyService.setMemberReady(testLobby._id.toString(), user2.id, true);

      const event = await updatePromise;
      expect(event.lobby.status).to.equal('ready');
    });
  });

  describe('Chat Message Delivery', () => {
    beforeEach(async () => {
      await client1.connect();
      await client2.connect();

      client1.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });
      client2.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });

      await client1.waitForEvent('lobby:subscribed', 3000);
      await client2.waitForEvent('lobby:subscribed', 3000);
    });

    it('should deliver chat messages to all lobby members', async () => {
      const messagePromise = client2.waitForEvent('chat:message', 5000);

      // Send message via socket
      client1.emit('chat:send', {
        lobbyId: testLobby._id.toString(),
        content: 'Hello from socket!',
        contentType: 'text'
      });

      const event = await messagePromise;
      expect(event.lobbyId).to.equal(testLobby._id.toString());
      expect(event.message.content).to.equal('Hello from socket!');
      expect(event.message.senderId).to.equal(user1.id);
    });

    it('should deliver system messages', async () => {
      const messagePromise = client1.waitForEvent('chat:message', 5000);

      await lobbyService.sendSystemMessage(testLobby._id.toString(), 'System message test');

      const event = await messagePromise;
      expect(event.message.contentType).to.equal('system');
      expect(event.message.content).to.equal('System message test');
    });
  });

  describe('Typing Indicators', () => {
    beforeEach(async () => {
      await client1.connect();
      await client2.connect();

      client1.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });
      client2.emit('lobby:subscribe', { lobbyId: testLobby._id.toString() });

      await client1.waitForEvent('lobby:subscribed', 3000);
      await client2.waitForEvent('lobby:subscribed', 3000);
    });

    it('should broadcast typing indicators', async () => {
      const typingPromise = client2.waitForEvent('chat:typing', 3000);

      client1.emit('chat:typing', {
        lobbyId: testLobby._id.toString(),
        isTyping: true
      });

      const event = await typingPromise;
      expect(event.lobbyId).to.equal(testLobby._id.toString());
      expect(event.userId).to.equal(user1.id);
      expect(event.isTyping).to.be.true;
    });

    it('should handle stop typing', async () => {
      const typingPromise = client2.waitForEvent('chat:typing', 3000);

      client1.emit('chat:typing', {
        lobbyId: testLobby._id.toString(),
        isTyping: false
      });

      const event = await typingPromise;
      expect(event.isTyping).to.be.false;
    });
  });
});
