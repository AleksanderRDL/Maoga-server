const MatchRequest = require('../models/MatchRequest');
const MatchHistory = require('../models/MatchHistory');
const User = require('../../auth/models/User');
const Game = require('../../game/models/Game');
const queueManager = require('./queueManager');
const matchAlgorithmService = require('./matchAlgorithmService');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class MatchmakingService {
  constructor() {
    // Initialize match processor
    this.isProcessing = false;
    this.processInterval = null;

    // Start periodic processing
    this.startProcessing();

    // Listen for queue events
    queueManager.on('requestAdded', ({ gameId, gameMode, region }) => {
      // Trigger immediate processing for this queue
      this.processSpecificQueue(gameId, gameMode, region);
    });
  }

  /**
   * Submit a matchmaking request
   */
  async submitMatchRequest(userId, criteria) {
    try {
      // Check for existing active request
      const existingRequest = await MatchRequest.findActiveByUser(userId);
      if (existingRequest) {
        throw new ConflictError('User already has an active matchmaking request');
      }

      // Validate user
      const user = await User.findById(userId);
      if (!user || user.status !== 'active') {
        throw new BadRequestError('User is not eligible for matchmaking');
      }

      // Validate games
      if (!criteria.games || criteria.games.length === 0) {
        throw new BadRequestError('At least one game must be specified');
      }

      const gameIds = criteria.games.map((g) => g.gameId);
      const games = await Game.find({ _id: { $in: gameIds } });
      if (games.length !== gameIds.length) {
        throw new BadRequestError('One or more invalid game IDs');
      }

      // Create match request
      const matchRequest = new MatchRequest({
        userId,
        criteria: {
          ...criteria,
          languages: criteria.languages || [user.gamingPreferences?.languages?.[0] || 'en'],
          regions: criteria.regions || ['ANY']
        }
      });

      await matchRequest.save();

      // Add to queue
      queueManager.addRequest(matchRequest);

      // TODO: Trigger notification service (Sprint 8)

      logger.info('Match request submitted', {
        requestId: matchRequest._id,
        userId,
        primaryGame: matchRequest.getPrimaryGame()?.gameId,
        gameMode: criteria.gameMode
      });

      return matchRequest;
    } catch (error) {
      logger.error('Failed to submit match request', {
        error: error.message,
        userId,
        criteria
      });
      throw error;
    }
  }

  /**
   * Cancel a matchmaking request
   */
  async cancelMatchRequest(userId, requestId) {
    try {
      const request = await MatchRequest.findOne({
        _id: requestId,
        userId,
        status: 'searching'
      });

      if (!request) {
        throw new NotFoundError('Match request not found or already processed');
      }

      // Remove from queue
      const removed = queueManager.removeRequest(userId, requestId);
      if (!removed) {
        logger.warn('Request not found in queue', { requestId, userId });
      }

      // Update status
      request.status = 'cancelled';
      await request.save();

      logger.info('Match request cancelled', {
        requestId,
        userId,
        searchDuration: request.searchDuration
      });

      return request;
    } catch (error) {
      logger.error('Failed to cancel match request', {
        error: error.message,
        userId,
        requestId
      });
      throw error;
    }
  }

  /**
   * Get user's current match request
   */
  async getCurrentMatchRequest(userId) {
    try {
      // Await the full query chain here
      const requestDoc = await MatchRequest.findActiveByUser(userId) // findActiveByUser now returns a query
        .populate('criteria.games.gameId', 'name slug')
        .populate('preselectedUsers', 'username profile.displayName');

      if (!requestDoc) {
        // Check the resolved document
        return null;
      }

      return {
        request: requestDoc, // Use the resolved document
        queueInfo: {
          position: null,
          estimatedWaitTime: this.estimateWaitTime(requestDoc) // Pass the document
        }
      };
    } catch (error) {
      logger.error('Failed to get current match request', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get match history for a user
   */
  async getMatchHistory(userId, options = {}) {
    try {
      const { page = 1, limit = 20, gameId, status } = options;
      const skip = (page - 1) * limit;

      const query = {
        'participants.userId': userId
      };

      if (gameId) {
        query.gameId = gameId;
      }

      if (status) {
        query.status = status;
      }

      const [matches, total] = await Promise.all([
        MatchHistory.find(query)
          .populate('gameId', 'name slug')
          .populate('participants.userId', 'username profile.displayName')
          .sort({ formedAt: -1 })
          .limit(limit)
          .skip(skip),
        MatchHistory.countDocuments(query)
      ]);

      return {
        matches,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get match history', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Start periodic match processing
   */
  startProcessing() {
    // Process queues every 5 seconds
    this.processInterval = setInterval(() => {
      this.processAllQueues();
    }, 5000);

    logger.info('Matchmaking processor started');
  }

  /**
   * Stop match processing
   */
  stopProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    logger.info('Matchmaking processor stopped');
  }

  /**
   * Process all active queues
   */
  async processAllQueues() {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      const stats = queueManager.getStats();

      // Process each queue
      for (const [gameId, gameQueues] of Object.entries(stats.queueSizes)) {
        for (const [gameMode, modeQueues] of Object.entries(gameQueues)) {
          for (const [region, queueSize] of Object.entries(modeQueues)) {
            if (queueSize >= 2) {
              await this.processSpecificQueue(gameId, gameMode, region);
            }
          }
        }
      }

      // Apply relaxation to long-waiting requests
      await this.applyRelaxationToWaitingRequests();
    } catch (error) {
      logger.error('Failed to process queues', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a specific queue
   */
  async processSpecificQueue(gameId, gameMode, region) {
    try {
      const requests = queueManager.getQueueRequests(gameId, gameMode, region);

      if (requests.length < 2) {
        return;
      }

      // Process matches
      const matches = await matchAlgorithmService.processQueue(gameId, gameMode, region, requests);

      // Handle formed matches
      for (const match of matches) {
        await this.finalizeMatch(match);
      }

      // Update queue statistics
      matches.forEach(() => {
        queueManager.updateStats(true);
      });
    } catch (error) {
      logger.error('Failed to process specific queue', {
        error: error.message,
        gameId,
        gameMode,
        region
      });
    }
  }

  /**
   * Finalize a match
   */
  finalizeMatch(matchData) {
    try {
      const { matchHistory, participants } = matchData;

      // Remove participants from queue
      participants.forEach((participant) => {
        queueManager.removeRequest(participant.userId, participant.requestId);
      });

      // TODO: Create lobby (Sprint 7) (remember to make method async when implemented)
      // const lobby = await lobbyService.createLobby(matchHistory);
      // matchHistory.lobbyId = lobby._id;
      // await matchHistory.save();

      // TODO: Send notifications to participants (Sprint 8)

      logger.info('Match finalized', {
        matchId: matchHistory._id,
        participantCount: participants.length
      });

      return matchHistory;
    } catch (error) {
      logger.error('Failed to finalize match', {
        error: error.message,
        matchId: matchData.matchHistory._id
      });
      throw error;
    }
  }

  /**
   * Apply relaxation to long-waiting requests
   */
  async applyRelaxationToWaitingRequests() {
    try {
      // Find requests that have been waiting for a while
      const waitingRequests = await MatchRequest.find({
        status: 'searching',
        searchStartTime: { $lte: new Date(Date.now() - 30000) } // 30 seconds
      }).limit(50);

      for (const request of waitingRequests) {
        const relaxed = await matchAlgorithmService.applyCriteriaRelaxation(request);

        if (relaxed) {
          // Re-queue with updated criteria
          const queueInfo = queueManager.getUserRequest(request.userId.toString());
          if (queueInfo) {
            // Request is still in queue, criteria have been relaxed
            logger.debug('Relaxed criteria for request', {
              requestId: request._id,
              relaxationLevel: request.relaxationLevel
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to apply relaxation', { error: error.message });
    }
  }

  /**
   * Estimate wait time for a request
   */
  estimateWaitTime(request) {
    const queueInfo = queueManager.getUserRequest(request.userId.toString());
    if (!queueInfo) {
      return null;
    }

    const stats = queueManager.getStats();
    const avgWaitTime = stats.avgWaitTime || 60000; // Default 1 minute

    // Simple estimation based on queue size and average wait time
    const queueSize =
      stats.queueSizes[queueInfo.gameId]?.[queueInfo.gameMode]?.[queueInfo.region] || 0;
    const estimatedTime = (queueSize / 2) * avgWaitTime;

    return {
      estimated: estimatedTime,
      confidence: queueSize > 10 ? 'high' : 'low'
    };
  }

  /**
   * Get matchmaking statistics
   */
  async getStatistics(options = {}) {
    try {
      const queueStats = queueManager.getStats();
      const matchStats = await matchAlgorithmService.getMatchStatistics(options.timeRange);

      return {
        queues: queueStats,
        matches: matchStats,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get matchmaking statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = new MatchmakingService();
