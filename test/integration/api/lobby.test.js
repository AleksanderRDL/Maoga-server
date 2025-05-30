// test/integration/api/lobby.test.js
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const mongoose = require('mongoose');
const User = require('../../../src/modules/auth/models/User');
const Game = require('../../../src/modules/game/models/Game');
const Lobby = require('../../../src/modules/lobby/models/Lobby');
const Chat = require('../../../src/modules/chat/models/Chat');
const MatchHistory = require('../../../src/modules/matchmaking/models/MatchHistory');
const authService = require('../../../src/modules/auth/services/authService');
const lobbyService = require('../../../src/modules/lobby/services/lobbyService');
const { testUsers, testGames } = require('../../fixtures');

describe('Lobby Integration Tests', () => {
  let authToken1, authToken2, authToken3;
  let user1, user2, user3;
  let testGame;
  let testLobby;

  beforeEach(async () => {
    await User.deleteMany({});
    await Game.deleteMany({});
    await Lobby.deleteMany({});
    await Chat.deleteMany({});
    await MatchHistory.deleteMany({});

    // Create test game
    testGame = await Game.create(testGames[0]);

    // Create test users
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
        email: 'user3@example.com',
        username: 'user3',
        password: 'Password123!'
      })
    ]);

    authToken1 = userResults[0].accessToken;
    user1 = userResults[0].user;
    authToken2 = userResults[1].accessToken;
    user2 = userResults[1].user;
    authToken3 = userResults[2].accessToken;
    user3 = userResults[2].user;
  });

  describe('Lobby Creation from Matchmaking', () => {
    it('should create lobby with correct participants and chat', async () => {
      // Create match history
      const matchHistory = await MatchHistory.create({
        gameId: testGame._id,
        gameMode: 'competitive',
        region: 'NA',
        participants: [
          { userId: user1.id, requestId: new mongoose.Types.ObjectId() },
          { userId: user2.id, requestId: new mongoose.Types.ObjectId() }
        ],
        status: 'forming'
      });

      // Create lobby from match
      const matchData = {
        matchHistory,
        participants: [
          { userId: user1.id, requestId: matchHistory.participants[0].requestId },
          { userId: user2.id, requestId: matchHistory.participants[1].requestId }
        ]
      };

      const lobby = await lobbyService.createLobby(matchData);

      expect(lobby).to.exist;
      expect(lobby.name).to.include('Match');
      expect(lobby.gameId.toString()).to.equal(testGame._id.toString());
      expect(lobby.gameMode).to.equal('competitive');
      expect(lobby.hostId.toString()).to.equal(user1.id);
      expect(lobby.members).to.have.lengthOf(2);
      // Verify chat was created
      expect(lobby.chatId).to.exist;
      const chat = await Chat.findById(lobby.chatId);
      expect(chat).to.exist;
      expect(chat.chatType).to.equal('lobby');
      expect(chat.lobbyId.toString()).to.equal(lobby._id.toString());
      expect(chat.participants).to.have.lengthOf(2);

      // Verify match history was updated
      const updatedMatchHistory = await MatchHistory.findById(matchHistory._id);
      expect(updatedMatchHistory.lobbyId.toString()).to.equal(lobby._id.toString());
    });

    it('should set capacity based on participants', async () => {
      const matchHistory = await MatchHistory.create({
        gameId: testGame._id,
        gameMode: 'casual',
        participants: [{ userId: user1.id }, { userId: user2.id }, { userId: user3.id }]
      });

      const matchData = {
        matchHistory,
        participants: [{ userId: user1.id }, { userId: user2.id }, { userId: user3.id }]
      };

      const lobby = await lobbyService.createLobby(matchData);

      expect(lobby.capacity.min).to.equal(3);
      expect(lobby.capacity.max).to.equal(3);
    });
  });

  describe('Join/Leave Lobby Flow', () => {
    beforeEach(async () => {
      // Create a test lobby
      testLobby = await Lobby.create({
        name: 'Test Lobby',
        gameId: testGame._id,
        gameMode: 'casual',
        hostId: user1.id,
        status: 'forming',
        capacity: { min: 2, max: 4 },
        members: [
          {
            userId: user1.id,
            status: 'joined',
            isHost: true
          }
        ]
      });

      // Create associated chat
      const chat = await Chat.create({
        chatType: 'lobby',
        lobbyId: testLobby._id,
        participants: [user1.id]
      });

      testLobby.chatId = chat._id;
      await testLobby.save();
    });

    describe('POST /api/lobbies/:lobbyId/join', () => {
      it('should allow user to join lobby', async () => {
        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/join`)
          .set('Authorization', `Bearer ${authToken2}`)
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.lobby.members).to.have.lengthOf(2);

        const updatedLobby = await Lobby.findById(testLobby._id);
        expect(updatedLobby.members.find((m) => m.userId.toString() === user2.id)).to.exist;

        // Verify chat participant was added
        const chat = await Chat.findById(testLobby.chatId);
        expect(chat.participants).to.include(user2.id);
      });

      it('should reject join when lobby is full', async () => {
        // Fill the lobby
        await Lobby.findByIdAndUpdate(testLobby._id, {
          $push: {
            members: [
              { userId: user2.id, status: 'joined' },
              { userId: user3.id, status: 'joined' },
              { userId: new mongoose.Types.ObjectId(), status: 'joined' }
            ]
          }
        });

        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/join`)
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(400);

        expect(res.body.error.message).to.equal('Lobby is full');
      });

      it('should reject join when user is already in another lobby', async () => {
        // Create another lobby with user2
        const anotherLobby = await Lobby.create({
          name: 'Another Lobby',
          gameId: testGame._id,
          hostId: user2.id,
          status: 'forming',
          members: [
            {
              userId: user2.id,
              status: 'joined',
              isHost: true
            }
          ]
        });

        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/join`)
          .set('Authorization', `Bearer ${authToken2}`)
          .expect(409);

        expect(res.body.error.message).to.equal('User is already in another lobby');
      });
    });

    describe('POST /api/lobbies/:lobbyId/leave', () => {
      beforeEach(async () => {
        // Add user2 to lobby
        await lobbyService.joinLobby(testLobby._id.toString(), user2.id);
      });

      it('should allow member to leave lobby', async () => {
        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/leave`)
          .set('Authorization', `Bearer ${authToken2}`)
          .expect(200);

        expect(res.body.status).to.equal('success');

        const updatedLobby = await Lobby.findById(testLobby._id);
        const member = updatedLobby.members.find((m) => m.userId.toString() === user2.id);
        expect(member.status).to.equal('left');
      });

      it('should transfer host when host leaves', async () => {
        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/leave`)
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

        const updatedLobby = await Lobby.findById(testLobby._id);
        expect(updatedLobby.hostId.toString()).to.equal(user2.id);

        const newHost = updatedLobby.members.find((m) => m.userId.toString() === user2.id);
        expect(newHost.isHost).to.be.true;
      });

      it('should close lobby when last member leaves', async () => {
        // Remove user2 first
        await lobbyService.leaveLobby(testLobby._id.toString(), user2.id);

        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/leave`)
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

        const updatedLobby = await Lobby.findById(testLobby._id);
        expect(updatedLobby.status).to.equal('closed');
      });
    });
  });

  describe('Ready Status and State Transitions', () => {
    beforeEach(async () => {
      testLobby = await Lobby.create({
        name: 'Test Lobby',
        gameId: testGame._id,
        gameMode: 'competitive',
        hostId: user1.id,
        status: 'forming',
        capacity: { min: 2, max: 2 },
        members: [
          { userId: user1.id, status: 'joined', isHost: true },
          { userId: user2.id, status: 'joined', isHost: false }
        ]
      });
    });

    describe('POST /api/lobbies/:lobbyId/ready', () => {
      it('should set member ready status', async () => {
        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/ready`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send({ ready: true })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.message).to.equal('Marked as ready');

        const updatedLobby = await Lobby.findById(testLobby._id);
        const member = updatedLobby.members.find((m) => m.userId.toString() === user1.id);
        expect(member.readyStatus).to.be.true;
        expect(member.status).to.equal('ready');
      });

      it('should transition lobby to ready when all members ready', async () => {
        // Set user1 ready
        await request(app)
          .post(`/api/lobbies/${testLobby._id}/ready`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send({ ready: true });

        // Set user2 ready
        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/ready`)
          .set('Authorization', `Bearer ${authToken2}`)
          .send({ ready: true })
          .expect(200);

        const updatedLobby = await Lobby.findById(testLobby._id);
        expect(updatedLobby.status).to.equal('ready');
        expect(updatedLobby.readyAt).to.be.instanceOf(Date);
      });

      it('should revert lobby state when member unreadies', async () => {
        // Set both ready
        await lobbyService.setMemberReady(testLobby._id.toString(), user1.id, true);
        await lobbyService.setMemberReady(testLobby._id.toString(), user2.id, true);

        // Unready user1
        const res = await request(app)
          .post(`/api/lobbies/${testLobby._id}/ready`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send({ ready: false })
          .expect(200);

        const updatedLobby = await Lobby.findById(testLobby._id);
        expect(updatedLobby.status).to.equal('forming');
      });
    });
  });

  describe('Chat Message Sending and Retrieval', () => {
    beforeEach(async () => {
      testLobby = await Lobby.create({
        name: 'Test Lobby',
        gameId: testGame._id,
        hostId: user1.id,
        members: [
          { userId: user1.id, status: 'joined', isHost: true },
          { userId: user2.id, status: 'joined' }
        ]
      });

      const chat = await Chat.create({
        chatType: 'lobby',
        lobbyId: testLobby._id,
        participants: [user1.id, user2.id]
      });

      testLobby.chatId = chat._id;
      await testLobby.save();
    });

    describe('POST /api/chat/lobby/:lobbyId/messages', () => {
      it('should send message to lobby chat', async () => {
        const messageContent = 'Hello lobby!';

        const res = await request(app)
          .post(`/api/chat/lobby/${testLobby._id}/messages`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send({ content: messageContent })
          .expect(201);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.message.content).to.equal(messageContent);

        const chat = await Chat.findById(testLobby.chatId);
        expect(chat.messages).to.have.lengthOf(1);
        expect(chat.messages[0].content).to.equal(messageContent);
      });

      it('should reject message from non-participant', async () => {
        const res = await request(app)
          .post(`/api/chat/lobby/${testLobby._id}/messages`)
          .set('Authorization', `Bearer ${authToken3}`)
          .send({ content: 'Should fail' })
          .expect(400);

        expect(res.body.error.message).to.include('not a participant');
      });

      it('should validate message content', async () => {
        const res = await request(app)
          .post(`/api/chat/lobby/${testLobby._id}/messages`)
          .set('Authorization', `Bearer ${authToken1}`)
          .send({ content: '' })
          .expect(422);

        expect(res.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });

    describe('GET /api/chat/lobby/:lobbyId/messages', () => {
      beforeEach(async () => {
        // Add some test messages
        const chat = await Chat.findById(testLobby.chatId);
        for (let i = 0; i < 10; i++) {
          chat.addMessage(user1.id, `Message ${i + 1}`);
        }
        await chat.save();
      });

      it('should retrieve chat history', async () => {
        const res = await request(app)
          .get(`/api/chat/lobby/${testLobby._id}/messages`)
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.messages).to.have.lengthOf(10);
        expect(res.body.data.hasMore).to.be.false;
      });

      it('should paginate messages', async () => {
        const res = await request(app)
          .get(`/api/chat/lobby/${testLobby._id}/messages`)
          .set('Authorization', `Bearer ${authToken1}`)
          .query({ limit: 5 })
          .expect(200);

        expect(res.body.data.messages).to.have.lengthOf(5);
        expect(res.body.data.hasMore).to.be.true;
      });

      it('should filter by before timestamp', async () => {
        const chat = await Chat.findById(testLobby.chatId);
        const cutoffMessage = chat.messages[5];

        const res = await request(app)
          .get(`/api/chat/lobby/${testLobby._id}/messages`)
          .set('Authorization', `Bearer ${authToken1}`)
          .query({ before: cutoffMessage.createdAt.toISOString() })
          .expect(200);

        expect(res.body.data.messages).to.have.lengthOf(5);
      });
    });
  });
});
