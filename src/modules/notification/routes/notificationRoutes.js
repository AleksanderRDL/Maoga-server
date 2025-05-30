const express = require('express');
const notificationController = require('../controllers/notificationController');
const { validateRequest, validateParams, validateQuery } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  getNotificationsQuerySchema,
  markManyAsReadSchema,
  notificationIdParamSchema,
  updateNotificationSettingsSchema
} = require('../validations/notificationValidation');

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Get user notifications
router.get(
  '/',
  rateLimiter.standard,
  validateQuery(getNotificationsQuerySchema),
  notificationController.getNotifications
);

// Get unread count
router.get('/count', rateLimiter.relaxed, notificationController.getUnreadCount);

// Get notification settings
router.get('/settings', rateLimiter.relaxed, notificationController.getNotificationSettings);

// Update notification settings
router.put(
  '/settings',
  rateLimiter.standard,
  validateRequest(updateNotificationSettingsSchema),
  notificationController.updateNotificationSettings
);

// Mark notification as read
router.patch(
  '/:notificationId/read',
  rateLimiter.standard,
  validateParams(notificationIdParamSchema),
  notificationController.markAsRead
);

// Mark multiple notifications as read
router.post(
  '/mark-read',
  rateLimiter.standard,
  validateRequest(markManyAsReadSchema),
  notificationController.markManyAsRead
);

// Mark all notifications as read
router.post('/mark-all-read', rateLimiter.standard, notificationController.markAllAsRead);

// Delete notification
router.delete(
  '/:notificationId',
  rateLimiter.standard,
  validateParams(notificationIdParamSchema),
  notificationController.deleteNotification
);

module.exports = router;
