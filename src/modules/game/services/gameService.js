const Game = require('../models/Game');
const igdbService = require('./igdbService');
const cacheService = require('./cacheService');
const { NotFoundError, BadRequestError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const { escapeRegExp } = require('../../../utils/validation');

class GameService {
  /**
   * Get game by ID
   */
  async getGameById(gameId) {
    try {
      // Check cache first
      const cacheKey = `game:${gameId}`;
      const cachedGame = await cacheService.get(cacheKey);
      if (cachedGame) {
        logger.debug('Game retrieved from cache', { gameId });
        return cachedGame;
      }

      // Get from database
      const game = await Game.findById(gameId);
      if (!game) {
        throw new NotFoundError('Game not found');
      }

      // Cache the result
      await cacheService.set(cacheKey, game, 3600); // 1 hour TTL

      return game;
    } catch (error) {
      logger.error('Failed to get game by ID', { error: error.message, gameId });
      throw error;
    }
  }

  /**
   * Search games with filters
   */
  async searchGames(options) {
    try {
      const {
        query,
        genres,
        platforms,
        multiplayer,
        page = 1,
        limit = 20,
        sortBy = 'popularity'
      } = options;

      // Validate pagination
      const skip = (page - 1) * limit;
      if (limit > 100) {
        throw new BadRequestError('Limit cannot exceed 100');
      }

      // Check cache for common queries
      const cacheKey = `games:search:${JSON.stringify(options)}`;
      const cachedResult = await cacheService.get(cacheKey);
      if (cachedResult) {
        logger.debug('Search results retrieved from cache');
        return cachedResult;
      }

      // Search in database
      const games = await Game.searchGames({
        query,
        genres,
        platforms,
        multiplayer,
        limit,
        skip,
        sortBy
      });

      const total = await Game.countDocuments(
        this._buildSearchFilter({ query, genres, platforms, multiplayer })
      );

      const result = {
        games,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

      // Cache popular searches (first page, default sort)
      if (page === 1 && sortBy === 'popularity') {
        await cacheService.set(cacheKey, result, 300); // 5 minutes TTL
      }

      return result;
    } catch (error) {
      logger.error('Failed to search games', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Get or fetch game from external source
   */
  async getOrFetchGame(query) {
    try {
      // First, try to find in local database
      const sanitizedQuery = escapeRegExp(query);
      let game = await Game.findOne({
        $or: [
          // eslint-disable-next-line security/detect-non-literal-regexp
          { name: new RegExp(sanitizedQuery, 'i') },
          { slug: query.toLowerCase().replace(/\s+/g, '-') }
        ]
      });

      if (game) {
        logger.info('Game found in local database', { gameId: game._id, name: game.name });
        return game;
      }

      // Not found locally, search in IGDB
      logger.info('Game not found locally, searching IGDB', { query });
      const igdbGames = await igdbService.searchGames(query, 1);

      if (!igdbGames || igdbGames.length === 0) {
        throw new NotFoundError('Game not found');
      }

      // Get detailed info for the first result
      const igdbGame = await igdbService.getGameDetails(igdbGames[0].id);

      // Transform and save to database
      game = await this.createGameFromIGDB(igdbGame);

      logger.info('Game fetched from IGDB and saved', { gameId: game._id, name: game.name });
      return game;
    } catch (error) {
      logger.error('Failed to get or fetch game', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Sync popular games from IGDB
   */
  async syncPopularGames(limit = 2000) {
    try {
      logger.info('Starting popular games sync', { limit });

      const games = await igdbService.getPopularGames(limit);
      let synced = 0;
      let failed = 0;

      for (const igdbGame of games) {
        try {
          await this.createOrUpdateGameFromIGDB(igdbGame);
          synced++;

          // Log progress every 100 games
          if (synced % 100 === 0) {
            logger.info('Games sync progress', { synced, total: games.length });
          }
        } catch (error) {
          failed++;
          logger.error('Failed to sync game', {
            error: error.message,
            gameId: igdbGame.id,
            gameName: igdbGame.name
          });
        }
      }

      logger.info('Popular games sync completed', { synced, failed, total: games.length });
      return { synced, failed, total: games.length };
    } catch (error) {
      logger.error('Failed to sync popular games', { error: error.message });
      throw error;
    }
  }

  /**
   * Get trending games
   */
  async getTrendingGames(limit = 20) {
    try {
      const cacheKey = `games:trending:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const games = await Game.findTrending(limit);

      // Cache for 10 minutes
      await cacheService.set(cacheKey, games, 600);

      return games;
    } catch (error) {
      logger.error('Failed to get trending games', { error: error.message });
      throw error;
    }
  }

  /**
   * Update game statistics
   */
  async updateGameStats(gameId, stats) {
    try {
      const { playerCount, activeLobbies } = stats;

      const update = {
        'maogaData.lastActivity': new Date()
      };

      if (playerCount !== undefined) {
        update['maogaData.playerCount'] = playerCount;
      }

      if (activeLobbies !== undefined) {
        update['maogaData.activeLobbies'] = activeLobbies;
      }

      const game = await Game.findByIdAndUpdate(gameId, { $set: update }, { new: true });

      if (!game) {
        throw new NotFoundError('Game not found');
      }

      // Invalidate cache
      await cacheService.del(`game:${gameId}`);

      return game;
    } catch (error) {
      logger.error('Failed to update game stats', { error: error.message, gameId });
      throw error;
    }
  }

  /**
   * Create game from IGDB data
   */
  async createGameFromIGDB(igdbGame) {
    const gameData = this._transformIGDBGame(igdbGame);
    const game = new Game(gameData);
    await game.save();
    return game;
  }

  /**
   * Create or update game from IGDB data
   */
  async createOrUpdateGameFromIGDB(igdbGame) {
    const gameData = this._transformIGDBGame(igdbGame);

    const game = await Game.findOneAndUpdate({ 'externalIds.igdb': igdbGame.id }, gameData, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    });

    return game;
  }

  /**
   * Transform IGDB game data to our schema
   */
  _transformIGDBGame(igdbGame) {
    return {
      name: igdbGame.name,
      slug: igdbGame.slug || this._generateSlug(igdbGame.name),
      description: igdbGame.summary || '',
      summary: igdbGame.summary || '',
      coverImage: igdbGame.cover
        ? {
            url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${igdbGame.cover.image_id}.jpg`,
            thumbnailUrl: `https://images.igdb.com/igdb/image/upload/t_thumb/${igdbGame.cover.image_id}.jpg`
          }
        : null,
      screenshots: (igdbGame.screenshots || []).map((s) => ({
        url: `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`,
        thumbnailUrl: `https://images.igdb.com/igdb/image/upload/t_thumb/${s.image_id}.jpg`
      })),
      videos: (igdbGame.videos || []).map((v) => ({
        name: v.name,
        videoId: v.video_id,
        thumbnailUrl: `https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`
      })),
      genres: igdbGame.genres || [],
      platforms: igdbGame.platforms || [],
      gameModes: igdbGame.game_modes || [],
      themes: igdbGame.themes || [],
      releaseDate: igdbGame.release_dates?.[0]?.date
        ? new Date(igdbGame.release_dates[0].date * 1000)
        : null,
      firstReleaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null,
      rating: igdbGame.rating || 0,
      ratingCount: igdbGame.rating_count || 0,
      popularity: igdbGame.popularity || 0,
      externalIds: {
        igdb: igdbGame.id
      },
      multiplayer: this._extractMultiplayerInfo(igdbGame),
      features: this._extractFeatures(igdbGame),
      lastSyncedAt: new Date(),
      syncStatus: 'synced'
    };
  }

  /**
   * Extract multiplayer information from IGDB data
   */
  _extractMultiplayerInfo(igdbGame) {
    const multiplayer = {
      online: false,
      offline: false,
      maxPlayers: 1,
      minPlayers: 1,
      coop: false
    };

    if (igdbGame.multiplayer_modes) {
      igdbGame.multiplayer_modes.forEach((mode) => {
        if (mode.onlinemax > 0) {
          multiplayer.online = true;
          multiplayer.maxPlayers = Math.max(multiplayer.maxPlayers, mode.onlinemax);
        }
        if (mode.offlinemax > 0) {
          multiplayer.offline = true;
          multiplayer.maxPlayers = Math.max(multiplayer.maxPlayers, mode.offlinemax);
        }
        if (mode.onlinecoopmax > 0 || mode.offlinecoopmax > 0) {
          multiplayer.coop = true;
        }
      });
    }

    return multiplayer;
  }

  /**
   * Extract game features from IGDB data
   */
  _extractFeatures(igdbGame) {
    const features = {
      singlePlayer: false,
      multiPlayer: false,
      coop: false,
      competitive: false,
      crossPlatform: false
    };

    if (igdbGame.game_modes) {
      igdbGame.game_modes.forEach((mode) => {
        switch (mode.name) {
          case 'Single player':
            features.singlePlayer = true;
            break;
          case 'Multiplayer':
            features.multiPlayer = true;
            break;
          case 'Co-operative':
            features.coop = true;
            break;
          case 'Battle Royale':
          case 'Versus':
            features.competitive = true;
            break;
        }
      });
    }

    return features;
  }

  /**
   * Generate slug from game name
   */
  _generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Build search filter
   */
  _buildSearchFilter(options) {
    const filter = {};

    if (options.query) {
      filter.$text = { $search: options.query };
    }

    if (options.genres && options.genres.length > 0) {
      filter['genres.id'] = { $in: options.genres };
    }

    if (options.platforms && options.platforms.length > 0) {
      filter['platforms.id'] = { $in: options.platforms };
    }

    if (options.multiplayer !== undefined) {
      filter['multiplayer.online'] = options.multiplayer;
    }

    return filter;
  }
}

module.exports = new GameService();
