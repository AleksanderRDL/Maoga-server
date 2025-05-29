const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const queueManager = require('../../../../../src/modules/matchmaking/services/queueManager');
const MatchRequest = require('../../../../../src/modules/matchmaking/models/MatchRequest');
const { BadRequestError, ConflictError } = require('../../../../../src/utils/errors');

describe('QueueManager', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        queueManager.clearQueues();
    });

    afterEach(() => {
        sandbox.restore();
        queueManager.clearQueues();
    });

    // Refined createMockRequest
    const createMockRequest = (userIdStr, gameIdStr, gameMode = 'competitive', region = 'NA', requestIdStr, isExpiredVal = false) => {
        const reqId = requestIdStr ? new mongoose.Types.ObjectId(requestIdStr) : new mongoose.Types.ObjectId();
        const uId = new mongoose.Types.ObjectId(userIdStr);
        const gId = new mongoose.Types.ObjectId(gameIdStr);

        const mockPrimaryGame = { gameId: gId, weight: 10 };

        // Create a real MatchRequest instance to ensure prototype methods are available
        const reqInstance = new MatchRequest({
            _id: reqId,
            userId: uId,
            criteria: {
                games: [{ gameId: gId, weight: 10 }],
                gameMode: gameMode,
                regions: [region],
                groupSize: { min: 1, max: 5 }, // Added default to avoid potential validation issues
                regionPreference: 'preferred', // Added default
                languagePreference: 'any',   // Added default
                skillPreference: 'similar',  // Added default
            },
            searchStartTime: new Date(),
        });

        // Stub methods directly on the instance
        sinon.stub(reqInstance, 'isExpired').returns(isExpiredVal);
        sinon.stub(reqInstance, 'getPrimaryGame').returns(mockPrimaryGame);

        return reqInstance;
    };


    describe('addRequest', () => {
        it('should add a valid request to the queue', () => {
            const gameIdForTest = new mongoose.Types.ObjectId();
            const userIdForTest = new mongoose.Types.ObjectId();
            const request = createMockRequest(userIdForTest.toString(), gameIdForTest.toString());

            const result = queueManager.addRequest(request);
            expect(result).to.be.true;
            expect(queueManager.stats.activeRequests).to.equal(1);
            expect(queueManager.getQueueRequests(gameIdForTest.toString(), 'competitive', 'NA')).to.have.lengthOf(1);
            expect(queueManager.getUserRequest(userIdForTest.toString())).to.deep.include({
                requestId: request._id.toString(),
                gameId: gameIdForTest.toString(),
                gameMode: 'competitive',
                region: 'NA',
            });
        });

        it('should throw ConflictError if user already has an active request', () => {
            const userIdForTestStr = new mongoose.Types.ObjectId().toString();
            const gameIdForTestStr = new mongoose.Types.ObjectId().toString();
            const request1 = createMockRequest(userIdForTestStr, gameIdForTestStr);
            queueManager.addRequest(request1);

            const request2 = createMockRequest(userIdForTestStr, gameIdForTestStr); // Same user ID string
            expect(() => queueManager.addRequest(request2)).to.throw(ConflictError, 'User already has an active match request in queue');
        });

        it('should throw BadRequestError if no primary game is specified (getPrimaryGame returns null)', () => {
            const userIdForTestStr = new mongoose.Types.ObjectId().toString();
            const request = createMockRequest(userIdForTestStr, new mongoose.Types.ObjectId().toString());
            request.getPrimaryGame.returns(null); // Override stub to simulate no primary game
            expect(() => queueManager.addRequest(request)).to.throw(BadRequestError, 'No primary game specified in match request criteria');
        });
    });

    describe('removeRequest', () => {
        it('should remove an existing request from the queue', () => {
            const userIdStr = new mongoose.Types.ObjectId().toString();
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const requestIdStr = new mongoose.Types.ObjectId().toString();

            const request = createMockRequest(userIdStr, gameIdStr, 'competitive', 'NA', requestIdStr);
            queueManager.addRequest(request);

            expect(queueManager.stats.activeRequests).to.equal(1);
            const result = queueManager.removeRequest(userIdStr, requestIdStr);
            expect(result).to.be.true;
            expect(queueManager.stats.activeRequests).to.equal(0);
            expect(queueManager.getQueueRequests(gameIdStr, 'competitive', 'NA')).to.be.empty;
            expect(queueManager.getUserRequest(userIdStr)).to.be.undefined;
        });

        it('should return false if request or user not found for removal', () => {
            const userIdStr = new mongoose.Types.ObjectId().toString();
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const requestIdStr = new mongoose.Types.ObjectId().toString();
            const request = createMockRequest(userIdStr, gameIdStr, 'competitive', 'NA', requestIdStr);

            // Try removing non-existent user's request
            expect(queueManager.removeRequest(new mongoose.Types.ObjectId().toString(), 'nonExistentReqId')).to.be.false;

            queueManager.addRequest(request);
            // Try removing with correct user but wrong request ID
            expect(queueManager.removeRequest(userIdStr, new mongoose.Types.ObjectId().toString())).to.be.false;
            // Try removing with wrong user but correct request ID (should also fail as map lookup is by userId)
            expect(queueManager.removeRequest(new mongoose.Types.ObjectId().toString(), requestIdStr)).to.be.false;
        });
    });

    describe('getQueueRequests', () => {
        it('should return requests for a specific queue', () => {
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const request1 = createMockRequest(new mongoose.Types.ObjectId().toString(), gameIdStr, 'mode1', 'region1');
            const request2 = createMockRequest(new mongoose.Types.ObjectId().toString(), gameIdStr, 'mode1', 'region1');
            queueManager.addRequest(request1);
            queueManager.addRequest(request2);
            const requests = queueManager.getQueueRequests(gameIdStr, 'mode1', 'region1');
            expect(requests).to.have.lengthOf(2);
        });
        it('should return empty array for non-existent queue', () => {
            expect(queueManager.getQueueRequests(new mongoose.Types.ObjectId().toString(), 'mode1', 'region1')).to.be.empty;
        });
    });

    describe('getGameModeRequests', () => {
        it('should return all requests for a game mode across regions', () => {
            const gameId = new mongoose.Types.ObjectId().toString();
            const gameMode = 'captureTheFlag';
            const userIdNA = new mongoose.Types.ObjectId().toString();
            const userIdEU = new mongoose.Types.ObjectId().toString();

            const requestNA = createMockRequest(userIdNA, gameId, gameMode, 'NA');
            const requestEU = createMockRequest(userIdEU, gameId, gameMode, 'EU');
            queueManager.addRequest(requestNA);
            queueManager.addRequest(requestEU);

            const requests = queueManager.getGameModeRequests(gameId, gameMode);
            expect(requests).to.have.lengthOf(2);
            expect(requests.some(r => r.criteria.regions.includes('NA') && r.userId.toString() === userIdNA)).to.be.true;
            expect(requests.some(r => r.criteria.regions.includes('EU') && r.userId.toString() === userIdEU)).to.be.true;
        });
        it('should return empty array if game or game mode has no requests', () => {
            expect(queueManager.getGameModeRequests(new mongoose.Types.ObjectId().toString(), 'mode')).to.be.empty;
            const gameId = new mongoose.Types.ObjectId().toString();
            const requestModeA = createMockRequest(new mongoose.Types.ObjectId().toString(), gameId, 'modeA', 'NA');
            queueManager.addRequest(requestModeA);
            expect(queueManager.getGameModeRequests(gameId, 'modeNonExistent')).to.be.empty;
        });
    });

    describe('cleanupExpiredRequests', () => {
        it('should remove expired requests from queues and map', () => {
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const userId1Str = new mongoose.Types.ObjectId().toString();
            const userId2Str = new mongoose.Types.ObjectId().toString();

            const nonExpiredRequest = createMockRequest(userId1Str, gameIdStr, 'competitive', 'NA', null, false);
            const expiredRequest = createMockRequest(userId2Str, gameIdStr, 'competitive', 'NA', null, true); // isExpired is true

            queueManager.addRequest(nonExpiredRequest);
            queueManager.addRequest(expiredRequest);

            expect(queueManager.stats.activeRequests).to.equal(2);
            queueManager.cleanupExpiredRequests();

            expect(queueManager.stats.activeRequests).to.equal(1);
            expect(queueManager.getUserRequest(userId1Str)).to.exist;
            expect(queueManager.getUserRequest(userId2Str)).to.be.undefined;
            const queue = queueManager.getQueueRequests(gameIdStr, 'competitive', 'NA');
            expect(queue).to.have.lengthOf(1);
            expect(queue[0].userId.toString()).to.equal(userId1Str);
        });
    });

    describe('cleanupEmptyQueues', () => {
        it('should remove empty queue structures', () => {
            const userIdStr = new mongoose.Types.ObjectId().toString();
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const mode = 'mode1';
            const region = 'region1';
            const requestIdStr = new mongoose.Types.ObjectId().toString();

            const request = createMockRequest(userIdStr, gameIdStr, mode, region, requestIdStr);
            queueManager.addRequest(request);

            expect(queueManager.queues.has(gameIdStr)).to.be.true;
            expect(queueManager.queues.get(gameIdStr).has(mode)).to.be.true;
            expect(queueManager.queues.get(gameIdStr).get(mode).has(region)).to.be.true;

            queueManager.removeRequest(userIdStr, requestIdStr); // This internally calls cleanupEmptyQueues

            expect(queueManager.queues.has(gameIdStr)).to.be.false;
        });
    });

    describe('getStats', () => {
        it('should return current statistics', () => {
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const request1 = createMockRequest(new mongoose.Types.ObjectId().toString(), gameIdStr, 'competitive', 'NA');
            const request2 = createMockRequest(new mongoose.Types.ObjectId().toString(), gameIdStr, 'competitive', 'NA');
            queueManager.addRequest(request1);
            queueManager.addRequest(request2);

            const stats = queueManager.getStats();
            expect(stats.totalRequests).to.equal(2);
            expect(stats.activeRequests).to.equal(2);
            expect(stats.matchesFormed).to.equal(0);
            expect(stats.queueSizes[gameIdStr]['competitive']['NA']).to.equal(2);
        });
    });
});