const databaseManager = require('../src/config/database');
const logger = require('../src/utils/logger');

// Suppress logs during tests
logger.level = 'silent';

// Ensure we're using test database
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/maoga_test';

// Global test setup
before(async function () {
  this.timeout(10000);
  await databaseManager.connect();
});

// Global test teardown
after(async function () {
  this.timeout(10000);
  await databaseManager.disconnect();
});
