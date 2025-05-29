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

describe('Socket.IO Matchmaking Events', () => {
  let server;
  let authToken;
  let testUser;
  let testGame;
  let socketClient;

  before(async () => {
    server = app.listen(0);
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
    await Game.deleteMany({});
    await MatchRequest.deleteMany({});

    // Create test data
    testGame = await Game.create(testGames[0]);

    const result = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    authToken = result.accessToken;
    testUser = result.user;

    socketClient = new TestSocketClient();
    await socketClient.connect(authToken);
  });

  afterEach(() => {
    if (socketClient) {
      socketClient.disconnect();
    }
  });

  describe('Matchmaking Subscription', () => {
    it('should subscribe to matchmaking updates', async () => {
      // Submit match request
      const matchRequest = await matchmakingService.submitMatchRequest(testUser.id, {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA']
      });

      // Subscribe to updates
      socketClient.emit('matchmaking:subscribe', {
        requestId: matchRequest._id.toString()
      });

      const subscribed = await socketClient.waitForEvent('matchmaking:subscribed');
      expect(subscribed.requestId).to.equal(matchRequest._id.toString());
    });

    it('should receive matchmaking status updates', async () => {
      const matchRequest = await matchmakingService.submitMatchRequest(testUser.id, {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA']
      });

      socketClient.emit('matchmaking:subscribe', {
        requestId: matchRequest._id.toString()
      });

      // Wait for initial status
      const statusUpdate = await socketClient.waitForEvent('matchmaking:status');
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

      // Create second user
      const user2Result = await authService.register({
        email: testUsers[1].email,
        username: testUsers[1].username,
        password: testUsers[1].password
      });

      const client2 = new TestSocketClient();
      await client2.connect(user2Result.accessToken);

      // Both users submit match requests
      const criteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA']
      };

      const [request1, request2] = await Promise.all([
        matchmakingService.submitMatchRequest(testUser.id, criteria),
        matchmakingService.submitMatchRequest(user2Result.user.id, criteria)
      ]);

      // Subscribe to updates
      socketClient.emit('matchmaking:subscribe', {
        requestId: request1._id.toString()
      });
      client2.emit('matchmaking:subscribe', {
        requestId: request2._id.toString()
      });

      // Wait for match formation
      const [match1, match2] = await Promise.all([
        socketClient.waitForEvent('matchmaking:status', 8000),
        client2.waitForEvent('matchmaking:status', 8000)
      ]);

      // Verify match notifications
      expect(match1.status).to.equal('matched');
      expect(match2.status).to.equal('matched');
      expect(match1.matchId).to.equal(match2.matchId);
      expect(match1.participants).to.have.lengthOf(2);

      client2.disconnect();
    });
  });
});
