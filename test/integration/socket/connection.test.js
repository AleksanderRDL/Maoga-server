// test/integration/socket/connection.test.js
const { expect } = require('chai');
const app = require('../../../src/app'); // Ensure this path is correct
const socketManager = require('../../../src/services/socketManager');
const authService = require('../../../src/modules/auth/services/authService');
const User = require('../../../src/modules/auth/models/User');
const TestSocketClient = require('../../utils/socketClient'); // Ensure this path is correct
const { testUsers } = require('../../fixtures/users'); // Ensure this path is correct
const http = require('http');

describe('Socket.IO Connection', () => {
  let server;
  let serverUrl;
  let authTokenUser1;
  let testUser1;
  let mainSocketClient; // For most tests
  let client1, client2, watcherClient; // For multi-client tests

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, 'localhost', () => {
        const address = server.address();
        serverUrl = `http://localhost:${address.port}`;
        console.log(`Connection Test Server listening on ${serverUrl}`);
        resolve();
      });
    });
    socketManager.initialize(server);
    await new Promise((resolve) => setTimeout(resolve, 200));
    console.log('Test Setup: Socket.IO initialized for Connection tests.');
  });

  after(async () => {
    if (socketManager.io) {
      socketManager.io.close();
    }
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
      console.log(`Connection Test Server closed`);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    if (socketManager.userSockets && typeof socketManager.userSockets.clear === 'function') {
      socketManager.userSockets.clear();
    }
    if (socketManager.socketUsers && typeof socketManager.socketUsers.clear === 'function') {
      socketManager.socketUsers.clear();
    }
    if (socketManager.rooms && typeof socketManager.rooms.clear === 'function') {
      socketManager.rooms.clear();
    }

    const result = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    authTokenUser1 = result.accessToken;
    testUser1 = result.user;

    mainSocketClient = new TestSocketClient(serverUrl, authTokenUser1);
  });

  afterEach(async () => {
    if (mainSocketClient && mainSocketClient.socket && mainSocketClient.socket.connected) mainSocketClient.disconnect();
    if (client1 && client1.socket && client1.socket.connected) client1.disconnect();
    if (client2 && client2.socket && client2.socket.connected) client2.disconnect();
    if (watcherClient && watcherClient.socket && watcherClient.socket.connected) watcherClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Authentication', () => {
    it('should connect with valid JWT token', async () => {
      const connectedEventPromise = mainSocketClient.waitForEvent('connected', 5000);
      const socket = await mainSocketClient.connect();
      expect(socket.connected).to.be.true;
      const connectedData = await connectedEventPromise;
      expect(connectedData.userId).to.equal(testUser1.id);
      expect(connectedData.socketId).to.equal(socket.id);
    });

    it('should reject connection without token', async () => {
      const clientWithNoToken = new TestSocketClient(serverUrl, null);
      try {
        await clientWithNoToken.connect();
        expect.fail('Should have thrown an error for missing token');
      } catch (error) {
        const errorMessage =
            error.data?.message || error.message || (error.error && error.error.message);
        expect(errorMessage).to.include('No token provided');
      } finally {
        clientWithNoToken.disconnect();
      }
    });

    it('should reject connection with invalid token', async () => {
      const clientWithInvalidToken = new TestSocketClient(serverUrl, 'invalid-jwt-token');
      try {
        await clientWithInvalidToken.connect();
        expect.fail('Should have thrown an error for invalid token');
      } catch (error) {
        const errorMessage =
            error.data?.message || error.message || (error.error && error.error.message);
        expect(errorMessage).to.include('Authentication failed');
      } finally {
        clientWithInvalidToken.disconnect();
      }
    });
  });

  describe('User Presence', () => {
    it('should update user status to online on connect', async () => {
      const connectedPromise = mainSocketClient.waitForEvent('connected', 5000);
      await mainSocketClient.connect();
      await connectedPromise;
      await new Promise((resolve) => setTimeout(resolve, 50));
      const onlineUsers = socketManager.getOnlineUsers([testUser1.id]);
      expect(onlineUsers).to.include(testUser1.id);
      expect(socketManager.getUserSocketCount(testUser1.id)).to.equal(1);
    });

    it('should handle multiple connections from same user', async () => {
      client1 = new TestSocketClient(serverUrl, authTokenUser1);
      client2 = new TestSocketClient(serverUrl, authTokenUser1);

      const c1Connected = client1.waitForEvent('connected', 5000);
      const c2Connected = client2.waitForEvent('connected', 5000);
      await client1.connect();
      await client2.connect();
      await Promise.all([c1Connected, c2Connected]);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(socketManager.getUserSocketCount(testUser1.id)).to.equal(2);

      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(socketManager.getUserSocketCount(testUser1.id)).to.equal(1);

      client2.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(socketManager.getUserSocketCount(testUser1.id)).to.equal(0);
    });

    it('should emit user status updates', async () => {
      const watcherUser = await authService.register({
        email: 'watcher@example.com',
        username: 'watcher',
        password: 'TestPassword123!'
      });
      const watcherToken = watcherUser.accessToken;
      watcherClient = new TestSocketClient(serverUrl, watcherToken);
      const watcherConnectedPromise = watcherClient.waitForEvent('connected', 5000);
      await watcherClient.connect();
      await watcherConnectedPromise;


      watcherClient.emit('user:status:subscribe', { userIds: [testUser1.id] });

      const initialStatus = await watcherClient.waitForEvent('user:status:update', 5000);
      expect(initialStatus.statuses[testUser1.id]).to.equal('offline');

      const mainClientConnectedPromise = mainSocketClient.waitForEvent('connected', 5000);
      await mainSocketClient.connect();
      await mainClientConnectedPromise;

      const statusUpdateOnline = await watcherClient.waitForEvent('user:status', 5000);
      expect(statusUpdateOnline.userId).to.equal(testUser1.id);
      expect(statusUpdateOnline.status).to.equal('online');

      mainSocketClient.disconnect();

      const statusUpdateOffline = await watcherClient.waitForEvent('user:status', 5000);
      expect(statusUpdateOffline.userId).to.equal(testUser1.id);
      expect(statusUpdateOffline.status).to.equal('offline');
    });
  });

  describe('User Status Subscription - Invalid Data', () => {
    let watcherUser, watcherToken;

    beforeEach(async () => {
      const watcherResult = await authService.register({
        email: 'watcher@example.com',
        username: 'watcher',
        password: 'TestPassword123!'
      });
      watcherToken = watcherResult.accessToken;
      watcherUser = watcherResult.user;

      watcherClient = new TestSocketClient(serverUrl, watcherToken);
      const connectedPromise = watcherClient.waitForEvent('connected', 5000);
      await watcherClient.connect();
      await connectedPromise;
    });

    afterEach(async () => {
      if (watcherClient && watcherClient.socket && watcherClient.socket.connected) watcherClient.disconnect();
    });


    it('should emit an error if user:status:subscribe payload is missing userIds', async () => {
      watcherClient.emit('user:status:subscribe', {});
      const errorEvent = await watcherClient.waitForEvent('error', 3000);
      expect(errorEvent).to.exist;
      expect(errorEvent.message).to.include('User IDs must be a non-empty array');
    });

    it('should emit an error if user:status:subscribe userIds is not an array', async () => {
      watcherClient.emit('user:status:subscribe', { userIds: 'not-an-array' });
      const errorEvent = await watcherClient.waitForEvent('error', 3000);
      expect(errorEvent).to.exist;
      expect(errorEvent.message).to.include('User IDs must be a non-empty array');
    });

    it('should emit an error if user:status:subscribe userIds is an empty array', async () => {
      watcherClient.emit('user:status:subscribe', { userIds: [] });
      const errorEvent = await watcherClient.waitForEvent('error', 3000);
      expect(errorEvent).to.exist;
      expect(errorEvent.message).to.include('User IDs must be a non-empty array');
    });

    it('should gracefully handle non-string userIds in user:status:subscribe array', async () => {
      watcherClient.emit('user:status:subscribe', { userIds: [testUser1.id, 123, "anotherValidId"] });
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('Room Cleanup on Disconnect', () => {
    let clientForRoomTest;

    beforeEach(async () => {
      clientForRoomTest = new TestSocketClient(serverUrl, authTokenUser1);
      // Setup listener *before* connect, then await connect, then await the custom event
      const connectedPromise = clientForRoomTest.waitForEvent('connected', 8000); // Increased timeout
      await clientForRoomTest.connect();
      await connectedPromise; // This ensures the 'connected' event is caught
    });

    afterEach(async () => {
      if (clientForRoomTest && clientForRoomTest.socket && clientForRoomTest.socket.connected) {
        clientForRoomTest.disconnect();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should remove socket from custom rooms on disconnect', async () => {
      const matchRequestId = 'matchReqTest123';
      const lobbyId = 'lobbyTest456';
      const statusUserId = 'userToWatch789';

      clientForRoomTest.emit('matchmaking:subscribe', { requestId: matchRequestId });
      await clientForRoomTest.waitForEvent('matchmaking:subscribed', 3000);

      clientForRoomTest.emit('lobby:subscribe', { lobbyId: lobbyId });
      await clientForRoomTest.waitForEvent('lobby:subscribed', 3000);

      clientForRoomTest.emit('user:status:subscribe', { userIds: [statusUserId] });
      await new Promise(resolve => setTimeout(resolve, 50));


      expect(socketManager.rooms.get(`match:${matchRequestId}`).has(clientForRoomTest.socket.id)).to.be.true;
      expect(socketManager.rooms.get(`lobby:${lobbyId}`).has(clientForRoomTest.socket.id)).to.be.true;
      expect(socketManager.rooms.get(`status:${statusUserId}`).has(clientForRoomTest.socket.id)).to.be.true;
      expect(socketManager.io.sockets.adapter.rooms.get(`user:${testUser1.id}`).has(clientForRoomTest.socket.id)).to.be.true;


      clientForRoomTest.disconnect();
      await new Promise(resolve => setTimeout(resolve, 250));

      const matchRoomAfter = socketManager.rooms.get(`match:${matchRequestId}`);
      expect(matchRoomAfter === undefined || !matchRoomAfter.has(clientForRoomTest.socket.id)).to.be.true;

      const lobbyRoomAfter = socketManager.rooms.get(`lobby:${lobbyId}`);
      expect(lobbyRoomAfter === undefined || !lobbyRoomAfter.has(clientForRoomTest.socket.id)).to.be.true;

      const statusRoomAfter = socketManager.rooms.get(`status:${statusUserId}`);
      expect(statusRoomAfter === undefined || !statusRoomAfter.has(clientForRoomTest.socket.id)).to.be.true;

      const userRoomSockets = socketManager.io.sockets.adapter.rooms.get(`user:${testUser1.id}`);
      expect(userRoomSockets === undefined || !userRoomSockets.has(clientForRoomTest.socket.id)).to.be.true;

      const userSocketSet = socketManager.userSockets.get(testUser1.id);
      expect(userSocketSet === undefined || !userSocketSet.has(clientForRoomTest.socket.id)).to.be.true;
    });
  });
});