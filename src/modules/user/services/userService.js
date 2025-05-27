const User = require('../../auth/models/User');
const { NotFoundError, ConflictError, BadRequestError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId, includePrivateData = false) {
    try {
      const query = User.findById(userId);

      if (includePrivateData) {
        query.select('+refreshTokens');
      }

      const user = await query;

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.status === 'deleted') {
        throw new NotFoundError('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Failed to get user by ID', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updateData) {
    try {
      const user = await this.getUserById(userId);

      // Fields that can be updated
      const allowedFields = ['displayName', 'bio', 'profileImage'];
      const profileUpdate = {};

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          profileUpdate[`profile.${field}`] = updateData[field];
        }
      });

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: profileUpdate },
        { new: true, runValidators: true }
      );

      logger.info('User profile updated', { userId, fields: Object.keys(profileUpdate) });

      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user profile', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update gaming preferences
   */
  async updateGamingPreferences(userId, preferences) {
    try {
      const user = await this.getUserById(userId);

      const allowedFields = ['competitiveness', 'preferredGames', 'regions', 'languages'];
      const preferencesUpdate = {};

      allowedFields.forEach((field) => {
        if (preferences[field] !== undefined) {
          preferencesUpdate[`gamingPreferences.${field}`] = preferences[field];
        }
      });

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: preferencesUpdate },
        { new: true, runValidators: true }
      );

      logger.info('Gaming preferences updated', { userId, fields: Object.keys(preferencesUpdate) });

      return updatedUser;
    } catch (error) {
      logger.error('Failed to update gaming preferences', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Add or update game profile
   */
  async upsertGameProfile(userId, gameProfileData) {
    try {
      const user = await this.getUserById(userId);

      const { gameId, inGameName, rank, skillLevel } = gameProfileData;

      // Check if game profile already exists
      const existingProfileIndex = user.gameProfiles.findIndex(
        (profile) => profile.gameId.toString() === gameId
      );

      if (existingProfileIndex !== -1) {
        // Update existing profile
        user.gameProfiles[existingProfileIndex] = {
          ...user.gameProfiles[existingProfileIndex].toObject(),
          inGameName,
          rank,
          skillLevel,
          updatedAt: new Date()
        };
      } else {
        // Add new profile
        user.gameProfiles.push({
          gameId,
          inGameName,
          rank,
          skillLevel
        });
      }

      await user.save();

      logger.info('Game profile upserted', { userId, gameId });

      return user;
    } catch (error) {
      logger.error('Failed to upsert game profile', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Remove game profile
   */
  async removeGameProfile(userId, gameId) {
    try {
      const user = await this.getUserById(userId);

      const initialLength = user.gameProfiles.length;
      user.gameProfiles = user.gameProfiles.filter(
        (profile) => profile.gameId.toString() !== gameId
      );

      if (user.gameProfiles.length === initialLength) {
        throw new NotFoundError('Game profile not found');
      }

      await user.save();

      logger.info('Game profile removed', { userId, gameId });

      return user;
    } catch (error) {
      logger.error('Failed to remove game profile', { error: error.message, userId, gameId });
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(userId, settings) {
    try {
      const user = await this.getUserById(userId);

      // Deep merge notification settings
      const updateQuery = {};

      ['email', 'push', 'inApp'].forEach((channel) => {
        if (settings[channel]) {
          Object.keys(settings[channel]).forEach((notificationType) => {
            const value = settings[channel][notificationType];
            if (typeof value === 'boolean') {
              updateQuery[`notificationSettings.${channel}.${notificationType}`] = value;
            }
          });
        }
      });

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateQuery },
        { new: true, runValidators: true }
      );

      logger.info('Notification settings updated', { userId });

      return updatedUser;
    } catch (error) {
      logger.error('Failed to update notification settings', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Add device token for push notifications
   */
  async addDeviceToken(userId, tokenData) {
    try {
      const user = await this.getUserById(userId);

      const { token, platform } = tokenData;

      // Check if token already exists
      const existingToken = user.deviceTokens.find((dt) => dt.token === token);
      if (existingToken) {
        throw new ConflictError('Device token already registered');
      }

      user.deviceTokens.push({
        token,
        platform,
        createdAt: new Date()
      });

      // Keep only last 5 tokens per user
      if (user.deviceTokens.length > 5) {
        user.deviceTokens = user.deviceTokens.slice(-5);
      }

      await user.save();

      logger.info('Device token added', { userId, platform });

      return user;
    } catch (error) {
      logger.error('Failed to add device token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Remove device token
   */
  async removeDeviceToken(userId, token) {
    try {
      const user = await this.getUserById(userId);

      const initialLength = user.deviceTokens.length;
      user.deviceTokens = user.deviceTokens.filter((dt) => dt.token !== token);

      if (user.deviceTokens.length === initialLength) {
        throw new NotFoundError('Device token not found');
      }

      await user.save();

      logger.info('Device token removed', { userId });

      return user;
    } catch (error) {
      logger.error('Failed to remove device token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Search users (for admin or friend search in future)
   */
  async searchUsers(query, options = {}) {
    try {
      const { search, limit = 20, skip = 0 } = options;

      const searchQuery = {};

      if (search) {
        searchQuery.$or = [
          { username: { $regex: search, $options: 'i' } },
          { 'profile.displayName': { $regex: search, $options: 'i' } }
        ];
      }

      // Exclude deleted users
      searchQuery.status = { $ne: 'deleted' };

      const users = await User.find(searchQuery).limit(limit).skip(skip).select('-refreshTokens');

      const total = await User.countDocuments(searchQuery);

      return {
        users,
        total,
        limit,
        skip
      };
    } catch (error) {
      logger.error('Failed to search users', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(userId) {
    try {
      await User.findByIdAndUpdate(userId, { lastActive: new Date() });
    } catch (error) {
      logger.error('Failed to update last active', { error: error.message, userId });
      // Don't throw - this is a non-critical update
    }
  }
}

module.exports = new UserService();
