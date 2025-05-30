const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const lobbyService = require('../../../../../src/modules/lobby/services/lobbyService');
const Lobby = require('../../../../../src/modules/lobby/models/Lobby');
const Chat = require('../../../../../src/modules/chat/models/Chat');
const User = require('../../../../../src/modules/auth/models/User');
const socketManager = require('../../../../../src/services/socketManager');
const {
  NotFoundError,
  BadRequestError,
  ConflictError
} = require('../../../../../src/utils/errors');

describe('LobbyService - State Machine Logic', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('transitionLobbyState', () => {
    let mockLobby;
    let sendSystemMessageStub;
    let emitLobbyUpdateStub;

    beforeEach(() => {
      mockLobby = {
        _id: new mongoose.Types.ObjectId(),
        status: 'forming',
        settings: { autoStart: false },
        save: sandbox.stub().resolves()
      };

      sendSystemMessageStub = sandbox.stub(lobbyService, 'sendSystemMessage').resolves();
      emitLobbyUpdateStub = sandbox.stub(lobbyService, 'emitLobbyUpdate');
    });

    it('should transition from forming to ready', async () => {
      await lobbyService.transitionLobbyState(mockLobby, 'ready');

      expect(mockLobby.status).to.equal('ready');
      expect(mockLobby.readyAt).to.be.instanceOf(Date);
      expect(
        sendSystemMessageStub.calledWith(mockLobby._id, 'All players ready! Game starting soon...')
      ).to.be.true;
      expect(mockLobby.save.calledOnce).to.be.true;
      expect(emitLobbyUpdateStub.calledOnce).to.be.true;
    });

    it('should transition from ready to active', async () => {
      mockLobby.status = 'ready';

      await lobbyService.transitionLobbyState(mockLobby, 'active');

      expect(mockLobby.status).to.equal('active');
      expect(mockLobby.activeAt).to.be.instanceOf(Date);
      expect(sendSystemMessageStub.calledWith(mockLobby._id, 'Game started! Good luck!')).to.be
        .true;
    });

    it('should transition to closed', async () => {
      await lobbyService.transitionLobbyState(mockLobby, 'closed');

      expect(mockLobby.status).to.equal('closed');
      expect(mockLobby.closedAt).to.be.instanceOf(Date);
      expect(mockLobby.save.calledOnce).to.be.true;
    });

    it('should auto-start when transitioning to ready with autoStart enabled', async () => {
      mockLobby.settings.autoStart = true;
      const clock = sandbox.useFakeTimers();

      const transitionSpy = sandbox.spy(lobbyService, 'transitionLobbyState');

      await lobbyService.transitionLobbyState(mockLobby, 'ready');

      // Fast-forward 5 seconds
      clock.tick(5000);

      // Wait for async operations
      await new Promise((resolve) => setImmediate(resolve));

      expect(transitionSpy.callCount).to.be.greaterThan(1);

      clock.restore();
    });
  });

  describe('State Validation in Operations', () => {
    it('should prevent joining a non-forming lobby', async () => {
      const lobbyId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const mockLobby = {
        _id: lobbyId,
        status: 'active',
        memberCount: 2,
        capacity: { max: 4 }
      };

      sandbox.stub(lobbyService, 'getLobbyById').resolves(mockLobby);

      try {
        await lobbyService.joinLobby(lobbyId.toString(), userId.toString());
        expect.fail('Should have thrown BadRequestError');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestError);
        expect(error.message).to.equal('Lobby is not accepting new members');
      }
    });

    it('should prevent ready status changes in closed lobby', async () => {
      const lobbyId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const mockLobby = {
        _id: lobbyId,
        status: 'closed'
      };

      sandbox.stub(lobbyService, 'getLobbyById').resolves(mockLobby);

      try {
        await lobbyService.setMemberReady(lobbyId.toString(), userId.toString(), true);
        expect.fail('Should have thrown BadRequestError');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestError);
        expect(error.message).to.equal('Cannot change ready status in current lobby state');
      }
    });
  });

  describe('Host Transfer Logic', () => {
    it('should transfer host when host leaves', async () => {
      const hostId = new mongoose.Types.ObjectId();
      const memberId = new mongoose.Types.ObjectId();

      const mockLobby = {
        _id: new mongoose.Types.ObjectId(),
        hostId,
        members: [
          { userId: hostId, status: 'joined', isHost: true },
          { userId: memberId, status: 'joined', isHost: false }
        ],
        memberCount: 2,
        removeMember: function (id) {
          const member = this.members.find((m) => m.userId.toString() === id.toString());
          if (member) {
            member.status = 'left';
            return member;
          }
        },
        save: sandbox.stub().resolves(),
        populate: sandbox.stub().returnsThis()
      };

      sandbox.stub(lobbyService, 'getLobbyById').resolves(mockLobby);
      sandbox.stub(lobbyService, 'transferHost').resolves();
      sandbox.stub(lobbyService, 'sendSystemMessage').resolves();
      sandbox.stub(lobbyService, 'emitLobbyUpdate');
      sandbox.stub(lobbyService, 'emitMemberLeft');
      sandbox.stub(User, 'findById').resolves({ username: 'testuser' });

      await lobbyService.leaveLobby(mockLobby._id.toString(), hostId.toString());

      expect(lobbyService.transferHost.calledOnce).to.be.true;
    });

    it('should set new host correctly during transfer', async () => {
      const oldHostId = new mongoose.Types.ObjectId();
      const newHostId = new mongoose.Types.ObjectId();

      const mockLobby = {
        _id: new mongoose.Types.ObjectId(),
        hostId: oldHostId,
        members: [
          { userId: oldHostId, status: 'left', isHost: true },
          { userId: newHostId, status: 'joined', isHost: false }
        ]
      };

      sandbox.stub(lobbyService, 'sendSystemMessage').resolves();

      await lobbyService.transferHost(mockLobby);

      expect(mockLobby.members[0].isHost).to.be.false;
      expect(mockLobby.members[1].isHost).to.be.true;
      expect(mockLobby.hostId.toString()).to.equal(newHostId.toString());
    });
  });
});
