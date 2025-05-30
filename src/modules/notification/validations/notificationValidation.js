const Joi = require('joi');

// Get notifications query validation
const getNotificationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('unread', 'read', 'archived').optional(),
  type: Joi.string()
    .valid(
      'friend_request',
      'friend_accepted',
      'match_found',
      'lobby_invite',
      'lobby_ready',
      'message_received',
      'system_announcement',
      'achievement_earned',
      'report_update'
    )
    .optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional()
});

// Mark many as read validation
const markManyAsReadSchema = Joi.object({
  notificationIds: Joi.array()
    .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one notification ID must be provided',
      'array.max': 'Cannot mark more than 100 notifications at once'
    })
});

// Notification ID param validation
const notificationIdParamSchema = Joi.object({
  notificationId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid notification ID format'
    })
});

// Update notification settings validation
const updateNotificationSettingsSchema = Joi.object({
  email: Joi.object({
    friendRequests: Joi.boolean().optional(),
    matchFound: Joi.boolean().optional(),
    lobbyInvites: Joi.boolean().optional(),
    messages: Joi.boolean().optional(),
    system: Joi.boolean().optional(),
    achievements: Joi.boolean().optional(),
    reports: Joi.boolean().optional()
  }).optional(),
  push: Joi.object({
    friendRequests: Joi.boolean().optional(),
    matchFound: Joi.boolean().optional(),
    lobbyInvites: Joi.boolean().optional(),
    messages: Joi.boolean().optional(),
    system: Joi.boolean().optional(),
    achievements: Joi.boolean().optional(),
    reports: Joi.boolean().optional()
  }).optional(),
  inApp: Joi.object({
    friendRequests: Joi.boolean().optional(),
    matchFound: Joi.boolean().optional(),
    lobbyInvites: Joi.boolean().optional(),
    messages: Joi.boolean().optional(),
    system: Joi.boolean().optional(),
    achievements: Joi.boolean().optional(),
    reports: Joi.boolean().optional()
  }).optional()
}).min(1);

module.exports = {
  getNotificationsQuerySchema,
  markManyAsReadSchema,
  notificationIdParamSchema,
  updateNotificationSettingsSchema
};
