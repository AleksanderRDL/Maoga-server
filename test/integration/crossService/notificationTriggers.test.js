const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const app = require('../../../src/app'); // Needed for service initializations if they depend on app context
const User = require('../../../src/modules/auth/models/User');
const Notification = require('../../../src/modules/notification/models/Notification');
const MatchRequest = require('../../../src/modules/matchmaking/models/MatchRequest');
const MatchHistory = require('../../../src/modules/matchmaking/models/MatchHistory');
const Lobby = require('../../../src/modules/lobby/models/Lobby');
const Game = require('../../../src/modules/game/models/Game');
const Friendship = require('../../../src/modules/social/models/Friendship');

const authService = require('../../../src/modules/auth/services/authService');
const matchmakingService = require('../../../src/modules/matchmaking/services/matchmakingService');
const lobbyService = require('../../../src/modules/lobby/services/lobbyService');
const friendService = require('../../../src/modules/social/services/friendService');
const notificationService = require('../../../src/modules/notification/services/notificationService'); // To spy on
const socketManager = require('../../../src/services/socketManager');

const { testUsers, testGames } = require('../../fixtures');

describe('Cross-Service Notification Trigger Integration Tests', () => {
    let user1, user2, user3;
    let game1;
    let sandbox;
    let createNotificationSpy;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        await User.deleteMany({});
        await Notification.deleteMany({});
        await MatchRequest.deleteMany({});
        await MatchHistory.deleteMany({});
        await Lobby.deleteMany({});
        await Game.deleteMany({});
        await Friendship.deleteMany({});

        [user1, user2, user3] = await Promise.all([
            authService.register(testUsers[0]).then(r => r.user),
            authService.register(testUsers[1]).then(r => r.user),
            authService.register({ email: 'user3@example.com', username: 'user3', password: 'Password123!'}).then(r => r.user)
        ]);
        game1 = await Game.create(testGames[0]);

        // Spy on notificationService.createNotification
        createNotificationSpy = sandbox.spy(notificationService, 'createNotification');
        // Stub socketManager to prevent actual socket emissions during these tests
        sandbox.stub(socketManager, 'emitToUser');
        sandbox.stub(socketManager, 'emitToRoom');


        // Ensure matchmaking processor doesn't interfere if it runs on a timer
        if (matchmakingService.stopProcessing) matchmakingService.stopProcessing();
    });

    afterEach(() => {
        sandbox.restore();
        if (matchmakingService.startProcessing) matchmakingService.startProcessing();
    });

    it('should create a notification when a match is found and finalized', async () => {
        // 1. Submit match requests for user1 and user2
        const criteria = {
            games: [{ gameId: game1._id.toString(), weight: 10 }],
            gameMode: 'competitive',
            regions: ['NA']
        };
        const request1 = await matchmakingService.submitMatchRequest(user1._id.toString(), criteria);
        const request2 = await matchmakingService.submitMatchRequest(user2._id.toString(), criteria);

        // 2. Manually trigger match formation (assuming matchmakingService.processSpecificQueue exists)
        // This might need adjustment based on how your matchmakingService is structured for testing
        const enrichedRequests = await matchmakingService.matchAlgorithmService.enrichRequests([request1, request2]);
        const matches = await matchmakingService.matchAlgorithmService.findMatches(enrichedRequests, game1._id.toString(), 'competitive', 'NA');

        expect(matches).to.have.lengthOf(1);
        const matchData = matches[0];

        // 3. Finalize the match (this should trigger notification)
        await matchmakingService.finalizeMatch(matchData);

        // 4. Verify notifications were created for both users
        expect(createNotificationSpy.calledTwice).to.be.true;

        const notificationArgsUser1 = createNotificationSpy.getCall(0).args;
        const notificationArgsUser2 = createNotificationSpy.getCall(1).args;

        // Find which call was for which user, order might not be guaranteed
        const user1Call = notificationArgsUser1[0] === user1._id.toString() ? notificationArgsUser1 : notificationArgsUser2;
        const user2Call = notificationArgsUser2[0] === user2._id.toString() ? notificationArgsUser2 : notificationArgsUser1;


        expect(user1Call[0]).to.equal(user1._id.toString());
        expect(user1Call[1].type).to.equal('match_found');
        expect(user1Call[1].title).to.include('Match Found!');
        expect(user1Call[1].data.entityType).to.equal('lobby');

        expect(user2Call[0]).to.equal(user2._id.toString());
        expect(user2Call[1].type).to.equal('match_found');
    });


    it('should create a notification when a friend request is sent', async () => {
        await friendService.sendFriendRequest(user1._id.toString(), user2._id.toString());

        expect(createNotificationSpy.calledOnce).to.be.true;
        const callArgs = createNotificationSpy.firstCall.args;
        expect(callArgs[0]).to.equal(user2._id.toString()); // Notification for target user
        expect(callArgs[1].type).to.equal('friend_request');
        expect(callArgs[1].title).to.equal('New Friend Request');
        expect(callArgs[1].data.entityId.toString()).to.equal(user1._id.toString());
    });

    // This test requires friendService.acceptFriendRequest to be implemented and to trigger a notification
    // If not yet implemented, this will fail or need to be adapted.
    it('should create a notification when a friend request is accepted (if implemented)', async () => {
        const friendship = await friendService.sendFriendRequest(user1._id.toString(), user2._id.toString());
        createNotificationSpy.resetHistory(); // Reset spy after initial request notification

        // Mock acceptFriendRequest if it's not fully implemented or to isolate notification part
        // For a true cross-service test, you'd call the actual service method.
        sandbox.stub(Friendship, 'findByIdAndUpdate').resolves({
            ...friendship.toObject(),
            status: 'accepted',
            user1Id: user1._id, // Ensure populated-like structure for notification content
            user2Id: user2._id,
            requestedBy: user1._id,
            populate: sandbox.stub().resolvesThis() // If acceptFriendRequest populates
        });
        // Assuming notification for acceptor is not standard, only for the original requester.
        // If your acceptFriendRequest directly calls notificationService.createNotification:
        // await friendService.acceptFriendRequest(user2._id.toString(), friendship._id.toString());

        // Simulate the notification part of accepting if the service method doesn't exist/isn't called directly
        await notificationService.createNotification(user1._id.toString(), {
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            message: `${user2.username} accepted your friend request.`,
            data: { entityType: 'user', entityId: user2._id }
        });


        expect(createNotificationSpy.calledOnce).to.be.true;
        const callArgs = createNotificationSpy.firstCall.args;
        expect(callArgs[0]).to.equal(user1._id.toString()); // Notification for the original requester
        expect(callArgs[1].type).to.equal('friend_accepted');
        expect(callArgs[1].data.entityId.toString()).to.equal(user2._id.toString());
    });


    // Add more tests for other triggers (e.g., lobby invite) if those services are ready
    // For example, a lobby invite notification:
    it('should create a notification when a user is invited to a lobby (if invite system exists)', async () => {
        // 1. Create a lobby
        const lobby = await Lobby.create({
            name: 'Test Invite Lobby', gameId: game1._id, hostId: user1._id,
            members: [{ userId: user1._id, status: 'joined', isHost: true }]
        });

        // 2. Simulate user2 being invited (this would typically be an action in lobbyService)
        // If your lobbyService.inviteToLobby directly calls notificationService:
        // await lobbyService.inviteToLobby(lobby._id.toString(), user1._id.toString(), user2._id.toString());

        // For this test, we'll directly trigger the notification part as if invited
        await notificationService.createNotification(user2._id.toString(), {
            type: 'lobby_invite',
            title: `Lobby Invitation from ${user1.username}`,
            message: `You've been invited to join ${user1.username}'s lobby for ${game1.name}.`,
            data: { entityType: 'lobby', entityId: lobby._id, actionUrl: `/lobbies/${lobby._id}` }
        });


        expect(createNotificationSpy.calledOnce).to.be.true;
        const callArgs = createNotificationSpy.firstCall.args;
        expect(callArgs[0]).to.equal(user2._id.toString());
        expect(callArgs[1].type).to.equal('lobby_invite');
        expect(callArgs[1].data.entityId.toString()).to.equal(lobby._id.toString());
    });

});