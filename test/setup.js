const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let databaseManager;
let redisManager;
let logger;

process.env.NODE_ENV = 'test';
process.env.USE_REDIS_MOCK = 'true';

exports.mochaHooks = {
  beforeAll: async function () {
    this.timeout(60000);

    try {
      const mongoVersion = process.env.MONGOMS_VERSION || '7.0.14';
      process.env.MONGOMS_VERSION = mongoVersion;
      process.env.MONGOMS_DISTRO = process.env.MONGOMS_DISTRO || 'ubuntu2004';
      mongoServer = await MongoMemoryServer.create({
        binary: { version: mongoVersion }
      });
      process.env.MONGODB_TEST_URI = mongoServer.getUri();

      databaseManager = require('../src/config/database');
      redisManager = require('../src/services/redis');
      ({ logger } = require('../src/utils'));
      logger.level = 'silent';

      await databaseManager.connect();
      await redisManager.connect();
    } catch (err) {
      console.warn('MongoMemoryServer failed to start, skipping tests.', err.message);
      this.skip();
    }
  },

  afterAll: async function () {
    this.timeout(60000);

    try {
      if (databaseManager) {
        await databaseManager.disconnect();
      }
      if (redisManager) {
        await redisManager.disconnect();
      }
    } catch (err) {
      // ignore errors during shutdown
    }

    if (mongoServer) {
      await mongoServer.stop();
    }
  }
};
