const { expect } = require('chai');
const app = require('../../../src/app');
const socketManager = require('../../../src/services/socketManager');
const authService = require('../../../src/modules/auth/services/authService');
const User = require('../../../src/modules/auth/models/User');
const TestSocketClient = require('../../utils/socketClient');
const { testUsers } = require('../../fixtures/users');
const http = require('http');

describe('Socket.IO Connection', () => {
  let server;
  let serverUrl; // To store the server address
  let authToken;
  let testUser;
  let socketClient;

  before(async () => {
    server = http.createServer(app); // Create an HTTP server instance from your Express app

    await new Promise(resolve => {
      server.listen(0, 'localhost', () => { // Listen on port 0 for a random available port
        const address = server.address();
        serverUrl = `http://localhost:${address.port}`;
        // console.log(`Test server for ${__filename} listening on ${serverUrl}`); // Optional: for debugging
        resolve();
      });
    });

    // Initialize Socket.IO AFTER the server is confirmed listening
    // Pass the actual http.Server instance
    socketManager.initialize(server);

    // Add a small delay to ensure Socket.IO is fully initialized
    await new Promise(resolve => setTimeout(resolve, 100));


    if (socketManager.io) {
      console.log('Test Setup: Socket.IO initialized on server.');
    } else {
      console.error('Test Setup: Socket.IO FAILED to initialize on server.');
    }
  });

  after(async () => {
    // Ensure client sockets are disconnected first
    // If socketClient is initialized per test in a beforeEach, handle its disconnection in an afterEach
    // This is a general cleanup for the server related resources.
    if (socketManager.io) {
      socketManager.io.close(); // Close all Socket.IO connections
    }
    if (server && server.listening) {
      await new Promise(resolve => server.close(resolve));
      // console.log(`Test server for ${__filename} closed`); // Optional: for debugging
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    socketManager.userSockets.clear();
    socketManager.socketUsers.clear();

    const result = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    authToken = result.accessToken;
    testUser = result.user;

    socketClient = new TestSocketClient();
  });

  afterEach(() => {
    if (socketClient) {
      socketClient.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should connect with valid JWT token', async () => {
      const socket = await socketClient.connect(serverUrl, authToken);
      expect(socket.connected).to.be.true;

      const connectedData = await socketClient.waitForEvent('connected');
      expect(connectedData.userId).to.equal(testUser.id);
    });

    it('should reject connection without token', async () => {
      try {
        await socketClient.connect(serverUrl, null);
        expect.fail('Should have thrown error');
      } catch (error) {
        const errorMessage = error.data?.message || error.message;
        expect(errorMessage).to.include('No token provided');
      }
    });

    it('should reject connection with invalid token', async () => {
      try {
        await socketClient.connect(serverUrl, 'invalid-token');
        expect.fail('Should have thrown error');
      } catch (error) {
        const errorMessage = error.data?.message || error.message;
        expect(errorMessage).to.include('Authentication failed');
      }
    });
  });

  describe('User Presence', () => {
    it('should update user status to online on connect', async () => {
      await socketClient.connect(serverUrl, authToken);

      const onlineUsers = socketManager.getOnlineUsers([testUser.id]);
      expect(onlineUsers).to.include(testUser.id);
      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(1);
    });

    it('should handle multiple connections from same user', async () => {
      const client1 = new TestSocketClient();
      const client2 = new TestSocketClient();

      await client1.connect(serverUrl, authToken);
      await client2.connect(serverUrl, authToken);

      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(2);

      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 200)); // Allow server to process disconnect

      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(1);

      client2.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 200)); // Allow server to process disconnect
      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(0);
    });

    it('should emit user status updates', async () => {
      const watcherClient = new TestSocketClient();
      const watcherUser = await authService.register({
        email: 'watcher@example.com',
        username: 'watcher',
        password: 'TestPassword123!'
      });
      const watcherToken = watcherUser.accessToken;

      await watcherClient.connect(serverUrl, watcherToken);

      watcherClient.emit('user:status:subscribe', { userIds: [testUser.id] });

      const initialStatus = await watcherClient.waitForEvent('user:status:update');
      expect(initialStatus.statuses[testUser.id]).to.equal('offline');

      await socketClient.connect(serverUrl, authToken);

      const statusUpdate = await watcherClient.waitForEvent('user:status');
      expect(statusUpdate.userId).to.equal(testUser.id);
      expect(statusUpdate.status).to.equal('online');

      socketClient.disconnect(); // Disconnect the target user
      const offlineUpdate = await watcherClient.waitForEvent('user:status'); // Wait for the offline update
      expect(offlineUpdate.userId).to.equal(testUser.id);
      expect(offlineUpdate.status).to.equal('offline');

      watcherClient.disconnect();
    });
  });
});
