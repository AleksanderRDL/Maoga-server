const matchmakingService = require('../services/matchmakingService');
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * Submit a matchmaking request
 */
const submitMatchRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const criteria = req.body;

  const matchRequest = await matchmakingService.submitMatchRequest(userId, criteria);

  res.status(201).json({
    status: 'success',
    data: {
      matchRequest,
      message: 'Matchmaking request submitted successfully'
    }
  });
});

/**
 * Cancel current matchmaking request
 */
const cancelMatchRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;

  const matchRequest = await matchmakingService.cancelMatchRequest(userId, requestId);

  res.status(200).json({
    status: 'success',
    data: {
      matchRequest,
      message: 'Matchmaking request cancelled successfully'
    }
  });
});

/**
 * Get current matchmaking status
 */
const getMatchmakingStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const currentRequest = await matchmakingService.getCurrentMatchRequest(userId);

  if (!currentRequest) {
    return res.status(200).json({
      status: 'success',
      data: {
        matchRequest: null,
        message: 'No active matchmaking request'
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: currentRequest
  });
});

/**
 * Get user's match history
 */
const getMatchHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, gameId, status } = req.query;

  const result = await matchmakingService.getMatchHistory(userId, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    gameId,
    status
  });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get matchmaking statistics (admin only)
 */
const getMatchmakingStats = asyncHandler(async (req, res) => {
  const { hours = 24 } = req.query;

  const stats = await matchmakingService.getStatistics({
    timeRange: { hours: parseInt(hours, 10) }
  });

  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

module.exports = {
  submitMatchRequest,
  cancelMatchRequest,
  getMatchmakingStatus,
  getMatchHistory,
  getMatchmakingStats
};
