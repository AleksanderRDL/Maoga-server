const NodeCache = require('node-cache');
const config = require('../../../config');
const logger = require('../../../utils/logger').forModule('game:cache');
const { escapeRegExp } = require('../../../utils/validation');

class CacheService {
  constructor() {
    // Initialize in-memory cache with default TTL of 5 minutes
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 60,
      useClones: false // For better performance
    });

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Log cache statistics periodically
    if (config.env === 'development') {
      setInterval(() => {
        const keys = this.cache.keys();
        const stats = this.cache.getStats();
        logger.debug('Cache statistics', {
          keys: keys.length,
          hits: stats.hits,
          misses: stats.misses,
          sets: stats.sets,
          hitRate: stats.hits / (stats.hits + stats.misses) || 0
        });
      }, 60000); // Every minute
    }
  }

  /**
   * Get value from cache
   */
  get(key) {
    try {
      const value = this.cache.get(key);

      if (value !== undefined) {
        this.stats.hits++;
        logger.debug('Cache hit', { key });
        return value;
      }

      this.stats.misses++;
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { error: error.message, key });
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  set(key, value, ttl = null) {
    try {
      const success = ttl ? this.cache.set(key, value, ttl) : this.cache.set(key, value);

      if (success) {
        this.stats.sets++;
        logger.debug('Cache set', { key, ttl });
      }

      return success;
    } catch (error) {
      logger.error('Cache set error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  del(key) {
    try {
      const count = this.cache.del(key);
      this.stats.deletes += count;
      logger.debug('Cache delete', { key, deleted: count });
      return count;
    } catch (error) {
      logger.error('Cache delete error', { error: error.message, key });
      return 0;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  deletePattern(pattern) {
    try {
      const keys = this.cache.keys();
      const sanitizedPattern = escapeRegExp(pattern);
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regex = new RegExp(sanitizedPattern);
      const matchingKeys = keys.filter((key) => regex.test(key));

      if (matchingKeys.length > 0) {
        const count = this.cache.del(matchingKeys);
        this.stats.deletes += count;
        logger.debug('Cache pattern delete', { pattern, deleted: count });
        return count;
      }

      return 0;
    } catch (error) {
      logger.error('Cache pattern delete error', { error: error.message, pattern });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const nodeStats = this.cache.getStats();
    return {
      ...this.stats,
      keys: this.cache.keys().length,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      nodeStats
    };
  }

  /**
   * Wrap a function with cache
   */
  wrap(fn, keyGenerator, ttl = 300) {
    return async (...args) => {
      const key = typeof keyGenerator === 'function' ? keyGenerator(...args) : keyGenerator;

      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fn(...args);
      await this.set(key, result, ttl);

      return result;
    };
  }
}

// Export singleton instance
module.exports = new CacheService();

