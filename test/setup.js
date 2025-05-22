const databaseManager = require('../src/config/database');
const logger = require('../src/utils/logger');

// Suppress logs during tests
logger.level = 'silent';

// Global test setup
before(async function() {
    this.timeout(10000);
    await databaseManager.connect();
});

// Global test teardown
after(async function() {
    this.timeout(10000);
    await databaseManager.disconnect();
});