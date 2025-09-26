const Joi = require('joi');

// Calculate maxScheduleTime once when the module is loaded
const MAX_SCHEDULE_TIME_FROM_NOW = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

// Submit match request schema
const submitMatchRequestSchema = Joi.object({
  games: Joi.array()
    .items(
      Joi.object({
        gameId: Joi.string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            'string.pattern.base': 'Invalid game ID format'
          }),
        weight: Joi.number().min(1).max(10).default(5)
      })
    )
    .min(1)
    .max(5)
    .required()
    .messages({
      'array.min': 'At least one game must be selected',
      'array.max': 'Maximum 5 games can be selected'
    }),

  gameMode: Joi.string().valid('casual', 'competitive', 'ranked', 'custom').required().messages({
    'any.required': 'Game mode is required'
  }),

  groupSize: Joi.object({
    min: Joi.number().integer().min(1).max(100).default(1),
    max: Joi.number().integer().min(1).max(100).default(10)
  })
    .custom((value, helpers) => {
      if (value.min > value.max) {
        return helpers.error('custom.groupSize');
      }
      return value;
    })
    .optional()
    .messages({
      'custom.groupSize': 'Minimum group size cannot be greater than maximum'
    }),

  regionPreference: Joi.string().valid('strict', 'preferred', 'any').default('preferred'),

  regions: Joi.array()
    .items(Joi.string().valid('NA', 'EU', 'AS', 'SA', 'OC', 'AF', 'ANY'))
    .min(1)
    .max(6)
    .default(['ANY'])
    .messages({
      'array.min': 'At least one region must be selected'
    }),

  languagePreference: Joi.string().valid('strict', 'preferred', 'any').default('any'),

  languages: Joi.array().items(Joi.string().min(2).max(5)).max(10).optional(),

  skillPreference: Joi.string().valid('similar', 'any').default('similar'),

  scheduledTime: Joi.date().min('now').max(MAX_SCHEDULE_TIME_FROM_NOW).optional().messages({
    // Use the pre-calculated value
    'date.min': 'Scheduled time cannot be in the past',
    'date.max': 'Scheduled time cannot be more than 7 days in the future'
  }),

  preselectedUsers: Joi.array()
    .items(
      Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Invalid user ID format'
        })
    )
    .max(99)
    .optional()
    .messages({
      'array.max': 'Maximum 99 users can be preselected'
    })
}); // Removed .options() that was causing the issue

// Cancel match request params
const cancelMatchRequestParamsSchema = Joi.object({
  requestId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid request ID format'
    })
});

// Get match history query
const getMatchHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  gameId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  status: Joi.string().valid('forming', 'ready', 'in_progress', 'completed', 'cancelled').optional()
});

// Get matchmaking stats query (admin)
const getMatchmakingStatsQuerySchema = Joi.object({
  hours: Joi.number().integer().min(1).max(168).default(24) // Max 1 week
});

module.exports = {
  submitMatchRequestSchema,
  cancelMatchRequestParamsSchema,
  getMatchHistoryQuerySchema,
  getMatchmakingStatsQuerySchema
};
