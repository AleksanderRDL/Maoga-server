// test/integration/api/matchmaking.test.js
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const Game = require('../../../src/modules/game/models/Game');
const MatchRequest = require('../../../src/modules/matchmaking/models/MatchRequest');
const MatchHistory = require('../../../src/modules/matchmaking/models/MatchHistory');
const authService = require('../../../src/modules/auth/services/authService');
// matchmakingService is used for match formation test, so it's okay here.
const matchmakingService = require('../../../src/modules/matchmaking/services/matchmakingService');
const queueManager = require('../../../src/modules/matchmaking/services/queueManager');
const { testUsers } = require('../../fixtures/users');
const { testGames } = require('../../fixtures/games');

describe('Matchmaking API', () => {
  let authToken1, authToken2, authToken3;
  let user1, user2, user3;
  let testGame;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Clean up collections
    await User.deleteMany({});
    await Game.deleteMany({});
    await MatchRequest.deleteMany({});
    await MatchHistory.deleteMany({});

    // Clear queues
    queueManager.clearQueues();

    // Create test game
    testGame = await Game.create(testGames[0]);

    // Create test users with game profiles
    const userResults = await Promise.all([
      authService.register({
        email: testUsers[0].email,
        username: testUsers[0].username,
        password: testUsers[0].password
      }),
      authService.register({
        email: testUsers[1].email,
        username: testUsers[1].username,
        password: testUsers[1].password
      }),
      authService.register({
        email: 'player3@example.com',
        username: 'player3',
        password: 'TestPassword123!'
      })
    ]);

    authToken1 = userResults[0].accessToken;
    user1 = userResults[0].user;
    authToken2 = userResults[1].accessToken;
    user2 = userResults[1].user;
    authToken3 = userResults[2].accessToken;
    user3 = userResults[2].user;

    // Add game profiles for skill-based matching
    await User.updateMany(
        { _id: { $in: [user1.id, user2.id, user3.id] } },
        {
          $push: {
            gameProfiles: {
              gameId: testGame._id,
              inGameName: 'TestPlayer',
              skillLevel: 50,
              rank: 'Gold'
            }
          },
          $set: {
            'gamingPreferences.regions': ['NA', 'EU'],
            'gamingPreferences.languages': ['en']
          }
        }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('POST /api/matchmaking', () => {
    it('should submit a matchmaking request successfully', async () => {
      const matchCriteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA'],
        skillPreference: 'similar'
      };

      const res = await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(matchCriteria)
          .expect(201);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.matchRequest).to.have.property('_id');
      expect(res.body.data.matchRequest.status).to.equal('searching');
      expect(res.body.data.matchRequest.userId).to.equal(user1.id);
      expect(res.body.data.matchRequest.criteria.games).to.have.lengthOf(1);

      // Verify request is in queue
      const queueInfo = queueManager.getUserRequest(user1.id);
      expect(queueInfo).to.exist;
      expect(queueInfo.gameId).to.equal(testGame._id.toString());
    });

    it('should prevent duplicate active requests', async () => {
      const matchCriteria = {
        games: [{ gameId: testGame._id.toString() }],
        gameMode: 'casual'
      };

      // First request
      await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(matchCriteria)
          .expect(201);

      // Duplicate request
      const res = await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(matchCriteria)
          .expect(409);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('User already has an active matchmaking request');
    });

    it('should validate match criteria', async () => {
      const res = await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            games: [], // Empty games array
            gameMode: 'competitive'
          })
          .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should handle scheduled matchmaking', async () => {
      const scheduledTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const res = await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            games: [{ gameId: testGame._id.toString() }],
            gameMode: 'competitive',
            scheduledTime
          })
          .expect(201);

      expect(res.body.data.matchRequest.criteria.scheduledTime).to.exist;
      expect(new Date(res.body.data.matchRequest.criteria.scheduledTime)).to.be.greaterThan(
          new Date()
      );
    });
  });

  describe('GET /api/matchmaking/status', () => {
    it('should return current matchmaking status', async () => {
      // Submit a request first
      await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            games: [{ gameId: testGame._id.toString() }],
            gameMode: 'casual'
          });

      const res = await request(app)
          .get('/api/matchmaking/status')
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.request).to.exist;
      expect(res.body.data.request.status).to.equal('searching');
      expect(res.body.data.queueInfo).to.exist;
    });

    it('should return null when no active request', async () => {
      const res = await request(app)
          .get('/api/matchmaking/status')
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.matchRequest).to.be.null; // Corrected from data.request to data.matchRequest
    });
  });

  describe('DELETE /api/matchmaking/:requestId', () => {
    it('should cancel matchmaking request', async () => {
      // Submit a request
      const submitRes = await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            games: [{ gameId: testGame._id.toString() }],
            gameMode: 'casual'
          });

      const requestId = submitRes.body.data.matchRequest._id;

      // Cancel it
      const res = await request(app)
          .delete(`/api/matchmaking/${requestId}`)
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.matchRequest.status).to.equal('cancelled');

      // Verify removed from queue
      const queueInfo = queueManager.getUserRequest(user1.id);
      expect(queueInfo).to.be.undefined;
    });

    it('should not allow cancelling other users requests', async () => {
      // User 1 submits request
      const submitRes = await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            games: [{ gameId: testGame._id.toString() }],
            gameMode: 'casual'
          });

      const requestId = submitRes.body.data.matchRequest._id;

      // User 2 tries to cancel
      const res = await request(app)
          .delete(`/api/matchmaking/${requestId}`)
          .set('Authorization', `Bearer ${authToken2}`)
          .expect(404);

      expect(res.body.status).to.equal('error');
    });
  });

  describe('Match Formation', () => {
    it('should form a match when compatible players are found', async function () {
      this.timeout(10000); // Increase timeout for match processing

      // Submit requests from multiple users
      const criteria = {
        games: [{ gameId: testGame._id.toString(), weight: 10 }],
        gameMode: 'competitive',
        regions: ['NA'],
        skillPreference: 'similar'
      };

      // Stop periodic processing to control match formation manually for the test
      const originalIsProcessing = matchmakingService.isProcessing;
      const originalProcessInterval = matchmakingService.processInterval;
      matchmakingService.stopProcessing(); // Stop periodic processing


      await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(criteria);
      await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken2}`)
          .send(criteria);


      // Manually trigger processing for the relevant queue
      // Ensure requests are in the queue before processing
      await new Promise(resolve => setTimeout(resolve, 200)); // Short delay for requests to hit queue manager
      await matchmakingService.processSpecificQueue(testGame._id.toString(), 'competitive', 'NA');


      // Wait a bit for match finalization and DB updates
      await new Promise((resolve) => setTimeout(resolve, 2000));


      const matches = await MatchHistory.find({});
      expect(matches).to.have.lengthOf(1);
      expect(matches[0].participants).to.have.lengthOf(2);
      expect(matches[0].gameId.toString()).to.equal(testGame._id.toString());
      expect(matches[0].matchQuality.overallScore).to.be.greaterThan(50);

      const requests = await MatchRequest.find({ userId: { $in: [user1.id, user2.id] } });
      requests.forEach((req) => {
        expect(req.status).to.equal('matched');
      });

      // Restore original processing state if needed
      matchmakingService.isProcessing = originalIsProcessing;
      if (originalProcessInterval) { // Only restart if it was running
        matchmakingService.startProcessing();
      }
    });

    it('should not match players with incompatible criteria', async function () {
      this.timeout(10000);
      const originalIsProcessing = matchmakingService.isProcessing;
      const originalProcessInterval = matchmakingService.processInterval;
      matchmakingService.stopProcessing();

      // User 1: Competitive mode
      await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken1}`)
          .send({
            games: [{ gameId: testGame._id.toString() }],
            gameMode: 'competitive',
            regions: ['NA']
          });

      // User 2: Casual mode (incompatible)
      await request(app)
          .post('/api/matchmaking')
          .set('Authorization', `Bearer ${authToken2}`)
          .send({
            games: [{ gameId: testGame._id.toString() }],
            gameMode: 'casual',
            regions: ['NA']
          });

      await new Promise(resolve => setTimeout(resolve, 200));
      await matchmakingService.processSpecificQueue(testGame._id.toString(), 'competitive', 'NA');
      await matchmakingService.processSpecificQueue(testGame._id.toString(), 'casual', 'NA');


      await new Promise((resolve) => setTimeout(resolve, 1000));

      const matches = await MatchHistory.find({});
      expect(matches).to.have.lengthOf(0);

      matchmakingService.isProcessing = originalIsProcessing;
      if (originalProcessInterval) {
        matchmakingService.startProcessing();
      }
    });
  });

  describe('GET /api/matchmaking/history', () => {
    beforeEach(async () => {
      // Create some match history
      await MatchHistory.create([
        {
          participants: [{ userId: user1.id }, { userId: user2.id }],
          gameId: testGame._id,
          gameMode: 'competitive',
          status: 'completed',
          matchQuality: { overallScore: 85 }
        },
        {
          participants: [{ userId: user1.id }, { userId: user3.id }],
          gameId: testGame._id,
          gameMode: 'casual',
          status: 'completed',
          matchQuality: { overallScore: 90 }
        }
      ]);
    });

    it('should return user match history', async () => {
      const res = await request(app)
          .get('/api/matchmaking/history')
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.matches).to.have.lengthOf(2);
      expect(res.body.data.pagination.total).to.equal(2);
    });

    it('should filter by game and status', async () => {
      const res = await request(app)
          .get('/api/matchmaking/history')
          .set('Authorization', `Bearer ${authToken1}`)
          .query({
            gameId: testGame._id.toString(),
            status: 'completed'
          })
          .expect(200);

      expect(res.body.data.matches).to.have.lengthOf(2);
      res.body.data.matches.forEach((match) => {
        expect(match.status).to.equal('completed');
        expect(match.gameId._id).to.equal(testGame._id.toString());
      });
    });
  });

  describe('GET /api/matchmaking/stats (Admin)', () => {
    let adminToken;

    beforeEach(async () => {
      // Create admin user
      const adminResult = await authService.register({
        email: 'admin@example.com',
        username: 'admin',
        password: 'AdminPassword123!',
        role: 'admin'
      });
      adminToken = adminResult.accessToken;
    });

    it('should return matchmaking statistics', async () => {
      const res = await request(app)
          .get('/api/matchmaking/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.stats).to.have.property('queues');
      expect(res.body.data.stats).to.have.property('matches');
      expect(res.body.data.stats.queues).to.have.property('totalRequests');
      expect(res.body.data.stats.matches).to.have.property('totalMatches');
    });

    it('should require admin role', async () => {
      const res = await request(app)
          .get('/api/matchmaking/stats')
          .set('Authorization', `Bearer ${authToken1}`) // Using non-admin token
          .expect(403);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('Insufficient permissions');
    });
  });
});