const { testUsers } = require('./users');
const { testGames, mockIGDBGames } = require('./games');
const {
  testMatchRequests,
  testMatchHistories,
  mockMatchmakingScenarios
} = require('./matchmaking');

module.exports = {
  testUsers,
  testGames,
  mockIGDBGames,
  testMatchRequests,
  testMatchHistories,
  mockMatchmakingScenarios
};
