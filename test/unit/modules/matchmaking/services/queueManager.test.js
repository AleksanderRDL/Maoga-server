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
        // Ensure queues are cleared before each test
        queueManager.clearQueues();
    });

    afterEach(() => {
        sandbox.restore();
        queueManager.clearQueues();
    });

    const createMockRequest = (userIdInput, gameIdInput, gameMode = 'competitive', region = 'NA', requestIdInput) => {
        const resolvedUserId = userIdInput ? new mongoose.Types.ObjectId() : new mongoose.Types.ObjectId(); // Generate new valid ObjectId
        const resolvedGameId = gameIdInput ? new mongoose.Types.ObjectId() : new mongoose.Types.ObjectId();
        const resolvedRequestId = requestIdInput ? new mongoose.Types.ObjectId() : new mongoose.Types.ObjectId();

        // If you specifically need to test with string representations for some reason, ensure they are valid hex strings.
        // For general mocking, new ObjectIds are safer.
        // We will use the input strings as keys for userRequestMap, but store ObjectIds in the request object.

        const mockPrimaryGame = { gameId: resolvedGameId };

        const reqInstance = new MatchRequest({
            _id: resolvedRequestId,
            userId: resolvedUserId,
            criteria: {
                games: [{ gameId: resolvedGameId, weight: 10 }],
                gameMode: gameMode,
                regions: [region],
            },
            searchStartTime: new Date(),
        });

        // Stub instance methods on the created MatchRequest instance
        sinon.stub(reqInstance, 'isExpired').returns(false);
        sinon.stub(reqInstance, 'getPrimaryGame').returns(mockPrimaryGame);

        // Keep original userIdInput string for map lookups if needed by test logic
        // but the instance should hold the ObjectId.
        // Attach the input string if tests rely on it for map lookups.
        reqInstance._testUserIdInput = userIdInput; // For map key reference if original string is used

        return reqInstance;
    };

    // ...
    describe('addRequest', () => {
        it('should add a valid request to the queue', () => {
            const gameIdForTest = new mongoose.Types.ObjectId();
            const userIdForTest = new mongoose.Types.ObjectId();
            const request = createMockRequest(userIdForTest.toString(), gameIdForTest.toString());

            // Modify the mock so getPrimaryGame returns the actual ObjectId used for gameIdForTest
            request.getPrimaryGame.returns({ gameId: gameIdForTest });


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
            const userIdForTest = new mongoose.Types.ObjectId().toString();
            const gameIdForTest = new mongoose.Types.ObjectId().toString();
            const request1 = createMockRequest(userIdForTest, gameIdForTest);
            queueManager.addRequest(request1);

            const request2 = createMockRequest(userIdForTest, gameIdForTest);
            expect(() => queueManager.addRequest(request2)).to.throw(ConflictError, 'User already has an active match request in queue');
        });

        // Test for BadRequestError (Failure 11 was type error, now testing logic error)
        it('should throw BadRequestError if no primary game is specified (getPrimaryGame returns null)', () => {
            const userIdForTest = new mongoose.Types.ObjectId().toString();
            const request = createMockRequest(userIdForTest, new mongoose.Types.ObjectId().toString());
            request.getPrimaryGame.returns(null); // Simulate no primary game
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

            const result = queueManager.removeRequest(userIdStr, requestIdStr);
            expect(result).to.be.true;
            expect(queueManager.stats.activeRequests).to.equal(0);
            expect(queueManager.getQueueRequests(gameIdStr, 'competitive', 'NA')).to.be.empty;
            expect(queueManager.getUserRequest(userIdStr)).to.be.undefined;
        });

        it('should return false if request or user not found', () => {
            const userIdStr = new mongoose.Types.ObjectId().toString();
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const request = createMockRequest(userIdStr, gameIdStr);

            expect(queueManager.removeRequest(new mongoose.Types.ObjectId().toString(), 'req1')).to.be.false;
            queueManager.addRequest(request);
            expect(queueManager.removeRequest(userIdStr, new mongoose.Types.ObjectId().toString())).to.be.false;
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
        // ... existing test for non-existent queue
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
        // ... existing test for empty array if game or game mode has no requests
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

            const nonExpiredRequest = createMockRequest(userId1Str, gameIdStr);
            const expiredRequest = createMockRequest(userId2Str, gameIdStr);

            // Modify the stub on the instance
            sinon.stub(expiredRequest, 'isExpired').returns(true); // Mark as expired

            queueManager.addRequest(nonExpiredRequest);
            queueManager.addRequest(expiredRequest);

            expect(queueManager.stats.activeRequests).to.equal(2);
            queueManager.cleanupExpiredRequests();

            expect(queueManager.stats.activeRequests).to.equal(1);
            expect(queueManager.getUserRequest(userId1Str)).to.exist;
            expect(queueManager.getUserRequest(userId2Str)).to.be.undefined;
            expect(queueManager.getQueueRequests(gameIdStr, 'competitive', 'NA')).to.have.lengthOf(1);
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

            queueManager.removeRequest(userIdStr, requestIdStr);

            expect(queueManager.queues.has(gameIdStr)).to.be.false;
        });
    });

    describe('getStats', () => {
        it('should return current statistics', () => {
            const gameIdStr = new mongoose.Types.ObjectId().toString();
            const request1 = createMockRequest(new mongoose.Types.ObjectId().toString(), gameIdStr);
            const request2 = createMockRequest(new mongoose.Types.ObjectId().toString(), gameIdStr);
            queueManager.addRequest(request1);
            queueManager.addRequest(request2);

            const stats = queueManager.getStats();
            expect(stats.totalRequests).to.equal(2);
            expect(stats.activeRequests).to.equal(2);
            expect(stats.matchesFormed).to.equal(0);
            expect(stats.queueSizes[gameIdStr].competitive.NA).to.equal(2);
        });
    });
});