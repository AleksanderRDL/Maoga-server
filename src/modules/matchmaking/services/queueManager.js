const EventEmitter = require('events');
const logger = require('../../../utils/logger');
const { ConflictError, BadRequestError } = require('../../../utils/errors'); // Added BadRequestError

class QueueManager extends EventEmitter {
  constructor() {
    super();

    // Main queue structure: gameId -> gameMode -> region -> [requests]
    this.queues = new Map();

    // User to request mapping for quick lookups
    this.userRequestMap = new Map();

    // Queue statistics
    this.stats = {
      totalRequests: 0,
      activeRequests: 0,
      matchesFormed: 0,
      avgWaitTime: 0
    };

    // Cleanup expired requests periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests();
    }, 30000); // Every 30 seconds
  }

  /**
   * Clear all queues (for testing)
   */
  clearQueues() {
    this.queues.clear();
    this.userRequestMap.clear();
    this.stats.activeRequests = 0;
    this.stats.totalRequests = 0; // Reset for cleaner tests
    this.stats.matchesFormed = 0; // Reset for cleaner tests
    this.stats.avgWaitTime = 0; // Reset for cleaner tests
  }

  /**
   * Add a match request to the appropriate queue
   */
  addRequest(request) {
    try {
      // Check if user already has an active request
      if (this.userRequestMap.has(request.userId.toString())) {
        // Changed from generic Error to ConflictError
        throw new ConflictError('User already has an active match request in queue');
      }

      const primaryGame = request.getPrimaryGame();
      if (!primaryGame) {
        // Changed from generic Error to BadRequestError
        throw new BadRequestError('No primary game specified in match request criteria');
      }

      const gameId = primaryGame.gameId.toString();
      const gameMode = request.criteria.gameMode;
      const primaryRegion = request.criteria.regions[0] || 'ANY';

      // Initialize queue structure if needed
      if (!this.queues.has(gameId)) {
        this.queues.set(gameId, new Map());
      }

      const gameQueues = this.queues.get(gameId);
      if (!gameQueues.has(gameMode)) {
        gameQueues.set(gameMode, new Map());
      }

      const modeQueues = gameQueues.get(gameMode);
      if (!modeQueues.has(primaryRegion)) {
        modeQueues.set(primaryRegion, []);
      }

      // Add to queue
      const queue = modeQueues.get(primaryRegion);
      queue.push(request);

      // Update user mapping
      this.userRequestMap.set(request.userId.toString(), {
        requestId: request._id.toString(),
        gameId,
        gameMode,
        region: primaryRegion
      });

      // Update stats
      this.stats.totalRequests++;
      this.stats.activeRequests++;

      logger.info('Match request added to queue', {
        requestId: request._id,
        userId: request.userId,
        gameId,
        gameMode,
        region: primaryRegion,
        queueSize: queue.length
      });

      // Emit event for potential immediate matching
      this.emit('requestAdded', { gameId, gameMode, region: primaryRegion });

      return true;
    } catch (error) {
      logger.error('Failed to add request to queue', {
        error: error.message,
        requestId: request._id
      });
      throw error;
    }
  }

  /**
   * Remove a match request from queue
   */
  removeRequest(userId, requestId) {
    try {
      const userIdStr = userId.toString();
      const requestInfo = this.userRequestMap.get(userIdStr);

      if (!requestInfo || requestInfo.requestId !== requestId.toString()) {
        return false;
      }

      const { gameId, gameMode, region } = requestInfo;

      // Remove from queue
      const queue = this.queues.get(gameId)?.get(gameMode)?.get(region);
      if (queue) {
        const index = queue.findIndex((req) => req._id.toString() === requestId.toString());
        if (index !== -1) {
          queue.splice(index, 1);

          // Clean up empty structures
          this.cleanupEmptyQueues(gameId, gameMode, region);
        }
      }

      // Remove from user mapping
      this.userRequestMap.delete(userIdStr);

      // Update stats
      this.stats.activeRequests--;

      logger.info('Match request removed from queue', {
        requestId,
        userId,
        gameId,
        gameMode,
        region
      });

      return true;
    } catch (error) {
      logger.error('Failed to remove request from queue', {
        error: error.message,
        userId,
        requestId
      });
      return false;
    }
  }

  /**
   * Get all requests for a specific queue
   */
  getQueueRequests(gameId, gameMode, region) {
    return this.queues.get(gameId.toString())?.get(gameMode)?.get(region) || [];
  }

  /**
   * Get all requests across regions for a game mode
   */
  getGameModeRequests(gameId, gameMode) {
    const gameQueues = this.queues.get(gameId.toString());
    if (!gameQueues) {
      return [];
    }

    const modeQueues = gameQueues.get(gameMode);
    if (!modeQueues) {
      return [];
    }

    const allRequests = [];
    for (const [region, queue] of modeQueues) {
      allRequests.push(...queue.map((req) => ({ ...req.toObject(), queueRegion: region })));
    }

    return allRequests;
  }

  /**
   * Get user's active request info
   */
  getUserRequest(userId) {
    return this.userRequestMap.get(userId.toString());
  }

  /**
   * Update queue statistics
   */
  updateStats(matchFormed = false, waitTime = 0) {
    if (matchFormed) {
      this.stats.matchesFormed++;
    }

    if (waitTime > 0) {
      // Update average wait time (simple moving average)
      const totalWaitTime = this.stats.avgWaitTime * this.stats.matchesFormed;
      this.stats.avgWaitTime = (totalWaitTime + waitTime) / (this.stats.matchesFormed + 1);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const queueSizes = {};

    for (const [gameId, gameQueues] of this.queues) {
      queueSizes[gameId] = {};
      for (const [gameMode, modeQueues] of gameQueues) {
        queueSizes[gameId][gameMode] = {};
        for (const [region, queue] of modeQueues) {
          queueSizes[gameId][gameMode][region] = queue.length;
        }
      }
    }

    return {
      ...this.stats,
      queueSizes,
      timestamp: new Date()
    };
  }

  /**
   * Clean up expired requests
   */
  cleanupExpiredRequests() {
    let cleaned = 0;

    for (const [gameId, gameQueues] of this.queues) {
      for (const [gameMode, modeQueues] of gameQueues) {
        for (const [region, queue] of modeQueues) {
          const validRequests = queue.filter((request) => {
            if (request.isExpired()) {
              this.userRequestMap.delete(request.userId.toString());
              cleaned++;
              return false;
            }
            return true;
          });

          if (validRequests.length !== queue.length) {
            modeQueues.set(region, validRequests);
          }
        }
      }
    }

    if (cleaned > 0) {
      this.stats.activeRequests -= cleaned;
      logger.info('Cleaned up expired match requests', { count: cleaned });
    }
  }

  /**
   * Clean up empty queue structures
   */
  cleanupEmptyQueues(gameId, gameMode, region) {
    const gameQueues = this.queues.get(gameId);
    if (!gameQueues) {
      return;
    }

    const modeQueues = gameQueues.get(gameMode);
    if (!modeQueues) {
      return;
    }

    const queue = modeQueues.get(region);
    if (!queue || queue.length === 0) {
      modeQueues.delete(region);
    }

    if (modeQueues.size === 0) {
      gameQueues.delete(gameMode);
    }

    if (gameQueues.size === 0) {
      this.queues.delete(gameId);
    }
  }

  /**
   * Destroy queue manager
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
    this.clearQueues();
  }
}

// Export singleton instance
module.exports = new QueueManager();
