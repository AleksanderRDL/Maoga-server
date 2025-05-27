const express = require('express');
const userController = require('../controllers/userController');
const { validateRequest, validateParams } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  updateProfileSchema,
  updateGamingPreferencesSchema,
  gameProfileSchema,
  notificationSettingsSchema,
  deviceTokenSchema,
  gameIdParamSchema,
  tokenParamSchema
} = require('../validations/userValidation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Profile management
router.get('/me', rateLimiter.standard, userController.getMe);

router.patch(
  '/me',
  rateLimiter.standard,
  validateRequest(updateProfileSchema),
  userController.updateProfile
);

// Gaming preferences
router.patch(
  '/me/preferences',
  rateLimiter.standard,
  validateRequest(updateGamingPreferencesSchema),
  userController.updateGamingPreferences
);

// Game profiles
router.put(
  '/me/game-profiles',
  rateLimiter.standard,
  validateRequest(gameProfileSchema),
  userController.upsertGameProfile
);

router.delete(
  '/me/game-profiles/:gameId',
  rateLimiter.standard,
  validateParams(gameIdParamSchema),
  userController.removeGameProfile
);

// Notification settings
router.patch(
  '/me/notifications/settings',
  rateLimiter.standard,
  validateRequest(notificationSettingsSchema),
  userController.updateNotificationSettings
);

// Device tokens for push notifications
router.post(
  '/me/devices',
  rateLimiter.standard,
  validateRequest(deviceTokenSchema),
  userController.addDeviceToken
);

router.delete(
  '/me/devices/:token',
  rateLimiter.standard,
  validateParams(tokenParamSchema),
  userController.removeDeviceToken
);

module.exports = router;
