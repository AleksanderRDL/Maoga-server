const express = require('express');
const gameController = require('../controllers/gameController');
const { validateRequest, validateParams, validateQuery } = require('../../../middleware/validator');
const { authenticate, authorize } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  searchGamesSchema,
  getOrFetchGameSchema,
  gameIdParamSchema,
  syncGamesSchema,
  updateGameStatsSchema,
  trendingGamesQuerySchema
} = require('../validations/gameValidation');

const router = express.Router();

// Public routes
router.get(
  '/games',
  rateLimiter.standard,
  validateQuery(searchGamesSchema),
  gameController.searchGames
);

router.get(
  '/games/trending',
  rateLimiter.relaxed,
  validateQuery(trendingGamesQuerySchema),
  gameController.getTrendingGames
);

router.get(
  '/games/:gameId',
  rateLimiter.relaxed,
  validateParams(gameIdParamSchema),
  gameController.getGame
);

// Protected routes
router.post(
  '/games/fetch',
  authenticate,
  rateLimiter.standard,
  validateRequest(getOrFetchGameSchema),
  gameController.getOrFetchGame
);

// Admin routes
router.post(
  '/admin/games/sync',
  authenticate,
  authorize('admin'),
  rateLimiter.strict,
  validateRequest(syncGamesSchema),
  gameController.syncPopularGames
);

// Internal routes (for other services)
router.patch(
  '/internal/games/:gameId/stats',
  authenticate,
  authorize('admin'), // Or use internal service auth
  validateParams(gameIdParamSchema),
  validateRequest(updateGameStatsSchema),
  gameController.updateGameStats
);

module.exports = router;
