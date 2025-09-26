const EventEmitter = require('events');
const config = require('../../../config');
const redisManager = require('../../../services/redis');
const logger = require('../../../utils/logger').forModule('matchmaking:queueManager');
const { ConflictError, BadRequestError } = require('../../../utils/errors');
const MatchRequest = require('../models/MatchRequest');

const DEFAULT_EXPIRY_MS = 10 * 60 * 1000;

class QueueManager extends EventEmitter {
  constructor() {
    super();

    this.redis = redisManager.getClient();
    this.redisReady = redisManager
      .connect()
      .then((client) => {
        this.redis = client;
        return client;
      })
      .catch((error) => {
        logger.error('Failed to initialise Redis client for queue manager', {
          error: error.message
        });
        throw error;
      });

    this.prefix = `${config.redis?.keyPrefix || 'maoga'}:matchmaking`;
    this.queueRegistryKey = `${this.prefix}:queues`;
    this.statsKey = `${this.prefix}:stats`;

    this._ensureStatsInitialized().catch((error) => {
      logger.error('Failed to initialize queue statistics', { error: error.message });
    });

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests().catch((error) => {
        logger.error('Failed to cleanup expired match requests', { error: error.message });
      });
    }, 30000);

    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  _queueKey(gameId, gameMode, region) {
    return `${this.prefix}:queue:${gameId}:${gameMode}:${region}`;
  }

  _requestKey(requestId) {
    return `${this.prefix}:request:${requestId}`;
  }

  _userKey(userId) {
    return `${this.prefix}:user:${userId}`;
  }

  async _getRedisClient() {
    if (this.redis) {
      return this.redis;
    }

    if (this.redisReady) {
      this.redis = await this.redisReady;
      return this.redis;
    }

    const client = await redisManager.connect();
    this.redis = client;
    this.redisReady = Promise.resolve(client);
    return client;
  }

  async _ensureStatsInitialized() {
    const client = await this._getRedisClient();
    await client.hsetnx(this.statsKey, 'totalRequests', 0);
    await client.hsetnx(this.statsKey, 'activeRequests', 0);
    await client.hsetnx(this.statsKey, 'matchesFormed', 0);
    await client.hsetnx(this.statsKey, 'totalWaitTime', 0);
  }

  async _releaseUserLock(client, userKey, requestId) {
    if (!client || !userKey || !requestId) {
      return;
    }

    try {
      const current = await client.get(userKey);
      if (current === requestId) {
        await client.del(userKey);
      }
    } catch (error) {
      logger.warn('Failed to release user matchmaking lock', { error: error.message });
    }
  }

  async addRequest(request) {
    if (!request) {
      throw new BadRequestError('Match request payload is required');
    }

    await this._ensureStatsInitialized();

    const userId = request.userId?.toString();
    if (!userId) {
      throw new BadRequestError('Match request missing user identifier');
    }

    const primaryGame = request.getPrimaryGame?.() || request.criteria?.games?.[0];
    if (!primaryGame || !primaryGame.gameId) {
      throw new BadRequestError('No primary game specified in match request criteria');
    }

    const gameMode = request.criteria?.gameMode;
    if (!gameMode) {
      throw new BadRequestError('Match request missing required game mode');
    }

    const region = request.criteria?.regions?.[0] || 'ANY';
    const gameId = primaryGame.gameId.toString();
    const requestId = request._id.toString();
    const queueKey = this._queueKey(gameId, gameMode, region);
    const userKey = this._userKey(userId);
    const requestKey = this._requestKey(requestId);
    const now = Date.now();
    const expiresAt = request.matchExpireTime
      ? new Date(request.matchExpireTime).getTime()
      : now + DEFAULT_EXPIRY_MS;

    const client = await this._getRedisClient();
    const existingRequestId = await client.get(userKey);

    if (existingRequestId && existingRequestId !== requestId) {
      logger.warn('Attempt to enqueue duplicate matchmaking request detected', {
        userId,
        existingRequestId,
        incomingRequestId: requestId
      });
      throw new ConflictError('User already has an active match request in queue');
    }

    const multi = client.multi();
    let setResultIndex = null;

    if (!existingRequestId) {
      setResultIndex = 0;
      multi.set(userKey, requestId, 'NX');
      multi.hincrby(this.statsKey, 'totalRequests', 1);
      multi.hincrby(this.statsKey, 'activeRequests', 1);
    }

    multi.hset(requestKey, {
      userId,
      requestId,
      gameId,
      gameMode,
      region,
      createdAt: now,
      expiresAt,
      status: request.status || 'searching'
    });
    multi.zadd(queueKey, now, requestId);
    multi.sadd(this.queueRegistryKey, queueKey);

    const results = await multi.exec();

    if (!existingRequestId) {
      // eslint-disable-next-line security/detect-object-injection
      const commandResult = results?.[setResultIndex]?.[1];
      if (commandResult !== 'OK') {
        await client
          .multi()
          .del(requestKey)
          .zrem(queueKey, requestId)
          .hincrby(this.statsKey, 'totalRequests', -1)
          .hincrby(this.statsKey, 'activeRequests', -1)
          .exec();

        const conflictingRequestId = await client.get(userKey);
        throw new ConflictError('User already has an active match request in queue', {
          userId,
          conflictingRequestId
        });
      }
    }

    logger.info('Match request added to distributed queue', {
      requestId,
      userId,
      gameId,
      gameMode,
      region
    });

    this.emit('requestAdded', { gameId, gameMode, region, requestId });
    return true;
  }

  async removeRequest(userId, requestId, options = {}) {
    if (!requestId) {
      return false;
    }

    await this._ensureStatsInitialized();

    const requestKey = this._requestKey(requestId);
    const client = await this._getRedisClient();
    const requestInfo = await client.hgetall(requestKey);

    if (!requestInfo || Object.keys(requestInfo).length === 0) {
      const storedUserId = userId?.toString();
      if (storedUserId) {
        const userKey = this._userKey(storedUserId);
        await this._releaseUserLock(client, userKey, requestId.toString());
      }
      return false;
    }

    const queueKey = this._queueKey(requestInfo.gameId, requestInfo.gameMode, requestInfo.region);
    const userKey = this._userKey(requestInfo.userId);

    const multi = client.multi();
    multi.zrem(queueKey, requestId);
    multi.del(requestKey);

    const removalResults = await multi.exec();
    await this._releaseUserLock(client, userKey, requestId.toString());

    const removedFromQueue = Number(removalResults?.[0]?.[1] || 0);
    if (removedFromQueue > 0) {
      await client.hincrby(this.statsKey, 'activeRequests', -1);
    }

    const remaining = await client.zcard(queueKey);
    if (remaining === 0) {
      await client.srem(this.queueRegistryKey, queueKey);
    }

    if (!options.silent) {
      logger.info('Match request removed from distributed queue', {
        requestId,
        userId: requestInfo.userId,
        gameId: requestInfo.gameId,
        gameMode: requestInfo.gameMode,
        region: requestInfo.region
      });
    }

    return removedFromQueue > 0;
  }

  async getQueueRequests(gameId, gameMode, region) {
    const client = await this._getRedisClient();
    const queueKey = this._queueKey(gameId, gameMode, region);
    const requestIds = await client.zrange(queueKey, 0, -1);

    if (!requestIds || requestIds.length === 0) {
      return [];
    }

    const requests = await MatchRequest.find({
      _id: { $in: requestIds },
      status: 'searching'
    });

    const requestMap = new Map();
    requests.forEach((doc) => {
      requestMap.set(doc._id.toString(), doc);
    });

    const ordered = [];
    const staleRequestIds = [];

    for (const id of requestIds) {
      const doc = requestMap.get(id);
      if (doc) {
        ordered.push(doc);
      } else {
        staleRequestIds.push(id);
      }
    }

    if (staleRequestIds.length > 0) {
      await Promise.all(
        staleRequestIds.map((staleId) => this.removeRequest(null, staleId, { silent: true }))
      );
    }

    return ordered;
  }

  async getQueueSize(gameId, gameMode, region) {
    const client = await this._getRedisClient();
    const queueKey = this._queueKey(gameId, gameMode, region);
    const size = await client.zcard(queueKey);
    return { size, found: size > 0 };
  }

  async getGameModeRequests(gameId, gameMode) {
    const client = await this._getRedisClient();
    const queueKeys = await client.smembers(this.queueRegistryKey);
    const modePrefix = `${this.prefix}:queue:${gameId}:${gameMode}:`;
    const matchingKeys = queueKeys.filter((key) => key.startsWith(modePrefix));

    if (matchingKeys.length === 0) {
      return [];
    }

    const requestIdSet = new Set();
    const regionMap = new Map();

    for (const key of matchingKeys) {
      const region = key.substring(modePrefix.length);
      const ids = await client.zrange(key, 0, -1);
      regionMap.set(region, ids);
      ids.forEach((id) => requestIdSet.add(id));
    }

    if (requestIdSet.size === 0) {
      return [];
    }

    const requestIds = Array.from(requestIdSet);
    const requests = await MatchRequest.find({
      _id: { $in: requestIds },
      status: 'searching'
    });

    const requestMap = new Map(requests.map((doc) => [doc._id.toString(), doc]));
    const results = [];

    for (const [region, ids] of regionMap.entries()) {
      for (const id of ids) {
        const doc = requestMap.get(id);
        if (doc) {
          const plain = doc.toObject({ virtuals: true });
          results.push({ ...plain, queueRegion: region });
        } else {
          await this.removeRequest(null, id, { silent: true });
        }
      }
    }

    return results;
  }

  async getUserRequest(userId) {
    if (!userId) {
      return null;
    }

    const client = await this._getRedisClient();
    const userKey = this._userKey(userId.toString());
    const requestId = await client.get(userKey);
    if (!requestId) {
      return null;
    }

    const requestInfo = await client.hgetall(this._requestKey(requestId));
    if (!requestInfo || Object.keys(requestInfo).length === 0) {
      return null;
    }

    return {
      ...requestInfo,
      requestId
    };
  }

  async getStats() {
    await this._ensureStatsInitialized();

    const client = await this._getRedisClient();
    const [statsHash, queueKeys] = await Promise.all([
      client.hgetall(this.statsKey),
      client.smembers(this.queueRegistryKey)
    ]);

    const queueSizes = new Map();

    for (const key of queueKeys) {
      const parts = key.split(':');
      const region = parts.pop();
      const gameMode = parts.pop();
      const gameId = parts.pop();

      const size = await client.zcard(key);

      if (!queueSizes.has(gameId)) {
        queueSizes.set(gameId, new Map());
      }
      const modeMap = queueSizes.get(gameId);
      if (!modeMap.has(gameMode)) {
        modeMap.set(gameMode, new Map());
      }
      modeMap.get(gameMode).set(region, size);
    }

    const stats = {
      totalRequests: Number(statsHash?.totalRequests || 0),
      activeRequests: Number(statsHash?.activeRequests || 0),
      matchesFormed: Number(statsHash?.matchesFormed || 0),
      avgWaitTime: 0,
      queueSizes: {}
    };

    const totalWaitTime = Number(statsHash?.totalWaitTime || 0);
    if (stats.matchesFormed > 0 && totalWaitTime > 0) {
      stats.avgWaitTime = totalWaitTime / stats.matchesFormed;
    }

    for (const [gameId, modeMap] of queueSizes.entries()) {
      const modeObj = {};
      for (const [mode, regionMap] of modeMap.entries()) {
        // eslint-disable-next-line security/detect-object-injection
        modeObj[mode] = Object.fromEntries(regionMap.entries());
      }
      // eslint-disable-next-line security/detect-object-injection
      stats.queueSizes[gameId] = modeObj;
    }

    stats.timestamp = new Date();
    return stats;
  }

  async updateStats(matchFormed = false, waitTime = 0) {
    if (!matchFormed && waitTime <= 0) {
      return;
    }

    const client = await this._getRedisClient();
    const multi = client.multi();
    if (matchFormed) {
      multi.hincrby(this.statsKey, 'matchesFormed', 1);
    }
    if (waitTime > 0) {
      multi.hincrbyfloat(this.statsKey, 'totalWaitTime', waitTime);
    }
    await multi.exec();
  }

  async cleanupExpiredRequests() {
    const now = Date.now();
    const client = await this._getRedisClient();
    const queueKeys = await client.smembers(this.queueRegistryKey);
    let cleaned = 0;

    for (const queueKey of queueKeys) {
      const requestIds = await client.zrange(queueKey, 0, -1);
      for (const requestId of requestIds) {
        const requestInfo = await client.hgetall(this._requestKey(requestId));
        if (!requestInfo || Object.keys(requestInfo).length === 0) {
          await this.removeRequest(null, requestId, { silent: true });
          continue;
        }

        const expiresAt = Number(requestInfo.expiresAt || 0);
        if (expiresAt && expiresAt <= now) {
          const removed = await this.removeRequest(requestInfo.userId, requestId, { silent: true });
          if (removed) {
            cleaned += 1;
          }
        }
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired or stale match requests from distributed queue', {
        count: cleaned
      });
    }
  }

  async clearQueues() {
    const client = await this._getRedisClient();
    const keys = await client.keys(`${this.prefix}:*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    await this._ensureStatsInitialized();
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = new QueueManager();
