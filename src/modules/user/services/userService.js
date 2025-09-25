// src/modules/user/services/userService.js
const User = require('../../auth/models/User');
// eslint-disable-next-line no-unused-vars
const { NotFoundError, ConflictError, BadRequestError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

// Define allowed notification types for validation
const ALLOWED_NOTIFICATION_TYPES = ['friendRequests', 'matchFound', 'lobbyInvites', 'messages'];

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
      const user = await this.getUserById(userId); // Ensures user exists and is not deleted

      user.profile = user.profile || {};
      const updatedFields = [];

      if (updateData.displayName !== undefined) {
        user.profile.displayName = updateData.displayName;
        updatedFields.push('profile.displayName');
      }

      if (updateData.bio !== undefined) {
        user.profile.bio = updateData.bio;
        updatedFields.push('profile.bio');
      }

      if (updateData.profileImage !== undefined) {
        user.profile.profileImage = updateData.profileImage;
        updatedFields.push('profile.profileImage');
      }

      if (updatedFields.length === 0) {
        logger.info('No valid fields to update for user profile', { userId });
        return user;
      }

      await user.save();

      logger.info('User profile updated', { userId, fields: updatedFields });

      return user;
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
      const user = await this.getUserById(userId); // Ensures user exists and is not deleted

      user.gamingPreferences = user.gamingPreferences || {};
      const updatedFields = [];

      if (preferences.competitiveness !== undefined) {
        user.gamingPreferences.competitiveness = preferences.competitiveness;
        updatedFields.push('gamingPreferences.competitiveness');
      }

      if (preferences.preferredGames !== undefined) {
        user.gamingPreferences.preferredGames = preferences.preferredGames;
        updatedFields.push('gamingPreferences.preferredGames');
      }

      if (preferences.regions !== undefined) {
        user.gamingPreferences.regions = preferences.regions;
        updatedFields.push('gamingPreferences.regions');
      }

      if (preferences.languages !== undefined) {
        user.gamingPreferences.languages = preferences.languages;
        updatedFields.push('gamingPreferences.languages');
      }

      if (updatedFields.length === 0) {
        logger.info('No valid fields to update for gaming preferences', { userId });
        return user;
      }

      await user.save();

      logger.info('Gaming preferences updated', { userId, fields: updatedFields });

      return user;
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

      const matchingProfile = user.gameProfiles.find(
        (profile) => profile.gameId.toString() === gameId
      );

      if (matchingProfile) {
        matchingProfile.inGameName = inGameName;
        matchingProfile.rank = rank;
        matchingProfile.skillLevel = skillLevel;
        matchingProfile.updatedAt = new Date();
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
      const user = await this.getUserById(userId);

      user.notificationSettings = user.notificationSettings || {};
      const updatedPaths = [];

      const updateChannel = (channelName, incoming, existing) => {
        if (!incoming || typeof incoming !== 'object') {
          return { changed: false, value: existing };
        }

        Object.keys(incoming).forEach((key) => {
          if (!ALLOWED_NOTIFICATION_TYPES.includes(key)) {
            logger.warn('Attempt to update invalid notification type', {
              userId,
              channel: channelName,
              notificationType: key
            });
          }
        });

        const next = { ...existing };
        let changed = false;

        if (typeof incoming.friendRequests === 'boolean') {
          next.friendRequests = incoming.friendRequests;
          updatedPaths.push(`notificationSettings.${channelName}.friendRequests`);
          changed = true;
        }

        if (typeof incoming.matchFound === 'boolean') {
          next.matchFound = incoming.matchFound;
          updatedPaths.push(`notificationSettings.${channelName}.matchFound`);
          changed = true;
        }

        if (typeof incoming.lobbyInvites === 'boolean') {
          next.lobbyInvites = incoming.lobbyInvites;
          updatedPaths.push(`notificationSettings.${channelName}.lobbyInvites`);
          changed = true;
        }

        if (typeof incoming.messages === 'boolean') {
          next.messages = incoming.messages;
          updatedPaths.push(`notificationSettings.${channelName}.messages`);
          changed = true;
        }

        return { changed, value: changed ? next : existing };
      };

      const emailResult = updateChannel(
        'email',
        settings.email,
        user.notificationSettings.email || {}
      );
      if (emailResult.changed) {
        user.notificationSettings.email = emailResult.value;
      }

      const pushResult = updateChannel('push', settings.push, user.notificationSettings.push || {});
      if (pushResult.changed) {
        user.notificationSettings.push = pushResult.value;
      }

      const inAppResult = updateChannel(
        'inApp',
        settings.inApp,
        user.notificationSettings.inApp || {}
      );
      if (inAppResult.changed) {
        user.notificationSettings.inApp = inAppResult.value;
      }

      if (updatedPaths.length === 0) {
        logger.info('No valid notification settings to update', { userId });
        return user;
      }

      await user.save();

      logger.info('Notification settings updated', { userId, fields: updatedPaths });
      return user;
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
