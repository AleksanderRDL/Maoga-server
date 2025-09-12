// src/modules/matchmaking/services/matchmakingService.js
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
const notificationService = require('../../notification/services/notificationService');

class MatchmakingService {
  constructor() {
    this.isProcessing = false;
    this.processInterval = null;
    this.startProcessing();

    queueManager.on('requestAdded', ({ gameId, gameMode, region, requestId }) => {
      // Only auto-process queues when the matchmaking service is actively running.
      if (!this.isProcessing) {return;}

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

      queueManager.addRequest(matchRequest);
      // Initial status is now emitted by socketManager upon subscription

      logger.info('Match request submitted successfully', {
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
      });
      throw error;
    }
  }

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

      const removed = queueManager.removeRequest(userId, requestId);
      if (!removed) {
        logger.warn(
          'Request not found in queue manager, but DB record exists and is being cancelled',
          { requestId, userId }
        );
      }

      request.status = 'cancelled';
      await request.save();

      logger.info('Match request cancelled', {
        requestId,
        userId,
        searchDuration: request.searchDuration
      });
      // Notify client through socketManager
      socketManager.emitMatchmakingStatus(requestId.toString(), {
        status: 'cancelled',
        searchTime: request.searchDuration
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

  async getCurrentMatchRequest(userId) {
    try {
      // Fetch the full Mongoose document, do not use .lean() here
      // as methods like getPrimaryGame() and virtuals like searchDuration are needed.
      const requestDoc = await MatchRequest.findActiveByUser(userId)
        .populate('criteria.games.gameId', 'name slug')
        .populate('preselectedUsers', 'username profile.displayName');

      if (!requestDoc) {
        return null;
      }

      // Ensure requestDoc is a Mongoose document to use its methods/virtuals
      const primaryGame = requestDoc.getPrimaryGame(); // Relies on requestDoc being a Mongoose doc
      let potentialMatchesCount = 0;

      if (
        primaryGame &&
        primaryGame.gameId &&
        requestDoc.criteria.gameMode &&
        requestDoc.criteria.regions &&
        requestDoc.criteria.regions.length > 0
      ) {
        const gameQueue = queueManager.getQueueRequests(
          primaryGame.gameId.toString(),
          requestDoc.criteria.gameMode,
          requestDoc.criteria.regions[0] // Assuming the first region is the primary for queue lookup
        );
        potentialMatchesCount = gameQueue.length > 0 ? gameQueue.length - 1 : 0; // Exclude the user themselves
      } else {
        logger.warn(
          'Could not determine primary game, mode, or region for potential matches count',
          { requestId: requestDoc._id }
        );
      }

      const estimatedTimeResult = this.estimateWaitTime(requestDoc); // Pass the Mongoose document

      return {
        // Use .toJSON() for the final API response if a plain object is preferred
        request: requestDoc.toJSON(),
        queueInfo: {
          position: null, // Placeholder, implement if needed
          estimatedWaitTime: estimatedTimeResult.estimated,
          confidence: estimatedTimeResult.confidence,
          potentialMatches: potentialMatchesCount
        }
      };
    } catch (error) {
      logger.error('Failed to get current match request', {
        errorName: error.name,
        errorMessage: error.message,
        userId
        // stack: error.stack // Uncomment for deeper debugging
      });
      throw error; // Rethrow to be caught by controller and global error handler
    }
  }

  async getMatchHistory(userId, options = {}) {
    try {
      const { page = 1, limit = 20, gameId, status } = options;
      const skip = (page - 1) * limit;
      const query = { 'participants.userId': userId };
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
          .skip(skip)
          .lean(), // .lean() is okay here as we are just reading data for response
        MatchHistory.countDocuments(query)
      ]);
      return { matches, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    } catch (error) {
      logger.error('Failed to get match history', { error: error.message, userId });
      throw error;
    }
  }

  startProcessing() {
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

  stopProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    logger.info('Matchmaking processor stopped');
  }

  async processAllQueues() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    try {
      const stats = queueManager.getStats();
      for (const [gameId, gameQueues] of Object.entries(stats.queueSizes)) {
        for (const [gameMode, modeQueues] of Object.entries(gameQueues)) {
          for (const [region, queueSize] of Object.entries(modeQueues)) {
            if (queueSize >= (matchAlgorithmService.config.minGroupSize || 2)) {
              await this.processSpecificQueue(gameId, gameMode, region);
            }
          }
        }
      }
      await this.applyRelaxationToWaitingRequests();
    } catch (error) {
      logger.error('Failed to process queues', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async processSpecificQueue(gameId, gameMode, region) {
    logger.info(`Processing specific queue: Game ${gameId}, Mode ${gameMode}, Region ${region}`);
    try {
      const requests = queueManager.getQueueRequests(gameId, gameMode, region);
      logger.debug(`Found ${requests.length} requests in queue ${gameId}-${gameMode}-${region}`);

      for (const requestData of requests) {
        const request =
          requestData instanceof MatchRequest ? requestData : new MatchRequest(requestData);
        const searchDuration =
          request.searchDuration === undefined
            ? Date.now() - new Date(request.searchStartTime).getTime()
            : request.searchDuration;
        const estimatedTimeResult = this.estimateWaitTime(request); // Pass Mongoose doc or new instance
        const statusPayload = {
          status: 'searching',
          searchTime: searchDuration,
          potentialMatches: requests.length - 1, // Other users in the same specific queue
          estimatedTime: estimatedTimeResult ? estimatedTimeResult.estimated : 300000
        };
        logger.debug(
          `Emitting 'searching' status update for request ${request._id} in processSpecificQueue`,
          statusPayload
        );
        socketManager.emitMatchmakingStatus(request._id.toString(), statusPayload);
      }

      if (requests.length < (matchAlgorithmService.config.minGroupSize || 2)) {
        logger.info(
          `Not enough requests in queue ${gameId}-${gameMode}-${region} to form a match. Found ${requests.length}, need at least ${matchAlgorithmService.config.minGroupSize || 2}.`
        );
        return;
      }

      const enrichedRequests = await matchAlgorithmService.enrichRequests(
        requests.map((r) => (r instanceof MatchRequest ? r : new MatchRequest(r)))
      );
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
      });
    }
  }

  async finalizeMatch(matchData) {
    try {
      const { matchHistory, participants } = matchData;
      logger.info(`Finalizing match ${matchHistory._id} with ${participants.length} participants.`);

      // Create lobby using lobbyService
      const lobbyService = require('../../lobby/services/lobbyService');
      const lobby = await lobbyService.createLobby(matchData);

      // Update participants with lobby info
      participants.forEach((participant) => {
        const statusPayload = {
          status: 'matched',
          matchId: matchHistory._id.toString(),
          lobbyId: lobby._id.toString(),
          participants: participants.map((p) => ({
            userId: p.user?._id.toString() || p.userId.toString(),
            username: p.user?.username || 'Unknown'
          }))
        };

        logger.debug(
          `Emitting 'matched' status for participant ${participant.userId} (request: ${participant.requestId})`,
          statusPayload
        );

        socketManager.emitMatchmakingStatus(participant.requestId.toString(), statusPayload);

        // Auto-subscribe to lobby updates
        socketManager.emitToUser(
          participant.user?._id.toString() || participant.userId.toString(),
          'lobby:created',
          { lobbyId: lobby._id.toString() }
        );

        queueManager.removeRequest(
          participant.user?._id.toString() || participant.userId.toString(),
          participant.requestId.toString()
        );
      });

      logger.info('Match finalized with lobby created', {
        matchId: matchHistory._id,
        lobbyId: lobby._id,
        participantCount: participants.length
      });

      // Notify each participant that a match has been found.
      await Promise.all(
        participants.map((participant) =>
          notificationService.createNotification(participant.userId.toString(), {
            type: 'match_found',
            title: 'Match Found!',
            message: `You've been matched for ${matchHistory.gameMode} game`,
            data: {
              entityType: 'lobby',
              entityId: lobby._id,
              actionUrl: `/lobbies/${lobby._id}`
            },
            priority: 'high'
          })
        )
      );

      return matchHistory;
    } catch (error) {
      logger.error('Failed to finalize match', {
        errorName: error.name,
        errorMessage: error.message,
        matchId: matchData.matchHistory?._id
      });
      throw error;
    }
  }

  async applyRelaxationToWaitingRequests() {
    try {
      const waitingRequests = await MatchRequest.find({
        status: 'searching',
        searchStartTime: { $lte: new Date(Date.now() - 30000) }
      }).limit(50);

      for (const request of waitingRequests) {
        // request is a Mongoose document here
        const relaxed = await matchAlgorithmService.applyCriteriaRelaxation(request); // Pass the Mongoose document
        if (relaxed) {
          logger.debug('Relaxed criteria for request', {
            requestId: request._id,
            newRelaxationLevel: request.relaxationLevel
          });
          const primaryGame = request.getPrimaryGame(); // This will work
          if (primaryGame && primaryGame.gameId) {
            this.processSpecificQueue(
              primaryGame.gameId.toString(),
              request.criteria.gameMode,
              request.criteria.regions[0] || 'ANY'
            );
          }
        }
      }
    } catch (error) {
      logger.error('Failed to apply relaxation', { error: error.message });
    }
  }

  estimateWaitTime(requestDoc) {
    // requestDoc can be a Mongoose document or a plain object that MatchRequest can instantiate
    const request = requestDoc instanceof MatchRequest ? requestDoc : new MatchRequest(requestDoc);

    const userIdString = request.userId
      ? typeof request.userId.toString === 'function'
        ? request.userId.toString()
        : String(request.userId)
      : null;

    if (!userIdString) {
      logger.warn('estimateWaitTime: userId missing or invalid on request object.', {
        requestData: requestDoc
      });
      return { estimated: 300000, confidence: 'low' }; // Default 5 mins
    }

    const queueInfo = queueManager.getUserRequest(userIdString);

    if (!queueInfo) {
      logger.warn(`estimateWaitTime: No queue info found for user ${userIdString}`);
      return { estimated: 300000, confidence: 'low' };
    }

    const stats = queueManager.getStats();
    const avgWaitTime = stats.avgWaitTime > 0 ? stats.avgWaitTime : 60000; // Default 1 min if no avg

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
      logger.warn(
        `estimateWaitTime: Queue size not found for ${gameId}-${gameMode}-${region}. Request was for user: ${userIdString}`
      );
    }

    const minGroupSizeForMatch = matchAlgorithmService.config.minGroupSize || 2;
    let estimatedTime = avgWaitTime; // Base estimate

    if (queueSize > 0) {
      // Adjust based on current queue size relative to how many more are needed
      const playersNeeded = Math.max(0, minGroupSizeForMatch - queueSize);
      if (playersNeeded === 0) {
        // Enough players are in the queue
        estimatedTime = avgWaitTime / minGroupSizeForMatch; // Faster if queue is full or nearly full
      } else {
        estimatedTime = avgWaitTime * playersNeeded; // Slower if more players are needed
      }
    } else {
      // Queue is empty (or only self)
      estimatedTime = avgWaitTime * minGroupSizeForMatch;
    }

    estimatedTime = Math.min(estimatedTime, 30 * 60 * 1000); // Cap at 30 mins
    estimatedTime = Math.max(estimatedTime, 10000); // Minimum 10 seconds estimate

    logger.debug('Estimated wait time calculated', {
      userId: userIdString,
      gameId,
      gameMode,
      region,
      queueSize,
      avgWaitTime,
      estimatedTime
    });
    return {
      estimated: estimatedTime,
      confidence: queueSize >= minGroupSizeForMatch ? 'medium' : 'low'
    };
  }

  async getStatistics(options = {}) {
    try {
      const queueStats = queueManager.getStats();
      const matchStats = await matchAlgorithmService.getMatchStatistics(options.timeRange);
      return { queues: queueStats, matches: matchStats, timestamp: new Date() };
    } catch (error) {
      logger.error('Failed to get matchmaking statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = new MatchmakingService();
