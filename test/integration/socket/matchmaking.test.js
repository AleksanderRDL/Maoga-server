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
  let serverUrl;
  let authTokenUser1, authTokenUser2;
  let testUser1, testUser2;
  let testGame;
  let clientUser1, clientUser2; // Renamed for clarity

  before(async () => {
    server = http.createServer(app);
    await new Promise(resolve => {
      server.listen(0, 'localhost', () => {
        const address = server.address();
        serverUrl = `http://localhost:${address.port}`;
        console.log(`Matchmaking Test Server listening on ${serverUrl}`);
        resolve();
      });
    });
    socketManager.initialize(server);
    await new Promise(resolve => setTimeout(resolve, 200)); // Allow Socket.IO to fully start
    console.log('Test Setup: Socket.IO initialized for Matchmaking tests.');

  });

  after(async () => {
    if (socketManager.io) {
      socketManager.io.close();
    }
    if (server && server.listening) {
      await new Promise(resolve => server.close(resolve));
      console.log(`Matchmaking Test Server closed`);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Game.deleteMany({});
    await MatchRequest.deleteMany({});
    if (queueManager.clearQueues) queueManager.clearQueues();
    if (socketManager.userSockets && typeof socketManager.userSockets.clear === 'function') {
      socketManager.userSockets.clear();
    }
    if (socketManager.socketUsers && typeof socketManager.socketUsers.clear === 'function') {
      socketManager.socketUsers.clear();
    }
    if (socketManager.rooms && typeof socketManager.rooms.clear === 'function') {
      socketManager.rooms.clear();
    }


    testGame = await Game.create(testGames[0]);

    const result1 = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password,
    });
    authTokenUser1 = result1.accessToken;
    testUser1 = result1.user;

    clientUser1 = new TestSocketClient(serverUrl, authTokenUser1);
    // Connect clientUser1 here, as most tests will need it.
    // Specific tests can manage their own client connections if needed.
    const connectedEventPromise = clientUser1.waitForEvent('connected', 8000);
    await clientUser1.connect();
    await connectedEventPromise;
  });

  afterEach(async () => {
    if (clientUser1) clientUser1.disconnect();
    if (clientUser2) clientUser2.disconnect(); // Ensure clientUser2 is also cleaned up
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
  });

  describe('Matchmaking Subscription', () => {
    it('should subscribe to matchmaking updates', async () => {
      const matchRequest = await matchmakingService.submitMatchRequest(testUser1.id, {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA'],
      });

      clientUser1.emit('matchmaking:subscribe', {
        requestId: matchRequest._id.toString(),
      });

      const subscribed = await clientUser1.waitForEvent('matchmaking:subscribed', 5000);
      expect(subscribed.requestId).to.equal(matchRequest._id.toString());
    });

    it('should receive matchmaking status updates', async () => {
      const criteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA'],
      };
      const matchRequest = await matchmakingService.submitMatchRequest(testUser1.id, criteria);

      clientUser1.emit('matchmaking:subscribe', { requestId: matchRequest._id.toString() });
      await clientUser1.waitForEvent('matchmaking:subscribed', 3000);

      // Status update should now come shortly after subscription due to changes in socketManager
      const statusUpdate = await clientUser1.waitForEvent('matchmaking:status', 7000);

      expect(statusUpdate.requestId).to.equal(matchRequest._id.toString());
      expect(statusUpdate.status).to.equal('searching');
      expect(statusUpdate).to.have.property('searchTime');
      expect(statusUpdate).to.have.property('estimatedTime');
    });

    it('should unsubscribe from matchmaking updates', async () => {
      const matchRequest = await matchmakingService.submitMatchRequest(testUser1.id, {
        games: [{ gameId: testGame._id.toString() }],
        gameMode: 'casual',
      });
      const requestId = matchRequest._id.toString();

      clientUser1.emit('matchmaking:subscribe', { requestId });
      await clientUser1.waitForEvent('matchmaking:subscribed', 3000);

      clientUser1.emit('matchmaking:unsubscribe', { requestId });
      const unsubscribed = await clientUser1.waitForEvent('matchmaking:unsubscribed', 3000);
      expect(unsubscribed.requestId).to.equal(requestId);
    });
  });

  describe('Match Formation Notifications', () => {
    it('should notify when match is found', async function () {
      this.timeout(15000); // Increased timeout for multi-client test

      const user2Data = await authService.register({
        email: testUsers[1].email,
        username: testUsers[1].username,
        password: testUsers[1].password,
      });
      authTokenUser2 = user2Data.accessToken;
      testUser2 = user2Data.user;

      clientUser2 = new TestSocketClient(serverUrl, authTokenUser2);
      const client2ConnectedPromise = clientUser2.waitForEvent('connected', 8000);
      await clientUser2.connect();
      await client2ConnectedPromise;


      const criteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA'],
      };

      // Submit requests via service
      const request1 = await matchmakingService.submitMatchRequest(testUser1.id, criteria);
      const request2 = await matchmakingService.submitMatchRequest(testUser2.id, criteria);

      // Subscribe clients
      clientUser1.emit('matchmaking:subscribe', { requestId: request1._id.toString() });
      clientUser2.emit('matchmaking:subscribe', { requestId: request2._id.toString() });

      // Wait for subscription confirmations (optional, but good for ensuring order)
      await clientUser1.waitForEvent('matchmaking:subscribed', 3000);
      await clientUser2.waitForEvent('matchmaking:subscribed', 3000);

      // Wait for match status updates.
      // The matchmakingService.processSpecificQueue will eventually form a match
      // and socketManager.emitMatchmakingStatus will send the 'matched' status.
      const [matchStatus1, matchStatus2] = await Promise.all([
        clientUser1.waitForEvent('matchmaking:status', 12000), // Increased timeout
        clientUser2.waitForEvent('matchmaking:status', 12000), // Increased timeout
      ]);

      expect(matchStatus1.status).to.equal('matched');
      expect(matchStatus2.status).to.equal('matched');
      expect(matchStatus1.matchId).to.exist;
      expect(matchStatus1.matchId).to.equal(matchStatus2.matchId);
      expect(matchStatus1.participants).to.be.an('array').with.lengthOf(2);
      expect(matchStatus2.participants).to.be.an('array').with.lengthOf(2);

      // Verify participants include both users
      const participantIds1 = matchStatus1.participants.map(p => p.userId);
      const participantIds2 = matchStatus2.participants.map(p => p.userId);

      expect(participantIds1).to.include.members([testUser1.id.toString(), testUser2.id.toString()]);
      expect(participantIds2).to.include.members([testUser1.id.toString(), testUser2.id.toString()]);
    });
  });
});