const mongoose = require('mongoose');

const matchHistorySchema = new mongoose.Schema(
  {
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        requestId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MatchRequest'
        },
        joinedAt: {
          type: Date,
          default: Date.now
        },
        leftAt: Date,
        status: {
          type: String,
          enum: ['active', 'left', 'kicked', 'disconnected'],
          default: 'active'
        }
      }
    ],
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
      index: true
    },
    gameMode: {
      type: String,
      required: true
    },
    region: String,
    lobbyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lobby',
      index: true
    },
    matchQuality: {
      skillBalance: {
        type: Number,
        min: 0,
        max: 100
      },
      regionCompatibility: {
        type: Number,
        min: 0,
        max: 100
      },
      languageCompatibility: {
        type: Number,
        min: 0,
        max: 100
      },
      overallScore: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    matchingMetrics: {
      totalSearchTime: Number, // Average search time for all participants
      maxSearchTime: Number, // Longest wait time
      minSearchTime: Number, // Shortest wait time
      relaxationLevelsUsed: [Number] // Relaxation levels that were applied
    },
    status: {
      type: String,
      enum: ['forming', 'ready', 'in_progress', 'completed', 'cancelled'],
      default: 'forming'
    },
    formedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    startedAt: Date,
    completedAt: Date,
    feedback: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        rating: {
          type: Number,
          min: 1,
          max: 5
        },
        comment: String,
        submittedAt: Date
      }
    ]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes for analytics and queries
matchHistorySchema.index({ gameId: 1, formedAt: -1 });
matchHistorySchema.index({ 'participants.userId': 1, formedAt: -1 });
matchHistorySchema.index({ status: 1, formedAt: -1 });

// Virtual for match duration
matchHistorySchema.virtual('duration').get(function () {
  if (this.startedAt && this.completedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

// Instance method to add participant
matchHistorySchema.methods.addParticipant = function (userId, requestId) {
  const existing = this.participants.find((p) => p.userId.toString() === userId.toString());
  if (!existing) {
    this.participants.push({
      userId,
      requestId,
      joinedAt: new Date()
    });
  }
};

// Instance method to remove participant
matchHistorySchema.methods.removeParticipant = function (userId, reason = 'left') {
  const participant = this.participants.find((p) => p.userId.toString() === userId.toString());
  if (participant) {
    participant.status = reason;
    participant.leftAt = new Date();
  }
};

// Instance method to calculate match metrics
matchHistorySchema.methods.calculateMetrics = function (matchRequests) {
  if (!matchRequests || matchRequests.length === 0) {
    return;
  }

  const searchTimes = matchRequests.map((req) => req.searchDuration || 0);
  const relaxationLevels = matchRequests.map((req) => req.relaxationLevel || 0);

  this.matchingMetrics = {
    totalSearchTime: searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length,
    maxSearchTime: Math.max(...searchTimes),
    minSearchTime: Math.min(...searchTimes),
    relaxationLevelsUsed: [...new Set(relaxationLevels)]
  };
};

// Static method to get match statistics for a user
matchHistorySchema.statics.getUserMatchStats = async function (userId) {
  const matches = await this.find({
    'participants.userId': userId,
    status: { $in: ['completed', 'in_progress'] }
  });

  return {
    totalMatches: matches.length,
    averageMatchQuality:
      matches.reduce((sum, match) => sum + (match.matchQuality?.overallScore || 0), 0) /
        matches.length || 0,
    gamesPlayed: [...new Set(matches.map((m) => m.gameId.toString()))].length
  };
};

// Static method to get recent matches for analytics
matchHistorySchema.statics.getRecentMatches = async function (hours = 24, limit = 100) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.find({
    formedAt: { $gte: since }
  })
    .populate('gameId', 'name')
    .limit(limit)
    .sort({ formedAt: -1 });
};

const MatchHistory = mongoose.model('MatchHistory', matchHistorySchema);

module.exports = MatchHistory;
