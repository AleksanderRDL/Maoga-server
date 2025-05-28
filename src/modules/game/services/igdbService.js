const axios = require('axios');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { BadRequestError, InternalServerError } = require('../../../utils/errors');

class IGDBService {
  constructor() {
    this.baseURL = 'https://api.igdb.com/v4';
    this.clientId = config.igdb.clientId;
    this.clientSecret = config.igdb.clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;

    // Rate limiting configuration
    this.rateLimits = {
      requestsPerSecond: 4, // IGDB allows 4 requests per second
      dailyLimit: 10000 // Hypothetical daily limit
    };

    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.dailyRequestCount = 0;
    this.dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;
  }

  /**
   * Get or refresh access token
   */
  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      logger.info('Refreshing IGDB access token');

      // Get new token from Twitch OAuth2
      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials'
      });

      this.accessToken = response.data.access_token;
      // Set expiry with 1 hour buffer
      this.tokenExpiry = Date.now() + (response.data.expires_in - 3600) * 1000;

      logger.info('IGDB access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get IGDB access token', { error: error.message });
      throw new InternalServerError('Failed to authenticate with IGDB');
    }
  }

  /**
   * Make rate-limited request to IGDB
   */
  async makeRequest(endpoint, query) {
    try {
      // Check daily limit
      if (Date.now() > this.dailyResetTime) {
        this.dailyRequestCount = 0;
        this.dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;
      }

      if (this.dailyRequestCount >= this.rateLimits.dailyLimit) {
        throw new BadRequestError('Daily API limit reached');
      }

      // Enforce rate limiting (4 requests per second)
      const minTimeBetweenRequests = 1000 / this.rateLimits.requestsPerSecond;
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;

      if (timeSinceLastRequest < minTimeBetweenRequests) {
        const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Get access token
      const accessToken = await this.getAccessToken();

      // Make request
      this.lastRequestTime = Date.now();
      this.dailyRequestCount++;

      const response = await axios.post(`${this.baseURL}${endpoint}`, query, {
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'text/plain'
        }
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        logger.error('IGDB API error', {
          status: error.response.status,
          data: error.response.data,
          endpoint
        });

        if (error.response.status === 429) {
          throw new BadRequestError('IGDB rate limit exceeded');
        }
      }

      throw error;
    }
  }

  /**
   * Search games by name
   */
  async searchGames(query, limit = 10) {
    try {
      const igdbQuery = `
        search "${query}";
        fields id, name, slug, cover.image_id, platforms.name, release_dates.date;
        limit ${limit};
      `;

      const games = await this.makeRequest('/games', igdbQuery);
      return games;
    } catch (error) {
      logger.error('Failed to search games in IGDB', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Get detailed game information
   */
  async getGameDetails(gameId) {
    try {
      const query = `
        where id = ${gameId};
        fields id, name, slug, summary, storyline,
               cover.image_id, screenshots.image_id, videos.*,
               genres.*, platforms.*, game_modes.*, themes.*,
               release_dates.*, rating, rating_count, popularity,
               multiplayer_modes.*;
        limit 1;
      `;

      const games = await this.makeRequest('/games', query);

      if (!games || games.length === 0) {
        throw new NotFoundError('Game not found in IGDB');
      }

      return games[0];
    } catch (error) {
      logger.error('Failed to get game details from IGDB', { error: error.message, gameId });
      throw error;
    }
  }

  /**
   * Get popular games
   */
  async getPopularGames(limit = 2000) {
    try {
      logger.info('Fetching popular games from IGDB', { limit });

      const allGames = [];
      const batchSize = 500; // IGDB max limit per request
      let offset = 0;

      while (allGames.length < limit) {
        const currentBatchSize = Math.min(batchSize, limit - allGames.length);

        const query = `
          fields id, name, slug, summary,
                 cover.image_id, screenshots.image_id, videos.*,
                 genres.*, platforms.*, game_modes.*, themes.*,
                 release_dates.*, first_release_date,
                 rating, rating_count, popularity,
                 multiplayer_modes.*;
          where rating_count > 5 & platforms = (48,49,130,6);
          sort popularity desc;
          limit ${currentBatchSize};
          offset ${offset};
        `;
        // Platform IDs: 48=PS4, 49=Xbox One, 130=Switch, 6=PC

        const games = await this.makeRequest('/games', query);

        if (!games || games.length === 0) {
          break; // No more games
        }

        allGames.push(...games);
        offset += games.length;

        logger.info('Popular games fetch progress', {
          fetched: allGames.length,
          target: limit
        });

        // Add a small delay between batches to be respectful
        if (allGames.length < limit) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      return allGames.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get popular games from IGDB', { error: error.message });
      throw error;
    }
  }

  /**
   * Get games by genre
   */
  async getGamesByGenre(genreId, limit = 50) {
    try {
      const query = `
        fields id, name, slug, cover.image_id, platforms.name, 
               rating, popularity, multiplayer_modes.*;
        where genres = ${genreId} & rating_count > 5;
        sort popularity desc;
        limit ${limit};
      `;

      const games = await this.makeRequest('/games', query);
      return games;
    } catch (error) {
      logger.error('Failed to get games by genre from IGDB', { error: error.message, genreId });
      throw error;
    }
  }

  /**
   * Get multiplayer games
   */
  async getMultiplayerGames(limit = 100) {
    try {
      const query = `
        fields id, name, slug, cover.image_id, platforms.name,
               game_modes.*, multiplayer_modes.*, rating, popularity;
        where game_modes = (2,3,5) & rating_count > 10;
        sort popularity desc;
        limit ${limit};
      `;
      // Game modes: 2=Multiplayer, 3=Co-operative, 5=MMO

      const games = await this.makeRequest('/games', query);
      return games;
    } catch (error) {
      logger.error('Failed to get multiplayer games from IGDB', { error: error.message });
      throw error;
    }
  }

  /**
   * Get genres list
   */
  async getGenres() {
    try {
      const query = `
        fields id, name, slug;
        limit 50;
      `;

      const genres = await this.makeRequest('/genres', query);
      return genres;
    } catch (error) {
      logger.error('Failed to get genres from IGDB', { error: error.message });
      throw error;
    }
  }

  /**
   * Get platforms list
   */
  async getPlatforms() {
    try {
      const query = `
        fields id, name, abbreviation, category;
        where category = (1,5,6);
        limit 50;
      `;
      // Categories: 1=Console, 5=Portable, 6=Platform

      const platforms = await this.makeRequest('/platforms', query);
      return platforms;
    } catch (error) {
      logger.error('Failed to get platforms from IGDB', { error: error.message });
      throw error;
    }
  }
}

module.exports = new IGDBService();
