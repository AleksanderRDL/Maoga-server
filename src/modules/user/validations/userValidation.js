const Joi = require('joi');

// Profile update schema
const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(2).max(50).trim().optional(),
  bio: Joi.string().max(500).trim().optional(),
  profileImage: Joi.string().uri().optional()
});

// Gaming preferences schema
const updateGamingPreferencesSchema = Joi.object({
  competitiveness: Joi.string().valid('casual', 'balanced', 'competitive').optional(),
  preferredGames: Joi.array()
    .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
    .optional(),
  regions: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  languages: Joi.array().items(Joi.string().max(10)).max(10).optional()
});

// Game profile schema
const gameProfileSchema = Joi.object({
  gameId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required(),
  inGameName: Joi.string().max(50).trim().optional(),
  rank: Joi.string().max(50).optional(),
  skillLevel: Joi.number().min(0).max(100).optional()
});

// Notification settings schema
const notificationSettingsSchema = Joi.object({
  email: Joi.object({
    friendRequests: Joi.boolean().optional(),
    matchFound: Joi.boolean().optional(),
    lobbyInvites: Joi.boolean().optional(),
    messages: Joi.boolean().optional()
  }).optional(),
  push: Joi.object({
    friendRequests: Joi.boolean().optional(),
    matchFound: Joi.boolean().optional(),
    lobbyInvites: Joi.boolean().optional(),
    messages: Joi.boolean().optional()
  }).optional(),
  inApp: Joi.object({
    friendRequests: Joi.boolean().optional(),
    matchFound: Joi.boolean().optional(),
    lobbyInvites: Joi.boolean().optional(),
    messages: Joi.boolean().optional()
  }).optional()
});

// Device token schema
const deviceTokenSchema = Joi.object({
  token: Joi.string().required(),
  platform: Joi.string().valid('ios', 'android', 'web').required()
});

// Params validation
const gameIdParamSchema = Joi.object({
  gameId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
});

const tokenParamSchema = Joi.object({
  token: Joi.string().required()
});

module.exports = {
  updateProfileSchema,
  updateGamingPreferencesSchema,
  gameProfileSchema,
  notificationSettingsSchema,
  deviceTokenSchema,
  gameIdParamSchema,
  tokenParamSchema
};
