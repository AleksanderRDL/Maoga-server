const express = require('express');
const matchmakingController = require('../controllers/matchmakingController');
const { validateRequest, validateParams, validateQuery } = require('../../../middleware/validator');
const { authenticate, authorize } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  submitMatchRequestSchema,
  cancelMatchRequestParamsSchema,
  getMatchHistoryQuerySchema,
  getMatchmakingStatsQuerySchema
} = require('../validations/matchmakingValidation');

const router = express.Router();

// All matchmaking routes require authentication
router.use(authenticate);

// Submit matchmaking request
router.post(
  '/',
  rateLimiter.standard,
  validateRequest(submitMatchRequestSchema),
  matchmakingController.submitMatchRequest
);

// Get current matchmaking status
router.get('/status', rateLimiter.relaxed, matchmakingController.getMatchmakingStatus);

// Cancel matchmaking request
router.delete(
  '/:requestId',
  rateLimiter.standard,
  validateParams(cancelMatchRequestParamsSchema),
  matchmakingController.cancelMatchRequest
);

// Get match history
router.get(
  '/history',
  rateLimiter.relaxed,
  validateQuery(getMatchHistoryQuerySchema),
  matchmakingController.getMatchHistory
);

// Admin routes
router.get(
  '/stats',
  authorize('admin'),
  rateLimiter.relaxed,
  validateQuery(getMatchmakingStatsQuerySchema),
  matchmakingController.getMatchmakingStats
);

module.exports = router;
