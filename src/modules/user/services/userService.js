const User = require('../../auth/models/User');
// eslint-disable-next-line no-unused-vars
const { NotFoundError, ConflictError, BadRequestError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

// Define allowed notification types for validation
const ALLOWED_NOTIFICATION_TYPES = [
  'friendRequest', // Example type
  'newMessage', // Example type
  'teamInvite' // Example type
  // Add all other valid notification types your application uses
];

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
      await this.getUserById(userId); // Ensures user exists and is not deleted

      // Fields that can be updated
      const allowedFields = ['displayName', 'bio', 'profileImage'];
      const profileUpdate = {};

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          // field is from allowedFields, mitigating object injection for the key.
          // eslint-disable-next-line security/detect-object-injection
          profileUpdate[`profile.${field}`] = updateData[field]; // Line 55
        }
      });

      if (Object.keys(profileUpdate).length === 0) {
        logger.info('No valid fields to update for user profile', { userId });
        return this.getUserById(userId);
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: profileUpdate },
        { new: true, runValidators: true }
      );

      // Logging keys of a safely constructed object is generally fine.
      // eslint-disable-next-line security/detect-object-injection
      logger.info('User profile updated', { userId, fields: Object.keys(profileUpdate) }); // Line 57

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
      await this.getUserById(userId); // Ensures user exists and is not deleted

      const allowedFields = ['competitiveness', 'preferredGames', 'regions', 'languages'];
      const preferencesUpdate = {};

      allowedFields.forEach((field) => {
        if (preferences[field] !== undefined) {
          // field is from allowedFields, mitigating object injection for the key.
          // eslint-disable-next-line security/detect-object-injection
          preferencesUpdate[`gamingPreferences.${field}`] = preferences[field]; // Line 94
        }
      });

      if (Object.keys(preferencesUpdate).length === 0) {
        logger.info('No valid fields to update for gaming preferences', { userId });
        return this.getUserById(userId);
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: preferencesUpdate },
        { new: true, runValidators: true }
      );

      // Logging keys of a safely constructed object.
      // eslint-disable-next-line security/detect-object-injection
      logger.info('Gaming preferences updated', { userId, fields: Object.keys(preferencesUpdate) }); // Line 96

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

      const existingProfileIndex = user.gameProfiles.findIndex(
        (profile) => profile.gameId.toString() === gameId
      );

      if (existingProfileIndex !== -1) {
        user.gameProfiles[existingProfileIndex] = {
          ...user.gameProfiles[existingProfileIndex].toObject(),
          inGameName,
          rank,
          skillLevel,
          updatedAt: new Date()
        };
      } else {
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
      await this.getUserById(userId);

      const updateQuery = {};
      const allowedChannels = ['email', 'push', 'inApp'];

      allowedChannels.forEach((channel) => {
        if (settings[channel] && typeof settings[channel] === 'object') {
          // eslint-disable-next-line security/detect-object-injection
          Object.keys(settings[channel]).forEach((notificationType) => {
            // Related to line 138 (source of keys)
            if (ALLOWED_NOTIFICATION_TYPES.includes(notificationType)) {
              // eslint-disable-next-line security/detect-object-injection
              const value = settings[channel][notificationType]; // Line 138 (access after validation)
              if (typeof value === 'boolean') {
                // Constructing the key path with validated 'channel' and 'notificationType'
                // eslint-disable-next-line security/detect-object-injection
                updateQuery[`notificationSettings.${channel}.${notificationType}`] = value; // Line 137
              }
            } else {
              logger.warn('Attempt to update invalid notification type', {
                userId,
                channel,
                notificationType
              });
            }
          });
        }
      });

      if (Object.keys(updateQuery).length === 0) {
        logger.info('No valid notification settings to update', { userId });
        return this.getUserById(userId);
      }

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

      const existingToken = user.deviceTokens.find((dt) => dt.token === token);
      if (existingToken) {
        throw new ConflictError('Device token already registered');
      }

      user.deviceTokens.push({ token, platform, createdAt: new Date() });
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
        // The keys '$or', 'username', 'profile.displayName' are hardcoded.
        // The structure is defined by the application.
        // eslint-disable-next-line security/detect-object-injection
        searchQuery.$or = [
          // Line 203
          { username: { $regex: search, $options: 'i' } },
          { 'profile.displayName': { $regex: search, $options: 'i' } }
        ];
      }

      // The key 'status' is hardcoded.
      // eslint-disable-next-line security/detect-object-injection
      searchQuery.status = { $ne: 'deleted' }; // Line 204

      // searchQuery is constructed with controlled keys. Passing to Mongoose is standard.
      // Safety of 'search' variable for $regex is a separate NoSQL/ReDoS concern.
      // eslint-disable-next-line security/detect-object-injection
      const users = await User.find(searchQuery).limit(limit).skip(skip).select('-refreshTokens'); // Line 207
      // eslint-disable-next-line security/detect-object-injection
      const total = await User.countDocuments(searchQuery); // Also related to line 207 via searchQuery

      return { users, total, limit, skip };
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
    }
  }
}

module.exports = new UserService();
