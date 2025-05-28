const mongoose = require('mongoose');

const testMatchRequests = [
  {
    userId: new mongoose.Types.ObjectId(),
    status: 'searching',
    criteria: {
      games: [
        {
          gameId: new mongoose.Types.ObjectId(),
          weight: 10
        }
      ],
      gameMode: 'competitive',
      groupSize: { min: 2, max: 5 },
      regionPreference: 'preferred',
      regions: ['NA', 'EU'],
      languagePreference: 'any',
      languages: ['en'],
      skillPreference: 'similar'
    },
    searchStartTime: new Date(Date.now() - 30000), // 30 seconds ago
    relaxationLevel: 0
  },
  {
    userId: new mongoose.Types.ObjectId(),
    status: 'searching',
    criteria: {
      games: [
        {
          gameId: new mongoose.Types.ObjectId(),
          weight: 8
        },
        {
          gameId: new mongoose.Types.ObjectId(),
          weight: 5
        }
      ],
      gameMode: 'casual',
      groupSize: { min: 1, max: 10 },
      regionPreference: 'any',
      regions: ['NA'],
      languagePreference: 'preferred',
      languages: ['en', 'es'],
      skillPreference: 'any'
    },
    searchStartTime: new Date(Date.now() - 120000), // 2 minutes ago
    relaxationLevel: 2
  }
];

const testMatchHistories = [
  {
    participants: [
      { userId: new mongoose.Types.ObjectId(), status: 'active' },
      { userId: new mongoose.Types.ObjectId(), status: 'active' }
    ],
    gameId: new mongoose.Types.ObjectId(),
    gameMode: 'competitive',
    region: 'NA',
    matchQuality: {
      skillBalance: 85,
      regionCompatibility: 100,
      languageCompatibility: 100,
      overallScore: 95
    },
    matchingMetrics: {
      totalSearchTime: 45000,
      maxSearchTime: 60000,
      minSearchTime: 30000,
      relaxationLevelsUsed: [0, 1]
    },
    status: 'completed',
    formedAt: new Date(Date.now() - 3600000), // 1 hour ago
    startedAt: new Date(Date.now() - 3300000),
    completedAt: new Date(Date.now() - 600000) // 10 minutes ago
  }
];

const mockMatchmakingScenarios = {
  // Scenario 1: Perfect match - same game, mode, region, similar skill
  perfectMatch: {
    users: [
      {
        userId: new mongoose.Types.ObjectId(),
        gameProfiles: [
          {
            gameId: '507f1f77bcf86cd799439011',
            skillLevel: 50,
            rank: 'Gold'
          }
        ],
        criteria: {
          games: [{ gameId: '507f1f77bcf86cd799439011', weight: 10 }],
          gameMode: 'competitive',
          regions: ['NA'],
          skillPreference: 'similar',
          languagePreference: 'any' // Added for better language score
        }
      },
      {
        userId: new mongoose.Types.ObjectId(),
        gameProfiles: [
          {
            gameId: '507f1f77bcf86cd799439011',
            skillLevel: 52, // Skill diff is 2
            rank: 'Gold'
          }
        ],
        criteria: {
          games: [{ gameId: '507f1f77bcf86cd799439011', weight: 10 }],
          gameMode: 'competitive',
          regions: ['NA'],
          skillPreference: 'similar',
          languagePreference: 'any' // Added for better language score
        }
      }
    ],
    expectedScore: 0.9 // Adjusted expected score based on skill and lang fixes
  },

  // Scenario 2: Partial match - same game and mode, different regions but flexible
  partialMatch: {
    users: [
      {
        userId: new mongoose.Types.ObjectId(),
        criteria: {
          games: [{ gameId: '507f1f77bcf86cd799439011', weight: 10 }],
          gameMode: 'casual',
          regions: ['NA'],
          regionPreference: 'preferred',
          skillPreference: 'any',
          languagePreference: 'any'
        }
      },
      {
        userId: new mongoose.Types.ObjectId(),
        criteria: {
          games: [{ gameId: '507f1f77bcf86cd799439011', weight: 10 }],
          gameMode: 'casual',
          regions: ['EU'],
          regionPreference: 'any',
          skillPreference: 'any',
          languagePreference: 'any'
        }
      }
    ],
    // Game=1 (0.3), Mode=1 (0.2), Region=0.25 (0.05), Lang=1 (0.1), Skill=0.5 (0.1) -> 0.3+0.2+0.05+0.1+0.1 = 0.75
    expectedScore: 0.75
  },

  // Scenario 3: No match - different game modes
  noMatch: {
    users: [
      {
        userId: new mongoose.Types.ObjectId(),
        criteria: {
          games: [{ gameId: '507f1f77bcf86cd799439011', weight: 10 }],
          gameMode: 'competitive',
          regions: ['NA'],
          languagePreference: 'any'
        }
      },
      {
        userId: new mongoose.Types.ObjectId(),
        criteria: {
          games: [{ gameId: '507f1f77bcf86cd799439011', weight: 10 }],
          gameMode: 'casual',
          regions: ['NA'],
          languagePreference: 'any'
        }
      }
    ],
    expectedScore: 0
  }
};

module.exports = {
  testMatchRequests,
  testMatchHistories,
  mockMatchmakingScenarios
};
