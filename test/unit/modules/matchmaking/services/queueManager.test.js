const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

process.env.USE_REDIS_MOCK = 'true';

const redisManager = require('../../../../../src/services/redis');
const queueManager = require('../../../../../src/modules/matchmaking/services/queueManager');
const MatchRequest = require('../../../../../src/modules/matchmaking/models/MatchRequest');
const { BadRequestError, ConflictError } = require('../../../../../src/utils/errors');

describe('QueueManager (redis backed)', () => {
  let sandbox;

  const buildRequest = ({
    userId = new mongoose.Types.ObjectId(),
    gameId = new mongoose.Types.ObjectId(),
    gameMode = 'competitive',
    region = 'NA',
    requestId = new mongoose.Types.ObjectId(),
    matchExpireTime = null
  } = {}) => {
    const request = new MatchRequest({
      _id: requestId,
      userId,
      criteria: {
        games: [{ gameId, weight: 10 }],
        gameMode,
        regions: [region],
        groupSize: { min: 1, max: 5 },
        regionPreference: 'preferred',
        languagePreference: 'any',
        skillPreference: 'similar'
      },
      matchExpireTime,
      searchStartTime: new Date()
    });

    sandbox.stub(request, 'isExpired').returns(false);
    sandbox.stub(request, 'getPrimaryGame').returns({ gameId, weight: 10 });
    return request;
  };

  before(async () => {
    await redisManager.connect();
    queueManager.redis = redisManager.getClient();
    await queueManager.clearQueues();
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    await queueManager.clearQueues();
  });

  afterEach(async () => {
    await queueManager.clearQueues();
    sandbox.restore();
  });

  after(async () => {
    await queueManager.clearQueues();
    await redisManager.disconnect();
  });

  describe('addRequest', () => {
    it('enqueues a valid request and exposes queue metadata', async () => {
      const gameId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const request = buildRequest({ userId, gameId });

      await queueManager.addRequest(request);

      const findStub = sandbox.stub(MatchRequest, 'find').resolves([request]);

      const queue = await queueManager.getQueueRequests(gameId.toString(), 'competitive', 'NA');
      expect(queue).to.have.lengthOf(1);
      expect(queue[0]._id.toString()).to.equal(request._id.toString());

      const userInfo = await queueManager.getUserRequest(userId.toString());
      expect(userInfo).to.include({
        requestId: request._id.toString(),
        gameId: gameId.toString(),
        gameMode: 'competitive'
      });

      const stats = await queueManager.getStats();
      expect(stats.totalRequests).to.equal(1);
      expect(stats.activeRequests).to.equal(1);
      expect(stats.queueSizes[gameId.toString()].competitive.NA).to.equal(1);

      findStub.restore();
    });

    it('rejects duplicate active requests for the same user', async () => {
      const userId = new mongoose.Types.ObjectId();
      const gameId = new mongoose.Types.ObjectId();
      const firstRequest = buildRequest({ userId, gameId });
      await queueManager.addRequest(firstRequest);

      const duplicate = buildRequest({ userId, gameId });
      try {
        await queueManager.addRequest(duplicate);
        throw new Error('Expected conflict error to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictError);
        expect(error.message).to.equal('User already has an active match request in queue');
      }
    });

    it('rejects requests without a primary game', async () => {
      const request = new MatchRequest({
        userId: new mongoose.Types.ObjectId(),
        criteria: {
          games: [],
          gameMode: 'competitive',
          regions: ['NA'],
          groupSize: { min: 1, max: 5 },
          regionPreference: 'preferred',
          languagePreference: 'any',
          skillPreference: 'similar'
        },
        searchStartTime: new Date()
      });

      sandbox.stub(request, 'isExpired').returns(false);
      sandbox.stub(request, 'getPrimaryGame').returns(null);

      expect(request.criteria.games).to.have.lengthOf(0);
      expect(request.getPrimaryGame()).to.equal(null);

      try {
        await queueManager.addRequest(request);
        throw new Error('Expected bad request error to be thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 400);
        expect(error.message).to.equal('No primary game specified in match request criteria');
      }
    });
  });

  describe('removeRequest', () => {
    it('removes an existing request and updates stats', async () => {
      const userId = new mongoose.Types.ObjectId();
      const gameId = new mongoose.Types.ObjectId();
      const request = buildRequest({ userId, gameId });
      await queueManager.addRequest(request);

      const removed = await queueManager.removeRequest(userId.toString(), request._id.toString());
      expect(removed).to.be.true;

      const findStub = sandbox.stub(MatchRequest, 'find').resolves([]);
      const queue = await queueManager.getQueueRequests(gameId.toString(), 'competitive', 'NA');
      expect(queue).to.be.empty;
      findStub.restore();

      const stats = await queueManager.getStats();
      expect(stats.activeRequests).to.equal(0);
      expect(await queueManager.getUserRequest(userId.toString())).to.be.null;
    });

    it('returns false when request cannot be found', async () => {
      const removed = await queueManager.removeRequest(
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString()
      );
      expect(removed).to.be.false;
    });
  });

  describe('cleanupExpiredRequests', () => {
    it('removes requests whose expiry timestamp has passed', async () => {
      const stillActive = buildRequest({
        userId: new mongoose.Types.ObjectId(),
        gameId: new mongoose.Types.ObjectId()
      });
      const expired = buildRequest({
        userId: new mongoose.Types.ObjectId(),
        gameId: stillActive.criteria.games[0].gameId,
        matchExpireTime: new Date(Date.now() - 1000)
      });
      expired.isExpired.returns(true);

      await queueManager.addRequest(stillActive);
      await queueManager.addRequest(expired);

      await queueManager.cleanupExpiredRequests();

      const findStub = sandbox.stub(MatchRequest, 'find').resolves([stillActive]);
      const queue = await queueManager.getQueueRequests(
        stillActive.criteria.games[0].gameId.toString(),
        'competitive',
        'NA'
      );
      expect(queue).to.have.lengthOf(1);
      expect(queue[0]._id.toString()).to.equal(stillActive._id.toString());
      findStub.restore();

      const stats = await queueManager.getStats();
      expect(stats.activeRequests).to.equal(1);
    });
  });

  describe('getStats', () => {
    it('aggregates queue sizes across regions', async () => {
      const gameId = new mongoose.Types.ObjectId();
      const requestNA = buildRequest({ userId: new mongoose.Types.ObjectId(), gameId, region: 'NA' });
      const requestEU = buildRequest({ userId: new mongoose.Types.ObjectId(), gameId, region: 'EU' });

      await queueManager.addRequest(requestNA);
      await queueManager.addRequest(requestEU);

      const stats = await queueManager.getStats();
      expect(stats.queueSizes[gameId.toString()].competitive.NA).to.equal(1);
      expect(stats.queueSizes[gameId.toString()].competitive.EU).to.equal(1);
    });
  });

  describe('updateStats', () => {
    it('tracks matches formed and wait time averages', async () => {
      await queueManager.updateStats(true, 2000);
      await queueManager.updateStats(true, 4000);

      const stats = await queueManager.getStats();
      expect(stats.matchesFormed).to.equal(2);
      expect(stats.avgWaitTime).to.equal(3000);
    });
  });
});







