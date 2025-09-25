const { expect } = require('chai');
const sinon = require('sinon');
const userService = require('../../../../../src/modules/user/services/userService');
const User = require('../../../../../src/modules/auth/models/User');
const { NotFoundError, ConflictError } = require('../../../../../src/utils/errors');
const logger = require('../../../../../src/utils/logger');

describe('UserService', () => {
  let sandbox;
  let loggerInfoStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loggerInfoStub = sandbox.stub(logger, 'info');
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

      // Create a mock Mongoose Query object
      const mockQuery = {
        select: sandbox.stub().returnsThis(), // Make select chainable
        // exec() is what gets called by await on a Mongoose query object implicitly or explicitly.
        // Or you can make the mockQuery itself thenable.
        exec: sandbox.stub().resolves(mockUser)
      };
      // Make the mockQuery thenable by adding a then method that delegates to exec's promise
      // This ensures `await query` in your service works as expected with the stub.
      mockQuery.then = function (onFulfilled, onRejected) {
        return this.exec().then(onFulfilled, onRejected);
      };
      mockQuery.catch = function (onRejected) {
        return this.then(null, onRejected);
      };

      sandbox.stub(User, 'findById').returns(mockQuery);

      const result = await userService.getUserById('userId123', true); // includePrivateData = true

      expect(User.findById.calledWith('userId123')).to.be.true;
      expect(mockQuery.select.calledWith('+refreshTokens')).to.be.true;
      expect(result).to.deep.equal(mockUser); // Use deep.equal for object comparison
    });

    it('should throw NotFoundError if user not found', async () => {
      const mockQuery = {
        select: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(null) // Simulate user not found
      };
      mockQuery.then = function (onFulfilled, onRejected) {
        return this.exec().then(onFulfilled, onRejected);
      };
      mockQuery.catch = function (onRejected) {
        return this.then(null, onRejected);
      };

      sandbox.stub(User, 'findById').returns(mockQuery);

      try {
        await userService.getUserById('nonexistent');
        // If the above line does not throw, this will fail the test
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('User not found');
      }
    });

    it('should throw NotFoundError if user is deleted', async () => {
      const mockUser = { _id: 'userId123', status: 'deleted' };
      const mockQuery = {
        select: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockUser) // Simulate user found but deleted
      };
      mockQuery.then = function (onFulfilled, onRejected) {
        return this.exec().then(onFulfilled, onRejected);
      };
      mockQuery.catch = function (onRejected) {
        return this.then(null, onRejected);
      };

      sandbox.stub(User, 'findById').returns(mockQuery);

      try {
        await userService.getUserById('userId123');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('User not found');
      }
    });
  });

  describe('updateProfile', () => {
    it('should update allowed profile fields', async () => {
      const mockUser = {
        _id: 'userId123',
        status: 'active',
        profile: {},
        save: sandbox.stub().resolves()
      };

      sandbox.stub(userService, 'getUserById').resolves(mockUser);

      const result = await userService.updateProfile('userId123', {
        displayName: 'New Name',
        bio: 'New Bio',
        email: 'should-be-ignored@example.com'
      });

      expect(result).to.equal(mockUser);
      expect(mockUser.profile.displayName).to.equal('New Name');
      expect(mockUser.profile.bio).to.equal('New Bio');
      expect(mockUser.save.calledOnce).to.be.true;
    });

    it('should return the user unmodified if updateData is empty', async () => {
      const mockUserInstance = {
        _id: 'userId123',
        status: 'active',
        profile: {},
        save: sandbox.stub(),
        // Ensure toObject is present if the service code calls it on the result of getUserById
        toObject: function () {
          return this;
        }
      };
      sandbox.stub(userService, 'getUserById').resolves(mockUserInstance);

      const result = await userService.updateProfile('userId123', {});

      expect(result).to.deep.equal(mockUserInstance);
      expect(mockUserInstance.save.called).to.be.false;
      // Use the stubbed logger.info
      expect(loggerInfoStub.calledWithMatch('No valid fields to update for user profile')).to.be
        .true;
    });

    it('should return the user unmodified if updateData contains only non-allowed fields', async () => {
      const mockUserInstance = {
        _id: 'userId123',
        status: 'active',
        email: 'original@example.com',
        profile: {},
        save: sandbox.stub(),
        toObject: function () {
          return this;
        }
      };
      sandbox.stub(userService, 'getUserById').resolves(mockUserInstance);

      const result = await userService.updateProfile('userId123', {
        email: 'new@example.com',
        role: 'admin'
      });

      expect(result).to.deep.equal(mockUserInstance);
      expect(mockUserInstance.save.called).to.be.false;
      // Use the stubbed logger.info
      expect(loggerInfoStub.calledWithMatch('No valid fields to update for user profile')).to.be
        .true;
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
