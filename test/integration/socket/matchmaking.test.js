const { expect } = require('chai');
const app = require('../../../src/app');
const socketManager = require('../../../src/services/socketManager');
const authService = require('../../../src/modules/auth/services/authService');
const matchmakingService = require('../../../src/modules/matchmaking/services/matchmakingService');
const User = require('../../../src/modules/auth/models/User');
const Game = require('../../../src/modules/game/models/Game');
const MatchRequest = require('../../../src/modules/matchmaking/models/MatchRequest');
const TestSocketClient = require('../../utils/socketClient');
const { testUsers, testGames } = require('../../fixtures');
const queueManager = require('../../../src/modules/matchmaking/services/queueManager');
const http = require('http');

describe('Socket.IO Matchmaking Events', () => {
  let server;
  let serverUrl; // To store the server address
  let authToken;
  let testUser;
  let testGame;
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
    await Game.deleteMany({});
    await MatchRequest.deleteMany({});
    queueManager.clearQueues(); // Clear queue manager state

    testGame = await Game.create(testGames[0]);

    const result = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    authToken = result.accessToken;
    testUser = result.user;

    socketClient = new TestSocketClient();
    await socketClient.connect(serverUrl, authToken);
    await socketClient.waitForEvent('connected', 8000); // Wait for connected event
  });

  afterEach(() => {
    if (socketClient) {
      socketClient.disconnect();
    }
  });

  describe('Matchmaking Subscription', () => {
    it('should subscribe to matchmaking updates', async () => {
      const matchRequest = await matchmakingService.submitMatchRequest(testUser.id, {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA']
      });

      socketClient.emit('matchmaking:subscribe', {
        requestId: matchRequest._id.toString()
      });

      const subscribed = await socketClient.waitForEvent('matchmaking:subscribed', 3000); // Increased timeout slightly
      expect(subscribed.requestId).to.equal(matchRequest._id.toString());
    });

    it('should receive matchmaking status updates', async () => {
      const criteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA']
      };

      // Submit the request *first*. The initial emit from submitMatchRequest might be missed
      // as the client isn't subscribed to the match-specific room yet.
      const matchRequest = await matchmakingService.submitMatchRequest(testUser.id, criteria);

      // Now, subscribe the client to the specific match request room
      socketClient.emit('matchmaking:subscribe', {
        requestId: matchRequest._id.toString()
      });
      await socketClient.waitForEvent('matchmaking:subscribed', 2000); // Wait for subscription confirmation

      // We expect a 'searching' status. This might come from the periodic queue processing
      // or a triggered processing after request addition.
      const statusUpdate = await socketClient.waitForEvent('matchmaking:status', 7000); // Increased timeout

      expect(statusUpdate.requestId).to.equal(matchRequest._id.toString());
      expect(statusUpdate.status).to.equal('searching');
      expect(statusUpdate).to.have.property('searchTime');
      expect(statusUpdate).to.have.property('estimatedTime');
    });

    it('should unsubscribe from matchmaking updates', async () => {
      const matchRequest = await matchmakingService.submitMatchRequest(testUser.id, {
        games: [{ gameId: testGame._id.toString() }],
        gameMode: 'casual'
      });

      const requestId = matchRequest._id.toString();

      socketClient.emit('matchmaking:subscribe', { requestId });
      await socketClient.waitForEvent('matchmaking:subscribed');

      socketClient.emit('matchmaking:unsubscribe', { requestId });
      const unsubscribed = await socketClient.waitForEvent('matchmaking:unsubscribed');
      expect(unsubscribed.requestId).to.equal(requestId);
    });
  });

  describe('Match Formation Notifications', () => {
    it('should notify when match is found', async function () {
      this.timeout(10000);

      const user2Result = await authService.register({
        email: testUsers[1].email,
        username: testUsers[1].username,
        password: testUsers[1].password
      });

      const client2 = new TestSocketClient();
      await client2.connect(serverUrl, user2Result.accessToken); // Pass serverUrl

      const criteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA']
      };

      const [request1, request2] = await Promise.all([
        matchmakingService.submitMatchRequest(testUser.id, criteria),
        matchmakingService.submitMatchRequest(user2Result.user.id, criteria)
      ]);

      socketClient.emit('matchmaking:subscribe', {
        requestId: request1._id.toString()
      });
      client2.emit('matchmaking:subscribe', {
        requestId: request2._id.toString()
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // Delay for subscription processing

      const [matchStatus1, matchStatus2] = await Promise.all([
        socketClient.waitForEvent('matchmaking:status', 8000),
        client2.waitForEvent('matchmaking:status', 8000)
      ]);

      expect(matchStatus1.status).to.equal('matched');
      expect(matchStatus2.status).to.equal('matched');
      expect(matchStatus1.matchId).to.equal(matchStatus2.matchId);
      expect(matchStatus1.participants).to.have.lengthOf(2);
      expect(matchStatus2.participants).to.have.lengthOf(2);

      client2.disconnect();
    });
  });
});
