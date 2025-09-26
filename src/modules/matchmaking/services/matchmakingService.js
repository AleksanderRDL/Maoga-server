// src/modules/matchmaking/services/matchmakingService.js
const mongoose = require('mongoose');
const MatchRequest = require('../models/MatchRequest');
const MatchHistory = require('../models/MatchHistory');
const User = require('../../auth/models/User');
const Game = require('../../game/models/Game');
const queueManager = require('./queueManager');
const matchAlgorithmService = require('./matchAlgorithmService');
const lockManager = require('../../../services/redis/lockManager');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../utils/errors');
const logger = require('../../../utils/logger').forModule('matchmaking:service');
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
      if (!this.isProcessing) {
        return;
      }

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
    const runPersistence = async (session) => {
      const sessionOptions = session ? { session } : {};

      logger.debug(`Attempting to submit match request for userId: ${userId}`, { criteria });

      const existingRequestQuery = MatchRequest.findActiveByUser(userId);
      if (session) {
        existingRequestQuery.session(session);
      }
      const existingRequest = await existingRequestQuery;
      if (existingRequest) {
        logger.warn(
          `User ${userId} already has an active matchmaking request: ${existingRequest._id}`
        );
        throw new ConflictError('User already has an active matchmaking request');
      }

      const userQuery = User.findById(userId);
      if (session) {
        userQuery.session(session);
      }
      const user = await userQuery;
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
      const gameQuery = Game.find({ _id: { $in: gameIds } });
      if (session) {
        gameQuery.session(session);
      }
      const games = await gameQuery;
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
          regions: criteria.regions || user.gamingPreferences?.regions || ['ANY']
        }
      });

      await matchRequest.save(sessionOptions);
      logger.info('Match request saved to DB', { requestId: matchRequest._id, userId });
      return matchRequest;
    };

    const transactionsSupported = supportsTransactions();
    let session = null;
    let matchRequest;

    if (transactionsSupported) {
      session = await MatchRequest.startSession();
    }

    let usedTransactionFallback = false;

    try {
      if (session) {
        await session.withTransaction(async () => {
          matchRequest = await runPersistence(session);
        });
      } else {
        matchRequest = await runPersistence(null);
      }
    } catch (error) {
      if (error && error.code === 11000) {
        logger.warn('Duplicate active matchmaking request detected during submission', {
          userId,
          errorCode: error.code
        });
        throw new ConflictError('User already has an active matchmaking request');
      }

      if (session && isTransactionNotSupportedError(error)) {
        usedTransactionFallback = true;
        logger.warn(
          'MongoDB topology lacks transaction support; retrying match request persistence without session',
          {
            userId,
            errorMessage: error.message
          }
        );
        await session.endSession().catch(() => {});
        session = null;
        matchRequest = await runPersistence(null);
      } else {
        logger.error('Failed to persist match request transaction', {
          errorName: error.name,
          errorMessage: error.message,
          userId
        });
        throw error;
      }
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }

    if (usedTransactionFallback) {
      logger.debug(
        'Match request persisted without transaction due to unsupported MongoDB topology',
        {
          requestId: matchRequest?._id,
          userId
        }
      );
    }

    try {
      await queueManager.addRequest(matchRequest);
    } catch (error) {
      logger.error('Failed to add request to queue after DB persistence', {
        errorName: error.name,
        errorMessage: error.message,
        requestId: matchRequest?._id,
        userId
      });
      await MatchRequest.updateOne(
        { _id: matchRequest?._id, status: 'searching' },
        { status: 'cancelled' }
      );
      throw error;
    }

    logger.info('Match request submitted successfully', {
      requestId: matchRequest._id,
      userId,
      primaryGame: matchRequest.getPrimaryGame()?.gameId,
      gameMode: matchRequest.criteria.gameMode,
      transactionFallback: usedTransactionFallback
    });

    return matchRequest;
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

      const removed = await queueManager.removeRequest(userId, requestId);
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
        const gameQueue = await queueManager.getQueueRequests(
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

      const estimatedTimeResult = await this.estimateWaitTime(requestDoc); // Pass the Mongoose document

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
      const stats = await queueManager.getStats();
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
      const requests = await queueManager.getQueueRequests(gameId, gameMode, region);
      logger.debug(`Found ${requests.length} requests in queue ${gameId}-${gameMode}-${region}`);

      for (const requestData of requests) {
        const request =
          requestData instanceof MatchRequest ? requestData : new MatchRequest(requestData);
        const searchDuration =
          request.searchDuration === undefined
            ? Date.now() - new Date(request.searchStartTime).getTime()
            : request.searchDuration;
        const estimatedTimeResult = await this.estimateWaitTime(request); // Pass Mongoose doc or new instance
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
        await queueManager.updateStats(
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
    const matchId = matchData?.matchHistory?._id?.toString();
    if (!matchId) {
      throw new BadRequestError('Match history reference is required to finalize a match');
    }

    const lock = await lockManager.acquire(`match:${matchId}`, config.redis.lockTTL);
    if (!lock) {
      logger.warn('Match finalization already in progress', { matchId });
      const existingMatch = await MatchHistory.findById(matchId);
      if (existingMatch?.lobbyId) {
        return existingMatch;
      }
      throw new ConflictError('Match finalization already in progress');
    }

    const transactionsSupported = supportsTransactions();
    let session = null;
    let finalizationResult = null;
    let lobbyCreated = false;
    let lobby = null;
    let persistedMatchHistory = null;
    const participants = matchData.participants || [];
    let usedTransactionFallback = false;

    const runFinalization = async (sessionContext) => {
      const matchHistoryQuery = MatchHistory.findById(matchId);
      if (sessionContext) {
        matchHistoryQuery.session(sessionContext);
      }
      const matchHistory = await matchHistoryQuery.exec();
      if (!matchHistory) {
        throw new NotFoundError('Match history not found');
      }

      if (matchHistory.lobbyId) {
        return {
          lobbyCreated: false,
          lobby: null,
          matchHistory
        };
      }

      const lobbyService = require('../../lobby/services/lobbyService');
      const lobbyOptions = sessionContext ? { session: sessionContext } : {};
      const createdLobby = await lobbyService.createLobby(
        { ...matchData, matchHistory },
        lobbyOptions
      );

      return {
        lobbyCreated: true,
        lobby: createdLobby,
        matchHistory
      };
    };

    if (transactionsSupported) {
      session = await mongoose.startSession();
    }

    try {
      if (session) {
        try {
          await session.withTransaction(async () => {
            finalizationResult = await runFinalization(session);
          });
        } catch (error) {
          if (isTransactionNotSupportedError(error)) {
            usedTransactionFallback = true;
            logger.warn(
              'MongoDB topology lacks transaction support; retrying match finalization without session',
              {
                matchId,
                errorMessage: error.message
              }
            );
            await session.endSession().catch(() => {});
            session = null;
            finalizationResult = await runFinalization(null);
          } else {
            throw error;
          }
        }
      } else {
        finalizationResult = await runFinalization(null);
      }

      ({ lobbyCreated, lobby, matchHistory: persistedMatchHistory } = finalizationResult || {});

      const finalizedMatchHistory = (await MatchHistory.findById(matchId)) || persistedMatchHistory;

      if (!finalizedMatchHistory) {
        throw new NotFoundError('Match history missing after finalization');
      }

      if (!lobby && finalizedMatchHistory.lobbyId) {
        const lobbyService = require('../../lobby/services/lobbyService');
        lobby = await lobbyService.getLobbyById(finalizedMatchHistory.lobbyId.toString());
      }

      await Promise.all(
        participants.map((participant) =>
          queueManager.removeRequest(
            participant.user?._id?.toString() || participant.userId.toString(),
            participant.requestId.toString(),
            { silent: true }
          )
        )
      );

      if (lobbyCreated && lobby) {
        participants.forEach((participant) => {
          const participantId = participant.user?._id?.toString() || participant.userId.toString();
          const statusPayload = {
            status: 'matched',
            matchId: finalizedMatchHistory._id.toString(),
            lobbyId: lobby._id.toString(),
            participants: participants.map((p) => ({
              userId: p.user?._id?.toString() || p.userId.toString(),
              username: p.user?.username || 'Unknown'
            }))
          };

          socketManager.emitMatchmakingStatus(participant.requestId.toString(), statusPayload);
          socketManager.emitToUser(participantId, 'lobby:created', {
            lobbyId: lobby._id.toString()
          });
        });

        await Promise.all(
          participants.map((participant) =>
            notificationService.createNotification(participant.userId.toString(), {
              type: 'match_found',
              title: 'Match Found!',
              message: `You've been matched for ${finalizedMatchHistory.gameMode} game`,
              data: {
                entityType: 'lobby',
                entityId: lobby._id,
                actionUrl: `/lobbies/${lobby._id}`
              },
              priority: 'high'
            })
          )
        );

        await queueManager.updateStats(
          true,
          finalizedMatchHistory?.matchingMetrics?.totalSearchTime || 0
        );
      } else if (!lobbyCreated) {
        logger.info('Match already finalized; skipping duplicate notifications', { matchId });
      }

      logger.info('Match finalized with lobby created', {
        matchId: finalizedMatchHistory._id,
        lobbyId: lobby ? lobby._id : finalizedMatchHistory.lobbyId,
        participantCount: participants.length,
        freshFinalization: lobbyCreated,
        transactionFallback: usedTransactionFallback
      });

      return finalizedMatchHistory;
    } catch (error) {
      logger.error('Failed to finalize match', {
        errorName: error.name,
        errorMessage: error.message,
        matchId,
        transactionFallback: usedTransactionFallback
      });
      throw error;
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
      await lockManager.release(lock);
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
            await this.processSpecificQueue(
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

  async estimateWaitTime(requestDoc) {
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
      return { estimated: 300000, confidence: 'low' };
    }

    const queueInfo = await queueManager.getUserRequest(userIdString);

    if (!queueInfo) {
      logger.warn(`estimateWaitTime: No queue info found for user ${userIdString}`);
      return { estimated: 300000, confidence: 'low' };
    }

    const stats = await queueManager.getStats();
    const avgWaitTime = stats.avgWaitTime > 0 ? stats.avgWaitTime : 60000;

    const gameId = queueInfo.gameId.toString();
    const gameMode = queueInfo.gameMode;
    const region = queueInfo.region;

    const { size: queueSize, found: queueFound } = await queueManager.getQueueSize(
      gameId,
      gameMode,
      region
    );

    if (!queueFound) {
      logger.warn(
        `estimateWaitTime: Queue size not found for ${gameId}-${gameMode}-${region}. Request was for user: ${userIdString}`
      );
    }

    const minGroupSizeForMatch = matchAlgorithmService.config.minGroupSize || 2;
    let estimatedTime = avgWaitTime;

    if (queueSize > 0) {
      const playersNeeded = Math.max(0, minGroupSizeForMatch - queueSize);
      if (playersNeeded === 0) {
        estimatedTime = avgWaitTime / minGroupSizeForMatch;
      } else {
        estimatedTime = avgWaitTime * playersNeeded;
      }
    } else {
      estimatedTime = avgWaitTime * minGroupSizeForMatch;
    }

    estimatedTime = Math.min(estimatedTime, 30 * 60 * 1000);
    estimatedTime = Math.max(estimatedTime, 10000);

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
      const queueStats = await queueManager.getStats();
      const matchStats = await matchAlgorithmService.getMatchStatistics(options.timeRange);
      return { queues: queueStats, matches: matchStats, timestamp: new Date() };
    } catch (error) {
      logger.error('Failed to get matchmaking statistics', { error: error.message });
      throw error;
    }
  }
}

function supportsTransactions() {
  const conn = mongoose.connection;
  const topology = conn?.client?.topology;
  if (!conn || conn.readyState !== 1 || !topology) {
    return false;
  }

  if (typeof topology.hasSessionSupport === 'function') {
    return topology.hasSessionSupport();
  }

  return Boolean(conn.client?.s?.options?.replicaSet);
}

function isTransactionNotSupportedError(error) {
  if (!error) {
    return false;
  }
  if (error.code === 20) {
    return true;
  }
  const message = error.message || '';
  return message.includes('Transaction numbers are only allowed on a replica set');
}

module.exports = new MatchmakingService();
