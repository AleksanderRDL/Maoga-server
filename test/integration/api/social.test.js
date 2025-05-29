const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const Friendship = require('../../../src/modules/social/models/Friendship');
const authService = require('../../../src/modules/auth/services/authService');
const { testUsers } = require('../../fixtures/users');
const mongoose = require('mongoose');

describe('Social API - Friend System (Sprint 4)', () => {
  let user1Token, user2Token;
  let user1, user2, user3;

  beforeEach(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});

    // Create users
    const user1Result = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    user1Token = user1Result.accessToken;
    user1 = user1Result.user;

    const user2Result = await authService.register({
      email: testUsers[1].email,
      username: testUsers[1].username,
      password: testUsers[1].password
    });
    user2Token = user2Result.accessToken;
    user2 = user2Result.user;

    const user3Result = await authService.register({
      email: 'user3@example.com',
      username: 'user3',
      password: 'Password123!'
    });
    user3 = user3Result.user; // No token needed for user3 as a target
  });

  describe('POST /api/social/friends/requests (or equivalent service call)', () => {
    // This test assumes an API endpoint. If friend requests are created via a direct service call
    // in Sprint 4 (e.g., from another module), you might need to adapt this to call the service method directly.
    // For now, we'll assume an API endpoint is planned or exists.
    // If your `socialModule.routes` is just a placeholder, these will fail until implemented.
    // You might need to temporarily expose `friendService.sendFriendRequest` for testing
    // or wait until the route is implemented.

    // Placeholder: If you have a route for sending friend requests:
    // const FRIEND_REQUEST_ENDPOINT = '/api/social/friends/requests';

    // If testing service directly (less ideal for true integration but good for now):
    const friendService = require('../../../src/modules/social/services/friendService');

    it('should allow a user to send a friend request to another user', async () => {
      // Using service directly for now, adapt if endpoint exists
      const friendship = await friendService.sendFriendRequest(user1.id, user2.id);

      expect(friendship).to.exist;
      expect(friendship.status).to.equal('pending');
      expect(friendship.requestedBy.toString()).to.equal(user1.id);
      // User1Id and User2Id order is handled by pre-save hook, so check presence
      const idsInFriendship = [friendship.user1Id.toString(), friendship.user2Id.toString()];
      expect(idsInFriendship).to.include.members([user1.id, user2.id]);

      const dbFriendship = await Friendship.findById(friendship._id);
      expect(dbFriendship).to.exist;
      expect(dbFriendship.status).to.equal('pending');
    });

    it('should prevent sending a friend request to oneself', async () => {
      try {
        await friendService.sendFriendRequest(user1.id, user1.id);
        expect.fail('Should not allow sending friend request to oneself.');
      } catch (error) {
        expect(error.message).to.equal('Cannot send friend request to yourself');
        expect(error.statusCode).to.equal(400); // Assuming BadRequestError
      }
    });

    it('should prevent sending a duplicate friend request if one is already pending', async () => {
      await friendService.sendFriendRequest(user1.id, user2.id); // First request

      try {
        await friendService.sendFriendRequest(user1.id, user2.id); // Duplicate
        expect.fail('Should not allow duplicate pending friend request.');
      } catch (error) {
        expect(error.message).to.equal('Friend request already pending');
        expect(error.statusCode).to.equal(409); // Assuming ConflictError
      }
    });
    it('should allow re-sending a friend request if the previous one was declined', async () => {
      // Simulate a declined request
      const initialRequest = await friendService.sendFriendRequest(user1.id, user2.id);
      initialRequest.status = 'declined';
      initialRequest.declinedAt = new Date();
      await initialRequest.save();

      // Re-send the request
      const newRequest = await friendService.sendFriendRequest(user1.id, user2.id);
      expect(newRequest).to.exist;
      expect(newRequest._id.toString()).to.equal(initialRequest._id.toString()); // Should reuse the document
      expect(newRequest.status).to.equal('pending');
      expect(newRequest.requestedBy.toString()).to.equal(user1.id);
      expect(newRequest.declinedAt).to.be.undefined;
    });

    it('should throw NotFoundError if target user does not exist', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      try {
        await friendService.sendFriendRequest(user1.id, nonExistentUserId);
        expect.fail('Should throw NotFoundError for non-existent target user.');
      } catch (error) {
        expect(error.message).to.equal('Target user not found');
        expect(error.statusCode).to.equal(404);
      }
    });
  });
});
