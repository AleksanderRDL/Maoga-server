const { expect } = require('chai');
const sinon = require('sinon');
const userService = require('../../../../../src/modules/user/services/userService');
const User = require('../../../../../src/modules/auth/models/User');
const { NotFoundError, ConflictError } = require('../../../../../src/utils/errors');

describe('UserService', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = {
        _id: 'userId123',
        email: 'test@example.com',
        username: 'testuser',
        status: 'active'
      };

      const queryStub = {
        select: sandbox.stub().returnsThis()
      };
      sandbox.stub(User, 'findById').returns(queryStub);
      queryStub.select.resolves(mockUser);

      const result = await userService.getUserById('userId123', true);

      expect(result).to.equal(mockUser);
      expect(User.findById.calledWith('userId123')).to.be.true;
      expect(queryStub.select.calledWith('+refreshTokens')).to.be.true;
    });

    it('should throw NotFoundError if user not found', async () => {
      const queryStub = {
        select: sandbox.stub().returnsThis()
      };
      sandbox.stub(User, 'findById').returns(queryStub);
      queryStub.select.resolves(null);

      try {
        await userService.getUserById('nonexistent');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('User not found');
      }
    });

    it('should throw NotFoundError if user is deleted', async () => {
      const mockUser = {
        _id: 'userId123',
        status: 'deleted'
      };

      const queryStub = {
        select: sandbox.stub().returnsThis()
      };
      sandbox.stub(User, 'findById').returns(queryStub);
      queryStub.select.resolves(mockUser);

      try {
        await userService.getUserById('userId123');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
      }
    });
  });

  describe('updateProfile', () => {
    it('should update allowed profile fields', async () => {
      const mockUser = {
        _id: 'userId123',
        status: 'active'
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      const updatedUser = {
        ...mockUser,
        profile: {
          displayName: 'New Name',
          bio: 'New Bio'
        }
      };

      sandbox.stub(User, 'findByIdAndUpdate').resolves(updatedUser);

      const result = await userService.updateProfile('userId123', {
        displayName: 'New Name',
        bio: 'New Bio',
        email: 'should-be-ignored@example.com'
      });

      expect(result).to.equal(updatedUser);
      expect(User.findByIdAndUpdate.calledOnce).to.be.true;

      const updateCall = User.findByIdAndUpdate.getCall(0);
      expect(updateCall.args[1].$set).to.deep.equal({
        'profile.displayName': 'New Name',
        'profile.bio': 'New Bio'
      });
    });
  });

  describe('upsertGameProfile', () => {
    it('should add new game profile', async () => {
      const mockUser = {
        _id: 'userId123',
        status: 'active',
        gameProfiles: [],
        save: sandbox.stub().resolves()
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      const gameProfileData = {
        gameId: 'gameId123',
        inGameName: 'Player1',
        rank: 'Gold',
        skillLevel: 75
      };

      const result = await userService.upsertGameProfile('userId123', gameProfileData);

      expect(mockUser.gameProfiles).to.have.lengthOf(1);
      expect(mockUser.gameProfiles[0]).to.include(gameProfileData);
      expect(mockUser.save.calledOnce).to.be.true;
    });

    it('should update existing game profile', async () => {
      const existingProfile = {
        gameId: { toString: () => 'gameId123' },
        inGameName: 'OldName',
        rank: 'Silver',
        skillLevel: 50,
        toObject: function () {
          return this;
        }
      };

      const mockUser = {
        _id: 'userId123',
        status: 'active',
        gameProfiles: [existingProfile],
        save: sandbox.stub().resolves()
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      const updatedData = {
        gameId: 'gameId123',
        inGameName: 'NewName',
        rank: 'Gold',
        skillLevel: 75
      };

      await userService.upsertGameProfile('userId123', updatedData);

      expect(mockUser.gameProfiles).to.have.lengthOf(1);
      expect(mockUser.gameProfiles[0].rank).to.equal('Gold');
      expect(mockUser.gameProfiles[0].skillLevel).to.equal(75);
      expect(mockUser.save.calledOnce).to.be.true;
    });
  });

  describe('addDeviceToken', () => {
    it('should add device token', async () => {
      const mockUser = {
        _id: 'userId123',
        status: 'active',
        deviceTokens: [],
        save: sandbox.stub().resolves()
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      const tokenData = {
        token: 'device-token-123',
        platform: 'ios'
      };

      const result = await userService.addDeviceToken('userId123', tokenData);

      expect(mockUser.deviceTokens).to.have.lengthOf(1);
      expect(mockUser.deviceTokens[0]).to.include(tokenData);
      expect(mockUser.save.calledOnce).to.be.true;
    });

    it('should throw ConflictError for duplicate token', async () => {
      const tokenData = {
        token: 'device-token-123',
        platform: 'ios'
      };

      const mockUser = {
        _id: 'userId123',
        status: 'active',
        deviceTokens: [tokenData],
        save: sandbox.stub()
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      try {
        await userService.addDeviceToken('userId123', tokenData);
        expect.fail('Should have thrown ConflictError');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictError);
        expect(error.message).to.equal('Device token already registered');
      }
    });

    it('should keep only last 5 tokens', async () => {
      const mockUser = {
        _id: 'userId123',
        status: 'active',
        deviceTokens: [
          { token: 'token1', platform: 'ios' },
          { token: 'token2', platform: 'ios' },
          { token: 'token3', platform: 'ios' },
          { token: 'token4', platform: 'ios' },
          { token: 'token5', platform: 'ios' }
        ],
        save: sandbox.stub().resolves()
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      await userService.addDeviceToken('userId123', {
        token: 'token6',
        platform: 'android'
      });

      expect(mockUser.deviceTokens).to.have.lengthOf(5);
      expect(mockUser.deviceTokens[0].token).to.equal('token2');
      expect(mockUser.deviceTokens[4].token).to.equal('token6');
    });
  });
});
