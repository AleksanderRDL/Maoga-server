const Notification = require('../models/Notification');
const User = require('../../auth/models/User');
const socketManager = require('../../../services/socketManager');
const emailService = require('./emailService');
const pushService = require('./pushService');
const { NotFoundError, BadRequestError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class NotificationService {
  /**
   * Create and dispatch a notification
   */
  async createNotification(userId, notificationData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check user's notification preferences
      const deliveryChannels = this.determineDeliveryChannels(
        user,
        notificationData.type,
        notificationData.priority
      );

      // Create notification
      const notification = new Notification({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
        priority: notificationData.priority || 'medium',
        deliveryChannels,
        expiresAt: notificationData.expiresAt
      });

      await notification.save();

      logger.info('Notification created', {
        notificationId: notification._id,
        userId,
        type: notification.type,
        channels: deliveryChannels
      });

      // Dispatch to delivery channels
      await this.dispatchNotification(notification, user);

      return notification;
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error.message,
        userId,
        notificationData
      });
      throw error;
    }
  }

  /**
   * Determine delivery channels based on user preferences
   */
  determineDeliveryChannels(user, notificationType, priority) {
    const channels = [];
    const settings = user.notificationSettings || {};

    // Map notification types to preference keys in user settings
    // Keys mirror the structure stored on the user document
    const preferenceMap = {
      friend_request: 'friend_request',
      friend_accepted: 'friend_request',
      match_found: 'match_found',
      lobby_invite: 'lobby_invite',
      lobby_ready: 'lobby_invite',
      message_received: 'message_received',
      system_announcement: 'system',
      achievement_earned: 'achievement_earned',
      report_update: 'report_update'
    };

    const preferenceKey = preferenceMap[notificationType] || 'system';

    // Always include in-app notifications
    if (settings.inApp?.[preferenceKey] !== false) {
      channels.push('inApp');
    }

    // Check push notification preference
    if (settings.push?.[preferenceKey] === true && user.deviceTokens?.length > 0) {
      channels.push('push');
    }

    // Check email preference
    if (settings.email?.[preferenceKey] === true) {
      channels.push('email');
    }

    // Force all channels for urgent notifications
    if (priority === 'urgent') {
      if (!channels.includes('inApp')) {
        channels.push('inApp');
      }
      if (!channels.includes('push') && user.deviceTokens?.length > 0) {
        channels.push('push');
      }
      if (!channels.includes('email')) {
        channels.push('email');
      }
    }

    return channels;
  }

  /**
   * Dispatch notification to delivery channels
   */
  async dispatchNotification(notification, user) {
    const notificationQueue = require('../../../jobs/notificationQueue');
    const dispatchPromises = [];

    // In-app notification (via Socket.IO)
    if (notification.deliveryChannels.includes('inApp')) {
      dispatchPromises.push(this.sendInAppNotification(notification, user));
    }

    // Push notification (queue for background processing)
    if (notification.deliveryChannels.includes('push')) {
      dispatchPromises.push(
        notificationQueue.addJob('push', {
          notificationId: notification._id.toString(),
          userId: user._id.toString()
        })
      );
    }

    // Email notification (queue for background processing)
    if (notification.deliveryChannels.includes('email')) {
      dispatchPromises.push(
        notificationQueue.addJob('email', {
          notificationId: notification._id.toString(),
          userId: user._id.toString()
        })
      );
    }

    await Promise.allSettled(dispatchPromises);
  }

  /**
   * Send in-app notification via Socket.IO
   */
  async sendInAppNotification(notification, user) {
    try {
      // Send notification event
      const sent = socketManager.emitToUser(user._id.toString(), 'notification:new', {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority,
          createdAt: notification.createdAt
        }
      });

      if (sent) {
        // Update delivery status
        notification.deliveryStatus.inApp = {
          delivered: true,
          deliveredAt: new Date()
        };
        await notification.save();

        // Send updated count
        const unreadCount = await Notification.getUnreadCount(user._id);
        socketManager.emitToUser(user._id.toString(), 'notification:count', {
          unread: unreadCount
        });

        logger.info('In-app notification sent', {
          notificationId: notification._id,
          userId: user._id
        });
      } else {
        logger.warn('User not connected for in-app notification', {
          notificationId: notification._id,
          userId: user._id
        });
      }

      return sent;
    } catch (error) {
      logger.error('Failed to send in-app notification', {
        error: error.message,
        notificationId: notification._id
      });

      notification.deliveryStatus.inApp = {
        delivered: false,
        error: error.message
      };
      await notification.save();

      throw error;
    }
  }

  /**
   * Process push notification (called from queue)
   */
  async processPushNotification(notificationId) {
    try {
      const notification = await Notification.findById(notificationId).populate(
        'userId',
        'deviceTokens'
      );

      if (!notification) {
        logger.error('Notification not found', { notificationId });
        return;
      }

      const user = notification.userId;
      if (!user.deviceTokens || user.deviceTokens.length === 0) {
        throw new BadRequestError('No device tokens available');
      }

      const result = await pushService.sendNotification({
        tokens: user.deviceTokens.map((dt) => dt.token),
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          ...notification.data
        },
        priority: notification.priority === 'urgent' ? 'high' : 'normal'
      });

      notification.deliveryStatus.push = {
        delivered: result.success,
        deliveredAt: new Date(),
        deviceTokens: result.successfulTokens,
        error: result.error
      };

      await notification.save();

      logger.info('Push notification processed', {
        notificationId,
        success: result.success,
        tokensCount: user.deviceTokens.length
      });

      return result;
    } catch (error) {
      logger.error('Failed to process push notification', {
        error: error.message,
        notificationId
      });

      await Notification.findByIdAndUpdate(notificationId, {
        'deliveryStatus.push': {
          delivered: false,
          error: error.message
        }
      });
      if (error instanceof NotFoundError) {
        return;
      }
      throw error;
    }
  }

  /**
   * Process email notification (called from queue)
   */
  async processEmailNotification(notificationId) {
    try {
      const notification = await Notification.findById(notificationId).populate(
        'userId',
        'email username profile.displayName'
      );

      if (!notification) {
        logger.error('Notification not found', { notificationId });
        return;
      }

      const user = notification.userId;
      const result = await emailService.sendNotificationEmail({
        to: user.email,
        subject: notification.title,
        data: {
          username: user.username,
          displayName: user.profile?.displayName || user.username,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.data?.actionUrl,
          type: notification.type
        }
      });

      notification.deliveryStatus.email = {
        delivered: result.success,
        deliveredAt: new Date(),
        messageId: result.messageId,
        error: result.error
      };

      await notification.save();

      logger.info('Email notification processed', {
        notificationId,
        success: result.success,
        email: user.email
      });

      return result;
    } catch (error) {
      logger.error('Failed to process email notification', {
        error: error.message,
        notificationId
      });

      await Notification.findByIdAndUpdate(notificationId, {
        'deliveryStatus.email': {
          delivered: false,
          error: error.message
        }
      });
      if (error instanceof NotFoundError) {
        return;
      }
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status, type, priority, includeExpired = false } = options;

      const skip = (page - 1) * limit;
      const query = { userId };

      if (status) {
        query.status = status;
      }

      if (type) {
        query.type = type;
      }

      if (priority) {
        query.priority = priority;
      }

      if (!includeExpired) {
        query.$or = [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }];
      }

      const [notifications, total] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).limit(limit).skip(skip),
        Notification.countDocuments(query)
      ]);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user notifications', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId, notificationIds) {
    try {
      const result = await Notification.markManyAsRead(userId, notificationIds);

      // Update unread count
      const unreadCount = await Notification.getUnreadCount(userId);
      socketManager.emitToUser(userId, 'notification:count', {
        unread: unreadCount
      });

      logger.info('Notifications marked as read', {
        userId,
        count: result.modifiedCount
      });

      return result;
    } catch (error) {
      logger.error('Failed to mark notifications as read', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        {
          userId,
          status: 'unread'
        },
        {
          $set: {
            status: 'read',
            readAt: new Date()
          }
        }
      );

      // Update unread count
      socketManager.emitToUser(userId, 'notification:count', {
        unread: 0
      });

      logger.info('All notifications marked as read', {
        userId,
        count: result.modifiedCount
      });

      return result;
    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await Notification.deleteMany({
        $or: [{ status: 'archived' }, { createdAt: { $lt: cutoffDate }, status: 'read' }]
      });

      logger.info('Old notifications cleaned up', {
        deletedCount: result.deletedCount,
        daysToKeep
      });

      return result;
    } catch (error) {
      logger.error('Failed to cleanup old notifications', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new NotificationService();
