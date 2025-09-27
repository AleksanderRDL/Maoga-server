const { expect } = require('chai');
const sinon = require('sinon');

const authService = require('../../../src/modules/auth/services/authService');
const matchmakingService = require('../../../src/modules/matchmaking/services/matchmakingService');
const queueManager = require('../../../src/modules/matchmaking/services/queueManager');
const socketManager = require('../../../src/services/socketManager');
const notificationService = require('../../../src/modules/notification/services/notificationService');

const User = require('../../../src/modules/auth/models/User');
const Game = require('../../../src/modules/game/models/Game');
const MatchRequest = require('../../../src/modules/matchmaking/models/MatchRequest');
const MatchHistory = require('../../../src/modules/matchmaking/models/MatchHistory');
const Lobby = require('../../../src/modules/lobby/models/Lobby');
const Chat = require('../../../src/modules/chat/models/Chat');

const { testUsers, testGames } = require('../../fixtures');

const MATCHMAKING_TIMEOUT = 15000;

async function seedUsers(count = 2) {
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const userData = testUsers[i];
    const uniqueSuffix = `${Date.now()}_${i}`;
    const [localPart, domain] = userData.email.split('@');
    const registration = await authService.register({
      email: `${localPart}.${uniqueSuffix}@${domain}`,
      username: `${userData.username}_${uniqueSuffix}`,
      password: userData.password,
      displayName: userData.displayName
    });
    results.push(registration.user);
  }
  return results;
}

async function createMatchmakingRequests(users, game) {
  const criteria = {
    games: [{ gameId: game._id.toString(), weight: 10 }],
    gameMode: 'competitive',
    regions: ['NA'],
    languages: ['en'],
    groupSize: { min: users.length, max: users.length }
  };

  const requests = [];
  for (const user of users) {
    const request = await matchmakingService.submitMatchRequest(user.id, criteria);
    requests.push(request);
  }

  return { requests, criteria };
}

async function runMatchmakingFlow(gameId, gameMode, region) {
  await matchmakingService.processSpecificQueue(gameId, gameMode, region);

  const matchHistory = await MatchHistory.findOne({ gameId }).lean();
  const lobby = await Lobby.findOne({ gameId }).lean();
  const chat = lobby ? await Chat.findById(lobby.chatId).lean() : null;

  return { matchHistory, lobby, chat };
}

describe('Matchmaking, Lobby, and Chat integration flow', function () {
  this.timeout(MATCHMAKING_TIMEOUT);

  let sandbox;
  let game;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(socketManager, 'emitMatchmakingStatus').returns(true);
    sandbox.stub(socketManager, 'emitToUser').returns(true);
    sandbox.stub(socketManager, 'emitToRoom').returns(true);
    sandbox.stub(notificationService, 'createNotification').resolves();

    await Promise.all([
      User.deleteMany({}),
      Game.deleteMany({}),
      MatchRequest.deleteMany({}),
      MatchHistory.deleteMany({}),
      Lobby.deleteMany({}),
      Chat.deleteMany({})
    ]);

    await queueManager.clearQueues();

    game = await Game.create({
      ...testGames[0],
      slug: `${testGames[0].slug}-${Date.now()}`
    });
  });

  afterEach(async () => {
    sandbox.restore();
    await queueManager.clearQueues();
  });

  it('creates lobby and chat when matchmaking finds a match', async () => {
    const users = await seedUsers(2);
    const { criteria } = await createMatchmakingRequests(users, game);

    const flowResult = await runMatchmakingFlow(
      game._id.toString(),
      criteria.gameMode,
      criteria.regions[0]
    );

    expect(flowResult.matchHistory, 'match history should exist').to.exist;
    expect(flowResult.matchHistory.lobbyId, 'match history should reference lobby').to.exist;

    expect(flowResult.lobby, 'lobby should be created').to.exist;
    expect(flowResult.lobby.chatId, 'lobby should link to chat').to.exist;
    expect(flowResult.lobby.matchHistoryId.toString()).to.equal(
      flowResult.matchHistory._id.toString()
    );
    expect(flowResult.lobby.members).to.have.lengthOf(users.length);

    expect(flowResult.chat, 'lobby chat should be created').to.exist;
    expect(flowResult.chat.chatType).to.equal('lobby');
    expect(flowResult.chat.lobbyId.toString()).to.equal(flowResult.lobby._id.toString());
    expect(flowResult.chat.participants.map(String)).to.have.members(users.map((user) => user.id));

    const matchedRequests = await MatchRequest.find({
      _id: { $in: flowResult.matchHistory.participants.map((p) => p.requestId) }
    });

    matchedRequests.forEach((request) => {
      expect(request.status).to.equal('matched');
      expect(request.matchedLobbyId?.toString()).to.equal(flowResult.lobby._id.toString());
    });
  });

  it('does not duplicate lobby or chat on repeated match finalization', async () => {
    const users = await seedUsers(2);
    const { requests, criteria } = await createMatchmakingRequests(users, game);

    let { matchHistory, lobby, chat } = await runMatchmakingFlow(
      game._id.toString(),
      criteria.gameMode,
      criteria.regions[0]
    );

    expect(matchHistory).to.exist;
    expect(lobby).to.exist;
    expect(chat).to.exist;

    const participants = matchHistory.participants.map((participant) => ({
      userId: participant.userId,
      requestId: participant.requestId
    }));

    const reFinalized = await matchmakingService.finalizeMatch({
      matchHistory: await MatchHistory.findById(matchHistory._id),
      participants
    });

    const lobbyCount = await Lobby.countDocuments();
    const chatCount = await Chat.countDocuments();

    expect(reFinalized.lobbyId.toString()).to.equal(lobby._id.toString());
    expect(lobbyCount).to.equal(1);
    expect(chatCount).to.equal(1);

    const refreshedRequests = await MatchRequest.find({
      _id: { $in: requests.map((request) => request._id) }
    });

    refreshedRequests.forEach((request) => {
      expect(request.matchedLobbyId?.toString()).to.equal(lobby._id.toString());
    });
  });
});
