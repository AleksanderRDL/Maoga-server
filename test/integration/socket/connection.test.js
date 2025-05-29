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
});
