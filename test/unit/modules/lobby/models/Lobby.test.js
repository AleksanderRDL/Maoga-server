const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const Lobby = require('../../../../../src/modules/lobby/models/Lobby');

describe('Lobby Model', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('addMember', () => {
    it('should add a new member to the lobby', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId()
      });

      const userId = new mongoose.Types.ObjectId();
      const member = lobby.addMember(userId, false);

      expect(member).to.exist;
      expect(member.userId.toString()).to.equal(userId.toString());
      expect(member.isHost).to.be.false;
      expect(member.status).to.equal('joined');
      expect(member.readyStatus).to.be.false;
      expect(lobby.members).to.have.lengthOf(1);
    });

    it('should rejoin an existing member who left', () => {
      const userId = new mongoose.Types.ObjectId();
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          {
            userId,
            status: 'left',
            leftAt: new Date()
          }
        ]
      });

      const member = lobby.addMember(userId, false);

      expect(member.status).to.equal('joined');
      expect(member.leftAt).to.be.undefined;
      expect(member.readyStatus).to.be.false;
      expect(lobby.members).to.have.lengthOf(1);
    });

    it('should set host flag correctly', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId()
      });

      const userId = new mongoose.Types.ObjectId();
      const member = lobby.addMember(userId, true);

      expect(member.isHost).to.be.true;
    });
  });

  describe('removeMember', () => {
    it('should mark member as left', () => {
      const userId = new mongoose.Types.ObjectId();
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          {
            userId,
            status: 'joined'
          }
        ]
      });

      const member = lobby.removeMember(userId, 'left');

      expect(member).to.exist;
      expect(member.status).to.equal('left');
      expect(member.leftAt).to.be.instanceOf(Date);
      expect(member.readyStatus).to.be.false;
    });

    it('should handle kick reason', () => {
      const userId = new mongoose.Types.ObjectId();
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          {
            userId,
            status: 'joined'
          }
        ]
      });

      const member = lobby.removeMember(userId, 'kicked');

      expect(member.status).to.equal('kicked');
    });

    it('should return undefined for non-existent member', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId()
      });

      const member = lobby.removeMember(new mongoose.Types.ObjectId());

      expect(member).to.be.undefined;
    });
  });

  describe('setMemberReady', () => {
    it('should set member ready status to true', () => {
      const userId = new mongoose.Types.ObjectId();
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          {
            userId,
            status: 'joined',
            readyStatus: false
          }
        ]
      });

      const member = lobby.setMemberReady(userId, true);

      expect(member).to.exist;
      expect(member.readyStatus).to.be.true;
      expect(member.status).to.equal('ready');
    });

    it('should set member ready status to false', () => {
      const userId = new mongoose.Types.ObjectId();
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          {
            userId,
            status: 'ready',
            readyStatus: true
          }
        ]
      });

      const member = lobby.setMemberReady(userId, false);

      expect(member.readyStatus).to.be.false;
      expect(member.status).to.equal('joined');
    });

    it('should return undefined for inactive member', () => {
      const userId = new mongoose.Types.ObjectId();
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          {
            userId,
            status: 'left'
          }
        ]
      });

      const member = lobby.setMemberReady(userId, true);

      expect(member).to.be.undefined;
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate memberCount correctly', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          { userId: new mongoose.Types.ObjectId(), status: 'joined' },
          { userId: new mongoose.Types.ObjectId(), status: 'ready' },
          { userId: new mongoose.Types.ObjectId(), status: 'left' },
          { userId: new mongoose.Types.ObjectId(), status: 'kicked' }
        ]
      });

      expect(lobby.memberCount).to.equal(2);
    });

    it('should calculate readyCount correctly', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        members: [
          { userId: new mongoose.Types.ObjectId(), readyStatus: true },
          { userId: new mongoose.Types.ObjectId(), readyStatus: true },
          { userId: new mongoose.Types.ObjectId(), readyStatus: false }
        ]
      });

      expect(lobby.readyCount).to.equal(2);
    });

    it('should determine isReady correctly', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        capacity: { min: 2, max: 4 },
        members: [
          { userId: new mongoose.Types.ObjectId(), status: 'ready', readyStatus: true },
          { userId: new mongoose.Types.ObjectId(), status: 'ready', readyStatus: true }
        ]
      });

      expect(lobby.isReady).to.be.true;
    });
  });

  describe('State Transition Methods', () => {
    it('should allow transition to ready when conditions are met', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        status: 'forming',
        capacity: { min: 2, max: 4 },
        members: [
          { userId: new mongoose.Types.ObjectId(), status: 'ready', readyStatus: true },
          { userId: new mongoose.Types.ObjectId(), status: 'ready', readyStatus: true }
        ]
      });

      expect(lobby.canTransitionToReady()).to.be.true;
    });

    it('should not allow transition to ready when not forming', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        status: 'active'
      });

      expect(lobby.canTransitionToReady()).to.be.false;
    });

    it('should allow transition to active when ready', () => {
      const lobby = new Lobby({
        name: 'Test Lobby',
        gameId: new mongoose.Types.ObjectId(),
        hostId: new mongoose.Types.ObjectId(),
        status: 'ready'
      });

      expect(lobby.canTransitionToActive()).to.be.true;
    });
  });
});
