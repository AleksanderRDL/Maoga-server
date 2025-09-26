const { randomUUID } = require('crypto');
const config = require('../../config');
const redisManager = require('./index');
const logger = require('../../utils/logger').forModule('redis:locks');

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

class RedisLockManager {
  constructor() {
    this.namespace = `${config.redis?.keyPrefix || 'maoga'}:locks`;
    this.defaultTtl = config.redis?.lockTTL || 5000;
  }

  async acquire(lockId, ttl = this.defaultTtl) {
    const token = randomUUID();
    const key = `${this.namespace}:${lockId}`;
    const client = redisManager.getClient();

    if (!client) {
      throw new Error('Redis client is not available for lock acquisition');
    }

    const result = await client.set(key, token, 'NX', 'PX', ttl);
    if (result !== 'OK') {
      return null;
    }

    return { key, token, ttl, createdAt: Date.now() };
  }

  async release(lock) {
    if (!lock) {
      return false;
    }

    try {
      const client = redisManager.getClient();
      if (!client) {
        return false;
      }

      const result = await client.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
      return result === 1;
    } catch (error) {
      logger.error('Failed to release distributed lock', { error: error.message });
      return false;
    }
  }

  async withLock(lockId, ttl, handler) {
    const lock = await this.acquire(lockId, ttl);
    if (!lock) {
      return null;
    }

    try {
      return await handler(lock);
    } finally {
      await this.release(lock);
    }
  }
}

module.exports = new RedisLockManager();
