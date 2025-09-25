const gameService = require('../modules/game/services/gameService');
const logger = require('../utils/logger').forModule('jobs:gameSync');
const config = require('../config');

class GameSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.syncInterval = config.jobs?.gameSyncInterval || 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Run the game sync job
   */
  async run(limit = 2000) {
    if (this.isRunning) {
      logger.warn('Game sync job already running, skipping');
      return;
    }

    try {
      this.isRunning = true;
      const startTime = Date.now();

      logger.info('Starting game sync job', {
        limit,
        lastRun: this.lastRun
      });

      const result = await gameService.syncPopularGames(limit);

      const duration = Date.now() - startTime;
      this.lastRun = new Date();

      logger.info('Game sync job completed', {
        ...result,
        duration,
        durationMinutes: Math.round(duration / 60000)
      });

      return result;
    } catch (error) {
      logger.error('Game sync job failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Schedule periodic sync
   */
  schedule() {
    // Run initial sync after a delay to allow server startup
    setTimeout(() => {
      this.run().catch((error) => {
        logger.error('Initial game sync failed', { error: error.message });
      });
    }, 60000); // 1 minute after startup

    // Schedule periodic syncs
    setInterval(() => {
      this.run().catch((error) => {
        logger.error('Scheduled game sync failed', { error: error.message });
      });
    }, this.syncInterval);

    logger.info('Game sync job scheduled', {
      interval: this.syncInterval,
      intervalHours: this.syncInterval / (60 * 60 * 1000)
    });
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.lastRun ? new Date(this.lastRun.getTime() + this.syncInterval) : null
    };
  }
}

module.exports = new GameSyncJob();

