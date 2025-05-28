const mongoose = require('mongoose');

const matchRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['searching', 'cancelled', 'matched', 'expired'],
      default: 'searching',
      required: true,
      index: true
    },
    criteria: {
      games: [
        {
          gameId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Game',
            required: true
          },
          weight: {
            type: Number,
            min: 1,
            max: 10,
            default: 5
          }
        }
      ],
      gameMode: {
        type: String,
        enum: ['casual', 'competitive', 'ranked', 'custom'],
        required: true
      },
      groupSize: {
        min: {
          type: Number,
          min: 1,
          default: 1
        },
        max: {
          type: Number,
          max: 100,
          default: 10
        }
      },
      regionPreference: {
        type: String,
        enum: ['strict', 'preferred', 'any'],
        default: 'preferred'
      },
      regions: [
        {
          type: String,
          enum: ['NA', 'EU', 'AS', 'SA', 'OC', 'AF', 'ANY']
        }
      ],
      languagePreference: {
        type: String,
        enum: ['strict', 'preferred', 'any'],
        default: 'any'
      },
      languages: [String],
      skillPreference: {
        type: String,
        enum: ['similar', 'any'],
        default: 'similar'
      },
      scheduledTime: Date
    },
    preselectedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    searchStartTime: {
      type: Date,
      default: Date.now
    },
    matchExpireTime: Date,
    relaxationLevel: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    relaxationTimestamp: Date,
    matchedLobbyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lobby'
    },
    matchAttempts: {
      type: Number,
      default: 0
    },
    lastProcessedAt: Date
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

// Indexes for efficient querying
matchRequestSchema.index({ status: 1, 'criteria.games.gameId': 1 });
matchRequestSchema.index({ status: 1, searchStartTime: 1 });
matchRequestSchema.index({ userId: 1, status: 1 });
matchRequestSchema.index({ 'criteria.scheduledTime': 1 }, { sparse: true });

// Virtual for search duration
matchRequestSchema.virtual('searchDuration').get(function () {
  if (this.status === 'searching' && this.searchStartTime) {
    return Date.now() - this.searchStartTime.getTime();
  }
  return 0;
});

// Instance method to check if request is expired
matchRequestSchema.methods.isExpired = function () {
  if (this.matchExpireTime && new Date() > this.matchExpireTime) {
    return true;
  }
  // Default expiry after 10 minutes
  const defaultExpiry = 10 * 60 * 1000;
  return this.searchDuration > defaultExpiry;
};

// Instance method to get primary game
matchRequestSchema.methods.getPrimaryGame = function () {
  if (!this.criteria.games || this.criteria.games.length === 0) {
    return null;
  }
  // Return game with highest weight
  return this.criteria.games.reduce((prev, current) =>
    prev.weight > current.weight ? prev : current
  );
};

// Static method to find active requests for a user
matchRequestSchema.statics.findActiveByUser = function (userId) {
  return this.findOne({
    userId,
    status: 'searching'
  });
};

// Static method to find requests for matching
matchRequestSchema.statics.findMatchableRequests = function (
  gameId,
  gameMode,
  region,
  limit = 100
) {
  return this.find({
    status: 'searching',
    'criteria.games.gameId': gameId,
    'criteria.gameMode': gameMode,
    'criteria.regions': region
  })
    .populate('userId', 'username profile.displayName gameProfiles')
    .limit(limit)
    .sort({ searchStartTime: 1 }); // Oldest first (FIFO)
};

const MatchRequest = mongoose.model('MatchRequest', matchRequestSchema);

module.exports = MatchRequest;
