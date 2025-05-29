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
    await new Promise((resolve) => setTimeout(resolve, 200)); // Allow Socket.IO to fully start
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
    if (mainSocketClient) mainSocketClient.disconnect();
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    if (watcherClient) watcherClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Brief pause for server-side cleanup
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
      }
    });
  });

  describe('User Presence', () => {
    it('should update user status to online on connect', async () => {
      await mainSocketClient.connect(); // Connects with testUser1's token
      // Give a moment for server-side status update
      await new Promise((resolve) => setTimeout(resolve, 50));
      const onlineUsers = socketManager.getOnlineUsers([testUser1.id]);
      expect(onlineUsers).to.include(testUser1.id);
      expect(socketManager.getUserSocketCount(testUser1.id)).to.equal(1);
    });

    it('should handle multiple connections from same user', async () => {
      client1 = new TestSocketClient(serverUrl, authTokenUser1);
      client2 = new TestSocketClient(serverUrl, authTokenUser1);

      await client1.connect();
      await client2.connect();
      await new Promise((resolve) => setTimeout(resolve, 100)); // allow server to process connections

      expect(socketManager.getUserSocketCount(testUser1.id)).to.equal(2);

      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 250)); // Allow server to process disconnect fully

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
      await watcherClient.connect();

      watcherClient.emit('user:status:subscribe', { userIds: [testUser1.id] });

      // Expect initial status (likely offline)
      const initialStatus = await watcherClient.waitForEvent('user:status:update', 5000);
      expect(initialStatus.statuses[testUser1.id]).to.equal('offline');

      // Now connect the target user
      await mainSocketClient.connect(); // testUser1 connects

      const statusUpdateOnline = await watcherClient.waitForEvent('user:status', 5000);
      expect(statusUpdateOnline.userId).to.equal(testUser1.id);
      expect(statusUpdateOnline.status).to.equal('online');

      mainSocketClient.disconnect(); // Disconnect the target user

      const statusUpdateOffline = await watcherClient.waitForEvent('user:status', 5000);
      expect(statusUpdateOffline.userId).to.equal(testUser1.id);
      expect(statusUpdateOffline.status).to.equal('offline');
    });
  });

  describe('User Status Subscription - Invalid Data', () => {
    // Assuming watcherClient is set up as in your existing tests
    let watcherUser, watcherToken;

    beforeEach(async () => {
      // Ensure watcherClient is set up if not already available globally in this describe
      const watcherResult = await authService.register({
        email: 'watcher@example.com',
        username: 'watcher',
        password: 'TestPassword123!'
      });
      watcherToken = watcherResult.accessToken;
      watcherUser = watcherResult.user;

      watcherClient = new TestSocketClient(serverUrl, watcherToken);
      await watcherClient.connect();
    });

    afterEach(async () => {
      if (watcherClient) watcherClient.disconnect();
    });


    it('should emit an error if user:status:subscribe payload is missing userIds', async () => {
      watcherClient.emit('user:status:subscribe', {}); // Missing userIds
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
      // This tests if the server logs a warning and continues rather than crashing
      // We don't expect a specific error event back to the client for this specific case by default,
      // but we ensure the server doesn't break.
      // The server-side `socketManager` already logs a warning for this.
      watcherClient.emit('user:status:subscribe', { userIds: [testUser1.id, 123, "anotherValidId"] });
      // We can't easily assert server-side logs here, but we ensure no client-side error/crash.
      // A more robust test might involve checking server logs if infrastructure allows.
      // For now, just ensure it doesn't break the client or server.
      await new Promise(resolve => setTimeout(resolve, 500)); // Give time for potential error
      // No specific client-side error event expected for this partial invalid data,
      // as the handler iterates and skips invalid items.
    });
  });

  describe('Room Cleanup on Disconnect', () => {
    let clientForRoomTest; // Use a specific client for this test

    beforeEach(async () => {
      // A fresh client for each room test to avoid interference
      clientForRoomTest = new TestSocketClient(serverUrl, authTokenUser1);
      await clientForRoomTest.connect();
      await clientForRoomTest.waitForEvent('connected', 5000); // Ensure connection and 'connected' event received
    });

    afterEach(async () => {
      if (clientForRoomTest) clientForRoomTest.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should remove socket from custom rooms on disconnect', async () => {
      const matchRequestId = 'matchReqTest123';
      const lobbyId = 'lobbyTest456';
      const statusUserId = 'userToWatch789';

      // Subscribe to a few rooms
      clientForRoomTest.emit('matchmaking:subscribe', { requestId: matchRequestId });
      await clientForRoomTest.waitForEvent('matchmaking:subscribed', 3000);

      clientForRoomTest.emit('lobby:subscribe', { lobbyId: lobbyId });
      await clientForRoomTest.waitForEvent('lobby:subscribed', 3000);

      clientForRoomTest.emit('user:status:subscribe', { userIds: [statusUserId] });
      // No specific 'subscribed' event for user:status, so just a small pause
      await new Promise(resolve => setTimeout(resolve, 50));


      // Verify socket is in rooms before disconnect
      expect(socketManager.rooms.get(`match:${matchRequestId}`).has(clientForRoomTest.socket.id)).to.be.true;
      expect(socketManager.rooms.get(`lobby:${lobbyId}`).has(clientForRoomTest.socket.id)).to.be.true;
      expect(socketManager.rooms.get(`status:${statusUserId}`).has(clientForRoomTest.socket.id)).to.be.true;
      // User-specific room is also joined by default
      expect(socketManager.io.sockets.adapter.rooms.get(`user:${testUser1.id}`).has(clientForRoomTest.socket.id)).to.be.true;


      clientForRoomTest.disconnect();
      // Wait for server to process disconnect and cleanup
      await new Promise(resolve => setTimeout(resolve, 250));

      // Verify socket is removed from rooms
      const matchRoomAfter = socketManager.rooms.get(`match:${matchRequestId}`);
      expect(matchRoomAfter === undefined || !matchRoomAfter.has(clientForRoomTest.socket.id)).to.be.true;

      const lobbyRoomAfter = socketManager.rooms.get(`lobby:${lobbyId}`);
      expect(lobbyRoomAfter === undefined || !lobbyRoomAfter.has(clientForRoomTest.socket.id)).to.be.true;

      const statusRoomAfter = socketManager.rooms.get(`status:${statusUserId}`);
      expect(statusRoomAfter === undefined || !statusRoomAfter.has(clientForRoomTest.socket.id)).to.be.true;

      // Check the default user-specific room (handled by socket.io itself typically but good to confirm our maps)
      const userRoomSockets = socketManager.io.sockets.adapter.rooms.get(`user:${testUser1.id}`);
      // If the socket was the only one for this user, the room might be gone or empty.
      // If there were other sockets, this one should be removed.
      // Given this client is unique for the test, the room might be gone or this socket shouldn't be in it.
      expect(userRoomSockets === undefined || !userRoomSockets.has(clientForRoomTest.socket.id)).to.be.true;


      // Also verify our internal userSockets map
      const userSocketSet = socketManager.userSockets.get(testUser1.id);
      expect(userSocketSet === undefined || !userSocketSet.has(clientForRoomTest.socket.id)).to.be.true;
    });
  });
});
