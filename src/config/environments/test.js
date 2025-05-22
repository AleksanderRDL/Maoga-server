module.exports = {
  database: {
    uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/maoga_test'
  },
  logging: {
    level: 'error' // Only log errors during tests
  }
};
