const admin = require('firebase-admin');
const config = require('../../../config');
const logger = require('../../../utils/logger');

class PushService {
  constructor() {
    this.initialized = false;
    this.messaging = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Firebase Admin with service account
      if (config.firebase.serviceAccount) {
        const app = admin.initializeApp({
          credential: admin.credential.cert(config.firebase.serviceAccount),
          projectId: config.firebase.projectId
        });

        this.messaging = app?.messaging ? app.messaging() : null;
        this.initialized = true;

        logger.info('Firebase Admin SDK initialized');
      } else {
        logger.warn('Firebase service account not configured');
      }
    } catch (error) {
      logger.error('Failed to initialize Firebase Admin SDK', {
        error: error.message
      });
    }
  }

  /**
   * Send push notification
   */
  async sendNotification(options) {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.messaging) {
      return {
        success: false,
        error: 'Push notifications not configured'
      };
    }

    try {
      const { tokens, title, body, data, priority = 'normal', badge } = options;

      // Create message payload
      const message = {
        notification: {
          title,
          body
        },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            channelId: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body
              },
              sound: 'default',
              badge: badge || 0,
              contentAvailable: true
            }
          }
        }
      };

      // Send to multiple tokens
      const response = await this.messaging.sendMulticast({
        ...message,
        tokens: tokens.filter(Boolean) // Remove any null/undefined tokens
      });

      const successfulTokens = [];
      const failedTokens = [];

      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          successfulTokens.push(tokens[idx]);
        } else {
          failedTokens.push({
            token: tokens[idx],
            error: resp.error?.code || 'Unknown error'
          });
        }
      });

      logger.info('Push notifications sent', {
        total: tokens.length,
        success: response.successCount,
        failure: response.failureCount
      });

      // Handle invalid tokens
      if (failedTokens.length > 0) {
        await this.handleFailedTokens(failedTokens);
      }

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        successfulTokens,
        failedTokens
      };
    } catch (error) {
      logger.error('Failed to send push notification', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sanitize data for FCM
   */
  sanitizeData(data) {
    const sanitized = {};

    Object.entries(data || {}).forEach(([key, value]) => {
      // FCM data values must be strings
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    });

    return sanitized;
  }

  /**
   * Handle failed tokens (remove invalid ones)
   */
  async handleFailedTokens(failedTokens) {
    const invalidTokenErrors = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered'
    ];

    const tokensToRemove = failedTokens
      .filter((ft) => invalidTokenErrors.includes(ft.error))
      .map((ft) => ft.token);

    if (tokensToRemove.length > 0) {
      // Remove invalid tokens from users
      const User = require('../../auth/models/User');
      await User.updateMany(
        { 'deviceTokens.token': { $in: tokensToRemove } },
        { $pull: { deviceTokens: { token: { $in: tokensToRemove } } } }
      );

      logger.info('Removed invalid device tokens', {
        count: tokensToRemove.length
      });
    }
  }

  /**
   * Send topic notification
   */
  async sendToTopic(topic, options) {
    if (!this.messaging) {
      return { success: false, error: 'Push notifications not configured' };
    }

    try {
      const { title, body, data } = options;

      const message = {
        topic,
        notification: {
          title,
          body
        },
        data: this.sanitizeData(data)
      };

      const response = await this.messaging.send(message);

      logger.info('Topic notification sent', {
        topic,
        messageId: response
      });

      return { success: true, messageId: response };
    } catch (error) {
      logger.error('Failed to send topic notification', {
        error: error.message,
        topic
      });

      return { success: false, error: error.message };
    }
  }
}

module.exports = new PushService();
