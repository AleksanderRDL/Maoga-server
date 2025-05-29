const MatchRequest = require('../models/MatchRequest');
const MatchHistory = require('../models/MatchHistory');
const User = require('../../auth/models/User');
const Game = require('../../game/models/Game');
const queueManager = require('./queueManager');
const matchAlgorithmService = require('./matchAlgorithmService');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const socketManager = require('../../../services/socketManager');
const config = require('../../../config');

class MatchmakingService {
  constructor() {
    this.isProcessing = false;
    this.processInterval = null;
    this.startProcessing();

    queueManager.on('requestAdded', ({ gameId, gameMode, region, requestId }) => {
      // Added requestId
      logger.info('queueManager emitted requestAdded event', {
        gameId,
        gameMode,
        region,
        requestId
      });
      this.processSpecificQueue(gameId, gameMode, region);
    });
  }

  async submitMatchRequest(userId, criteria) {
    try {
      logger.debug(`Attempting to submit match request for userId: ${userId}`, { criteria });
      const existingRequest = await MatchRequest.findActiveByUser(userId);
      if (existingRequest) {
        logger.warn(
          `User ${userId} already has an active matchmaking request: ${existingRequest._id}`
        );
        throw new ConflictError('User already has an active matchmaking request');
      }

      const user = await User.findById(userId);
      if (!user || user.status !== 'active') {
        logger.warn(
          `User ${userId} is not eligible for matchmaking (status: ${user ? user.status : 'not found'})`
        );
        throw new BadRequestError('User is not eligible for matchmaking');
      }

      if (!criteria.games || criteria.games.length === 0) {
        throw new BadRequestError('At least one game must be specified');
      }
      const gameIds = criteria.games.map((g) => g.gameId);
      const games = await Game.find({ _id: { $in: gameIds } });
      if (games.length !== gameIds.length) {
        const foundGameIds = games.map((g) => g._id.toString());
        const missingGameIds = gameIds.filter((id) => !foundGameIds.includes(id));
        logger.warn('One or more invalid game IDs in match request', {
          userId,
          requestedGameIds: gameIds,
          missingGameIds
        });
        throw new BadRequestError(`Invalid game IDs: ${missingGameIds.join(', ')}`);
      }

      const matchRequest = new MatchRequest({
        userId,
        criteria: {
          ...criteria,
          languages: criteria.languages || user.gamingPreferences?.languages || ['en'],
          regions: criteria.regions || user.gamingPreferences?.regions || ['ANY'] // Use user preferences as fallback
        }
      });
      await matchRequest.save();
      logger.info('Match request saved to DB', { requestId: matchRequest._id, userId });

      // Add to queue manager AFTER saving, so request object has ID
      queueManager.addRequest(matchRequest);

      const estimatedTimeResult = this.estimateWaitTime(matchRequest);
      const statusPayload = {
        status: 'searching',
        searchTime: 0, // Initial search time is 0
        estimatedTime: estimatedTimeResult ? estimatedTimeResult.estimated : 300000, // Default 5 mins if estimation fails
        potentialMatches: 0
      };
      logger.info(
        `Emitting initial matchmaking:status for ${matchRequest._id.toString()}`,
        statusPayload
      );
      socketManager.emitMatchmakingStatus(matchRequest._id.toString(), statusPayload);
      // Note: Client needs to subscribe to `match:${matchRequest._id}` room to receive this.
      // This implies the client should get the requestId from the API response first, then subscribe.

      // TODO: trigger notification service

      logger.info('Match request submitted successfully and initial status emitted', {
        requestId: matchRequest._id,
        userId,
        primaryGame: matchRequest.getPrimaryGame()?.gameId,
        gameMode: criteria.gameMode
      });
      return matchRequest;
    } catch (error) {
      logger.error('Failed to submit match request', {
        errorName: error.name,
        errorMessage: error.message,
        userId
        // stack: error.stack // For deeper debugging
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
    // Use the interval from config
    const intervalTime = config.matchmaking.processIntervalMs;

    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(() => {
      logger.debug('Periodic matchmaking processing tick');
      this.processAllQueues();
    }, intervalTime);
    logger.info(`Matchmaking processor started with interval: ${intervalTime}ms`);
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
    logger.info(`Processing specific queue: Game ${gameId}, Mode ${gameMode}, Region ${region}`);
    try {
      const requests = queueManager.getQueueRequests(gameId, gameMode, region);
      logger.debug(`Found ${requests.length} requests in queue ${gameId}-${gameMode}-${region}`);

      if (requests.length < (matchAlgorithmService.config.minGroupSize || 2)) {
        // Use configured minGroupSize
        logger.info(
          `Not enough requests in queue ${gameId}-${gameMode}-${region} to form a match. Found ${requests.length}, need at least ${matchAlgorithmService.config.minGroupSize || 2}.`
        );
        return;
      }

      requests.forEach((request) => {
        // Ensure request is a Mongoose document instance for virtuals like searchDuration
        const searchDuration =
          typeof request.searchDuration === 'number'
            ? request.searchDuration
            : Date.now() - new Date(request.searchStartTime).getTime();
        const estimatedTimeResult = this.estimateWaitTime(request);
        const statusPayload = {
          status: 'searching',
          searchTime: searchDuration,
          potentialMatches: requests.length - 1, // Or a more sophisticated count
          estimatedTime: estimatedTimeResult ? estimatedTimeResult.estimated : 300000
        };
        logger.debug(`Emitting searching status update for request ${request._id}`, statusPayload);
        socketManager.emitMatchmakingStatus(request._id.toString(), statusPayload);
      });

      const enrichedRequests = await matchAlgorithmService.enrichRequests(
        requests.map((r) => new MatchRequest(r))
      ); // Ensure they are Mongoose docs for methods

      const matches = await matchAlgorithmService.findMatches(
        enrichedRequests,
        gameId,
        gameMode,
        region
      );
      logger.info(
        `Match algorithm found ${matches.length} matches for queue ${gameId}-${gameMode}-${region}`
      );

      for (const match of matches) {
        await this.finalizeMatch(match);
      }

      if (matches.length > 0) {
        queueManager.updateStats(
          true,
          matches.reduce(
            (sum, match) => sum + (match.matchHistory.matchingMetrics?.totalSearchTime || 0),
            0
          ) / matches.length
        );
      }
    } catch (error) {
      logger.error('Failed to process specific queue', {
        errorName: error.name,
        errorMessage: error.message,
        gameId,
        gameMode,
        region
        // stack: error.stack
      });
    }
  }

  /**
   * Finalize a match
   */
  async finalizeMatch(matchData) {
    try {
      const { matchHistory, participants } = matchData;
      logger.info(`Finalizing match ${matchHistory._id} with ${participants.length} participants.`);

      participants.forEach((participant) => {
        const statusPayload = {
          status: 'matched',
          matchId: matchHistory._id.toString(),
          participants: participants.map((p) => ({
            // Ensure p.user is defined
            userId: p.user?._id.toString() || p.userId.toString(), // Fallback if p.user isn't populated as expected
            username: p.user?.username || 'Unknown'
          }))
        };
        logger.debug(
          `Emitting 'matched' status for participant ${participant.userId} in request ${participant.requestId}`,
          statusPayload
        );
        socketManager.emitMatchmakingStatus(participant.requestId.toString(), statusPayload);
      });

      participants.forEach((participant) => {
        queueManager.removeRequest(
          participant.user?._id || participant.userId,
          participant.requestId
        );
      });

      // TODO: Create lobby (Sprint 7)
      // const lobby = await lobbyService.createLobby(matchHistory);
      // matchHistory.lobbyId = lobby._id;
      // await matchHistory.save();

      // TODO: Send notifications to participants (Sprint 8)

      logger.info('Match finalized and participants removed from queue', {
        matchId: matchHistory._id,
        participantCount: participants.length
      });
      return matchHistory;
    } catch (error) {
      logger.error('Failed to finalize match', {
        errorName: error.name,
        errorMessage: error.message,
        matchId: matchData.matchHistory?._id
        // stack: error.stack
      });
      throw error; // Rethrow to be caught by caller if necessary
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
  estimateWaitTime(requestDoc) {
    // Renamed from request to requestDoc to indicate it's a document
    // Ensure requestDoc is a Mongoose document if it relies on virtuals or methods
    const request = requestDoc instanceof MatchRequest ? requestDoc : new MatchRequest(requestDoc);

    const queueInfo = queueManager.getUserRequest(request.userId.toString());
    if (!queueInfo) {
      logger.warn(`estimateWaitTime: No queue info found for user ${request.userId}`);
      return { estimated: 300000, confidence: 'low' }; // Default 5 mins
    }

    const stats = queueManager.getStats();
    const avgWaitTime = stats.avgWaitTime > 0 ? stats.avgWaitTime : 60000;

    const gameId = queueInfo.gameId.toString();
    const gameMode = queueInfo.gameMode;
    const region = queueInfo.region;

    let queueSize = 0;
    if (
      stats.queueSizes &&
      stats.queueSizes[gameId] &&
      stats.queueSizes[gameId][gameMode] &&
      stats.queueSizes[gameId][gameMode][region]
    ) {
      queueSize = stats.queueSizes[gameId][gameMode][region];
    } else {
      logger.warn(`estimateWaitTime: Queue size not found for ${gameId}-${gameMode}-${region}`);
    }

    // Consider min group size, default to 2 if not specified in algorithm config
    const minGroupSizeForMatch = matchAlgorithmService.config.minGroupSize || 2;
    let estimatedTime = (queueSize / minGroupSizeForMatch) * avgWaitTime;

    // Cap estimated time to avoid excessively long estimates, e.g., 30 minutes
    estimatedTime = Math.min(estimatedTime, 30 * 60 * 1000);

    logger.debug('Estimated wait time', {
      userId: request.userId,
      gameId,
      gameMode,
      region,
      queueSize,
      avgWaitTime,
      estimatedTime
    });
    return {
      estimated: estimatedTime,
      confidence: queueSize > minGroupSizeForMatch * 2 ? 'medium' : 'low' // Adjusted confidence
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
