const { expect } = require('chai');
const app = require('../../../src/app');
const socketManager = require('../../../src/services/socketManager');
const authService = require('../../../src/modules/auth/services/authService');
const User = require('../../../src/modules/auth/models/User');
const TestSocketClient = require('../../utils/socketClient');
const { testUsers } = require('../../fixtures/users');

describe('Socket.IO Connection', () => {
  let server;
  let authToken;
  let testUser;
  let socketClient;

  before(async () => {
    // Start server
    server = app.listen(0); // Random port
    socketManager.initialize(server);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    socketManager.userSockets.clear();
    socketManager.socketUsers.clear();

    // Create test user
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
      const socket = await socketClient.connect(authToken);
      expect(socket.connected).to.be.true;

      const connectedData = await socketClient.waitForEvent('connected');
      expect(connectedData.userId).to.equal(testUser.id);
    });

    it('should reject connection without token', async () => {
      try {
        await socketClient.connect(null);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No token provided');
      }
    });

    it('should reject connection with invalid token', async () => {
      try {
        await socketClient.connect('invalid-token');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed');
      }
    });
  });

  describe('User Presence', () => {
    it('should update user status to online on connect', async () => {
      await socketClient.connect(authToken);

      const onlineUsers = socketManager.getOnlineUsers([testUser.id]);
      expect(onlineUsers).to.include(testUser.id);
      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(1);
    });

    it('should handle multiple connections from same user', async () => {
      const client1 = new TestSocketClient();
      const client2 = new TestSocketClient();

      await client1.connect(authToken);
      await client2.connect(authToken);

      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(2);

      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(socketManager.getUserSocketCount(testUser.id)).to.equal(1);

      client2.disconnect();
    });

    it('should emit user status updates', async () => {
      const watcherClient = new TestSocketClient();
      const watcherToken = (
        await authService.register({
          email: 'watcher@example.com',
          username: 'watcher',
          password: 'TestPassword123!'
        })
      ).accessToken;

      await watcherClient.connect(watcherToken);

      // Subscribe to user status
      watcherClient.emit('user:status:subscribe', { userIds: [testUser.id] });

      const initialStatus = await watcherClient.waitForEvent('user:status:update');
      expect(initialStatus.statuses[testUser.id]).to.equal('offline');

      // Connect target user
      await socketClient.connect(authToken);

      const statusUpdate = await watcherClient.waitForEvent('user:status');
      expect(statusUpdate.userId).to.equal(testUser.id);
      expect(statusUpdate.status).to.equal('online');

      watcherClient.disconnect();
    });
  });
});
