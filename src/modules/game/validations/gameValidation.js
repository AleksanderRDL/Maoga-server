const Joi = require('joi');

// Search games query validation
const searchGamesSchema = Joi.object({
  q: Joi.string().trim().max(100).optional(),
  genres: Joi.string()
    .pattern(/^\d+(,\d+)*$/)
    .optional(),
  platforms: Joi.string()
    .pattern(/^\d+(,\d+)*$/)
    .optional(),
  multiplayer: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('popularity', 'rating', 'recent', 'name').default('popularity')
});

// Get or fetch game validation
const getOrFetchGameSchema = Joi.object({
  query: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Game query must be at least 2 characters',
    'string.max': 'Game query cannot exceed 100 characters',
    'any.required': 'Game query is required'
  })
});

// Game ID parameter validation
const gameIdParamSchema = Joi.object({
  gameId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid game ID format'
    })
});

// Sync games validation (admin)
const syncGamesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(5000).default(2000)
});

// Update game stats validation
const updateGameStatsSchema = Joi.object({
  playerCount: Joi.number().integer().min(0).optional(),
  activeLobbies: Joi.number().integer().min(0).optional()
})
  .min(1)
  .messages({
    'object.min': 'At least one stat field is required'
  });

// Trending games query validation
const trendingGamesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(20)
});

module.exports = {
  searchGamesSchema,
  getOrFetchGameSchema,
  gameIdParamSchema,
  syncGamesSchema,
  updateGameStatsSchema,
  trendingGamesQuerySchema
};
