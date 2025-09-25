const logger = require('../utils/logger').forModule('jobs:notificationQueue');
const notificationService = require('../modules/notification/services/notificationService');

class NotificationQueue {
  constructor() {
    this.queues = {
      push: [],
      email: []
    };
    this.processing = {
      push: false,
      email: false
    };
    this.intervals = {
      push: null,
      email: null
    };
  }

  /**
   * Start queue processing
   */
  start() {
    // Process push notifications every 5 seconds
    this.intervals.push = setInterval(() => {
      this.processPushQueue();
    }, 5000);

    // Process email notifications every 10 seconds
    this.intervals.email = setInterval(() => {
      this.processEmailQueue();
    }, 10000);

    logger.info('Notification queues started');
  }

  /**
   * Stop queue processing
   */
  stop() {
    if (this.intervals.push) {
      clearInterval(this.intervals.push);
    }
    if (this.intervals.email) {
      clearInterval(this.intervals.email);
    }

    logger.info('Notification queues stopped');
  }

  /**
   * Add job to queue
   */
  async addJob(type, data) {
    if (!this.queues[type]) {
      throw new Error(`Invalid queue type: ${type}`);
    }

    await this.queues[type].push({
      id: `${type}_${Date.now()}_${Math.random()}`,
      data,
      createdAt: new Date(),
      attempts: 0
    });

    logger.debug('Job added to notification queue', {
      type,
      jobData: data
    });
  }

  /**
   * Process push notification queue
   */
  async processPushQueue() {
    if (this.processing.push || this.queues.push.length === 0) {
      return;
    }

    this.processing.push = true;

    try {
      const batchSize = 10;
      const jobs = this.queues.push.splice(0, batchSize);

      for (const job of jobs) {
        try {
          await notificationService.processPushNotification(job.data.notificationId);

          logger.debug('Push notification job completed', {
            jobId: job.id,
            notificationId: job.data.notificationId
          });
        } catch (error) {
          job.attempts++;

          if (job.attempts < 3) {
            // Re-queue for retry
            this.queues.push.push(job);
            logger.warn('Push notification job failed, will retry', {
              jobId: job.id,
              attempts: job.attempts,
              error: error.message
            });
          } else {
            logger.error('Push notification job failed after max attempts', {
              jobId: job.id,
              attempts: job.attempts,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process push queue', {
        error: error.message
      });
    } finally {
      this.processing.push = false;
    }
  }

  /**
   * Process email notification queue
   */
  async processEmailQueue() {
    if (this.processing.email || this.queues.email.length === 0) {
      return;
    }

    this.processing.email = true;

    try {
      const batchSize = 5;
      const jobs = this.queues.email.splice(0, batchSize);

      for (const job of jobs) {
        try {
          await notificationService.processEmailNotification(job.data.notificationId);

          logger.debug('Email notification job completed', {
            jobId: job.id,
            notificationId: job.data.notificationId
          });
        } catch (error) {
          job.attempts++;

          if (job.attempts < 3) {
            // Re-queue for retry with exponential backoff
            setTimeout(
              () => {
                this.queues.email.push(job);
              },
              Math.pow(2, job.attempts) * 1000
            );

            logger.warn('Email notification job failed, will retry', {
              jobId: job.id,
              attempts: job.attempts,
              error: error.message
            });
          } else {
            logger.error('Email notification job failed after max attempts', {
              jobId: job.id,
              attempts: job.attempts,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process email queue', {
        error: error.message
      });
    } finally {
      this.processing.email = false;
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      push: {
        pending: this.queues.push.length,
        processing: this.processing.push
      },
      email: {
        pending: this.queues.email.length,
        processing: this.processing.email
      }
    };
  }
}

module.exports = new NotificationQueue();

