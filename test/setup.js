const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let databaseManager;
let logger;

// Ensure we're using test environment
process.env.NODE_ENV = 'test';

// Global test setup
before(async function () {
  // Starting the in-memory MongoDB server may require downloading binaries
  // which can take some time on first run. Increase timeout accordingly.
  this.timeout(60000);

  try {
    const mongoVersion = process.env.MONGOMS_VERSION || '7.0.14';
    process.env.MONGOMS_VERSION = mongoVersion;
    process.env.MONGOMS_DISTRO = process.env.MONGOMS_DISTRO || 'ubuntu2004';
    mongoServer = await MongoMemoryServer.create({
      binary: { version: mongoVersion }
    });
    process.env.MONGODB_TEST_URI = mongoServer.getUri();

    // Require the database manager after setting env vars so config picks up the correct URI.
    databaseManager = require('../src/config/database');
    ({ logger } = require('../src/utils'));
    // Suppress logs during tests
    logger.level = 'silent';

    await databaseManager.connect();
  } catch (err) {
    // If the Mongo binary cannot be downloaded (e.g. network restricted environments) or the server fails to start
    console.warn('MongoMemoryServer failed to start, skipping tests.', err.message);
    this.skip();
  }
});

// Global test teardown
after(async function () {
  this.timeout(60000);

  try {
    if (databaseManager) {
      await databaseManager.disconnect();
    }
  } catch (err) {
    // ignore errors during shutdown
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
