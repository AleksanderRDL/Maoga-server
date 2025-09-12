const notificationService = require('../services/notificationService');
const asyncHandler = require('../../../utils/asyncHandler');
const { NotFoundError } = require('../../../utils/errors');

/**
 * Get user notifications
 */
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, status, type, priority } = req.query;

  const result = await notificationService.getUserNotifications(userId, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status,
    type,
    priority
  });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get unread notification count
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const Notification = require('../models/Notification');
  const unreadCount = await Notification.getUnreadCount(userId);

  res.status(200).json({
    status: 'success',
    data: {
      unread: unreadCount
    }
  });
});

/**
 * Mark notification as read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  const result = await notificationService.markAsRead(userId, [notificationId]);

  if (result.modifiedCount === 0) {
    // Differentiate between "not found" (silent success) and "belongs to another user"
    const Notification = require('../models/Notification');
    const existing = await Notification.findById(notificationId);
    if (existing) {
      // Notification exists but not owned by this user
      throw new NotFoundError('Notification not found');
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: 'Notification marked as read'
    }
  });
});

/**
 * Mark multiple notifications as read
 */
const markManyAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { notificationIds } = req.body;

  const result = await notificationService.markAsRead(userId, notificationIds);

  res.status(200).json({
    status: 'success',
    data: {
      modifiedCount: result.modifiedCount,
      message: 'Notifications marked as read'
    }
  });
});

/**
 * Mark all notifications as read
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await notificationService.markAllAsRead(userId);

  res.status(200).json({
    status: 'success',
    data: {
      modifiedCount: result.modifiedCount,
      message: 'All notifications marked as read'
    }
  });
});

/**
 * Delete notification
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  const Notification = require('../models/Notification');
  const result = await Notification.deleteOne({
    _id: notificationId,
    userId
  });

  if (result.deletedCount === 0) {
    throw new NotFoundError('Notification not found');
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: 'Notification deleted'
    }
  });
});

/**
 * Update notification settings
 */
const updateNotificationSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const settings = req.body;

  // This delegates to userService as settings are stored on User model
  const userService = require('../../user/services/userService');
  const user = await userService.updateNotificationSettings(userId, settings);

  res.status(200).json({
    status: 'success',
    data: {
      notificationSettings: user.notificationSettings
    }
  });
});

/**
 * Get notification settings
 */
const getNotificationSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const User = require('../../auth/models/User');
  const user = await User.findById(userId).select('notificationSettings');

  res.status(200).json({
    status: 'success',
    data: {
      notificationSettings: user.notificationSettings
    }
  });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markManyAsRead,
  markAllAsRead,
  deleteNotification,
  updateNotificationSettings,
  getNotificationSettings
};
