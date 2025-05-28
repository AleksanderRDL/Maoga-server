const gameService = require('../services/gameService');
const asyncHandler = require('../../../utils/asyncHandler');
const logger = require('../../../utils/logger');

/**
 * Get game by ID
 */
const getGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const game = await gameService.getGameById(gameId);

  res.status(200).json({
    status: 'success',
    data: { game }
  });
});

/**
 * Search games
 */
const searchGames = asyncHandler(async (req, res) => {
  const {
    q: query,
    genres,
    platforms,
    multiplayer,
    page = 1,
    limit = 20,
    sort: sortBy = 'popularity'
  } = req.query;

  const options = {
    query,
    genres: genres ? genres.split(',').map(Number) : undefined,
    platforms: platforms ? platforms.split(',').map(Number) : undefined,
    multiplayer: multiplayer === 'true' ? true : multiplayer === 'false' ? false : undefined,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sortBy
  };

  const result = await gameService.searchGames(options);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get or fetch game from external source
 */
const getOrFetchGame = asyncHandler(async (req, res) => {
  const { query } = req.body;

  const game = await gameService.getOrFetchGame(query);

  res.status(200).json({
    status: 'success',
    data: { game }
  });
});

/**
 * Get trending games
 */
const getTrendingGames = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const games = await gameService.getTrendingGames(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    data: { games }
  });
});

/**
 * Sync popular games (admin only)
 */
// eslint-disable-next-line require-await
const syncPopularGames = asyncHandler(async (req, res) => {
  const { limit = 2000 } = req.body;

  // This should be triggered as a background job in production
  // For now, we'll run it synchronously but return immediately
  res.status(202).json({
    status: 'success',
    data: { message: 'Game sync started' }
  });

  // Start sync in background
  // eslint-disable-next-line require-await
  gameService.syncPopularGames(limit).catch((error) => {
    logger.error('Background game sync failed', { error: error.message });
  });
});

/**
 * Update game statistics (internal use)
 */
const updateGameStats = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { playerCount, activeLobbies } = req.body;

  const game = await gameService.updateGameStats(gameId, {
    playerCount,
    activeLobbies
  });

  res.status(200).json({
    status: 'success',
    data: { game }
  });
});

module.exports = {
  getGame,
  searchGames,
  getOrFetchGame,
  getTrendingGames,
  syncPopularGames,
  updateGameStats
};
