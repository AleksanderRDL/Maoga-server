const databaseManager = require('../src/config/database');
const { logger } = require('../src/utils');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Suppress logs during tests
logger.level = 'silent';

// Ensure we're using test environment
process.env.NODE_ENV = 'test';

// Global test setup
before(async function () {
    // Starting the in-memory MongoDB server may require downloading binaries
    // which can take some time on first run. Increase timeout accordingly.
    this.timeout(60000);

    mongoServer = await MongoMemoryServer.create({
        binary: { version: '7.0.3' }
    });
    process.env.MONGODB_URI = mongoServer.getUri();

    await databaseManager.connect();
});

// Global test teardown
after(async function () {
    this.timeout(60000);
    await databaseManager.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
});
