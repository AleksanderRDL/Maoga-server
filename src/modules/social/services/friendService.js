const Friendship = require('../models/Friendship');
const User = require('../../auth/models/User');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class FriendService {
  /**
   * Send friend request
   */
  async sendFriendRequest(requesterId, targetUserId) {
    try {
      // Validate users exist
      const [requester, targetUser] = await Promise.all([
        User.findById(requesterId),
        User.findById(targetUserId)
      ]);

      if (!requester) {
        throw new NotFoundError('Requester not found');
      }

      if (!targetUser) {
        throw new NotFoundError('Target user not found');
      }

      // Prevent self-friending
      if (requesterId === targetUserId) {
        throw new BadRequestError('Cannot send friend request to yourself');
      }

      // Check if friendship already exists
      const existingFriendship = await Friendship.findFriendship(requesterId, targetUserId);

      if (existingFriendship) {
        switch (existingFriendship.status) {
          case 'pending':
            throw new ConflictError('Friend request already pending');
          case 'accepted':
            throw new ConflictError('Already friends');
          case 'blocked':
            throw new BadRequestError('Cannot send friend request');
          case 'declined':
            // Allow re-sending after decline
            existingFriendship.status = 'pending';
            existingFriendship.requestedBy = requesterId;
            existingFriendship.declinedAt = undefined;
            await existingFriendship.save();
            return existingFriendship;
        }
      }

      // Create new friendship
      const friendship = new Friendship({
        user1Id: requesterId,
        user2Id: targetUserId,
        requestedBy: requesterId,
        status: 'pending'
      });

      await friendship.save();

      logger.info('Friend request sent', {
        requesterId,
        targetUserId,
        friendshipId: friendship._id
      });

      // TODO: Trigger notification to target user

      return friendship;
    } catch (error) {
      logger.error('Failed to send friend request', {
        error: error.message,
        requesterId,
        targetUserId
      });
      throw error;
    }
  }

  /**
   * Get friend requests for a user
   */
  async getFriendRequests(userId, type = 'received') {
    try {
      let query;

      if (type === 'received') {
        // Get pending requests where user is the target
        query = {
          $or: [
            { user1Id: userId, status: 'pending', requestedBy: { $ne: userId } },
            { user2Id: userId, status: 'pending', requestedBy: { $ne: userId } }
          ]
        };
      } else {
        // Get pending requests sent by user
        query = {
          requestedBy: userId,
          status: 'pending'
        };
      }

      const friendships = await Friendship.find(query)
        .populate(
          'user1Id user2Id requestedBy',
          'username profile.displayName profile.profileImage'
        )
        .sort({ createdAt: -1 });

      // Format the response to show the other user
      const formattedRequests = friendships.map((friendship) => {
        const otherUser =
          friendship.user1Id._id.toString() === userId ? friendship.user2Id : friendship.user1Id;

        return {
          _id: friendship._id,
          user: otherUser,
          requestedBy: friendship.requestedBy,
          status: friendship.status,
          createdAt: friendship.createdAt
        };
      });

      return formattedRequests;
    } catch (error) {
      logger.error('Failed to get friend requests', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get friends list
   */
  async getFriends(userId) {
    try {
      const friendships = await Friendship.find({
        $or: [
          { user1Id: userId, status: 'accepted' },
          { user2Id: userId, status: 'accepted' }
        ]
      }).populate(
        'user1Id user2Id',
        'username profile.displayName profile.profileImage status lastActive'
      );

      // Format to show only the friend's data
      const friends = friendships.map((friendship) => {
        const friend =
          friendship.user1Id._id.toString() === userId ? friendship.user2Id : friendship.user1Id;

        return {
          _id: friend._id,
          username: friend.username,
          displayName: friend.profile.displayName,
          profileImage: friend.profile.profileImage,
          status: friend.status,
          lastActive: friend.lastActive,
          friendshipId: friendship._id,
          friendsSince: friendship.acceptedAt
        };
      });

      return friends;
    } catch (error) {
      logger.error('Failed to get friends list', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId1, userId2) {
    try {
      const friendship = await Friendship.findFriendship(userId1, userId2);
      return friendship && friendship.status === 'accepted';
    } catch (error) {
      logger.error('Failed to check friendship', { error: error.message, userId1, userId2 });
      throw error;
    }
  }

  /**
   * Check if user is blocked
   */
  async isBlocked(userId1, userId2) {
    try {
      const friendship = await Friendship.findFriendship(userId1, userId2);
      return friendship && friendship.status === 'blocked';
    } catch (error) {
      logger.error('Failed to check block status', { error: error.message, userId1, userId2 });
      throw error;
    }
  }
}

module.exports = new FriendService();
