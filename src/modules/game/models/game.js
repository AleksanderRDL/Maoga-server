const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, 'Game name is required'],
      trim: true,
      index: true
    },
    slug: {
      type: String,
      required: [true, 'Game slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    summary: {
      type: String,
      maxlength: [1000, 'Summary cannot exceed 1000 characters']
    },

    // Media
    coverImage: {
      url: String,
      thumbnailUrl: String
    },
    screenshots: [
      {
        url: String,
        thumbnailUrl: String
      }
    ],
    videos: [
      {
        name: String,
        videoId: String, // YouTube/external video ID
        thumbnailUrl: String
      }
    ],

    // Categorization
    genres: [
      {
        id: Number,
        name: String
      }
    ],
    platforms: [
      {
        id: Number,
        name: String,
        abbreviation: String
      }
    ],
    gameModes: [
      {
        id: Number,
        name: String
      }
    ],
    themes: [
      {
        id: Number,
        name: String
      }
    ],

    // Metadata
    releaseDate: Date,
    firstReleaseDate: Date,
    rating: {
      type: Number,
      min: 0,
      max: 100
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    popularity: {
      type: Number,
      default: 0,
      index: true
    },

    // External References
    externalIds: {
      igdb: {
        type: Number,
        unique: true,
        sparse: true,
        index: true
      },
      steam: String,
      epic: String,
      gog: String
    },

    // Multiplayer Info
    multiplayer: {
      online: {
        type: Boolean,
        default: false
      },
      offline: {
        type: Boolean,
        default: false
      },
      maxPlayers: Number,
      minPlayers: Number,
      coop: {
        type: Boolean,
        default: false
      }
    },

    // Platform-specific Features
    features: {
      singlePlayer: {
        type: Boolean,
        default: false
      },
      multiPlayer: {
        type: Boolean,
        default: false
      },
      coop: {
        type: Boolean,
        default: false
      },
      competitive: {
        type: Boolean,
        default: false
      },
      crossPlatform: {
        type: Boolean,
        default: false
      }
    },

    // System Requirements (optional, for PC games)
    systemRequirements: {
      minimum: {
        os: String,
        processor: String,
        memory: String,
        graphics: String,
        storage: String
      },
      recommended: {
        os: String,
        processor: String,
        memory: String,
        graphics: String,
        storage: String
      }
    },

    // Sync Metadata
    lastSyncedAt: {
      type: Date,
      default: Date.now
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed'],
      default: 'synced'
    },

    // Maoga-specific Data
    maogaData: {
      playerCount: {
        type: Number,
        default: 0
      },
      activeLobbies: {
        type: Number,
        default: 0
      },
      lastActivity: Date,
      trending: {
        type: Boolean,
        default: false
      }
    }
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

// Indexes for common queries
gameSchema.index({ name: 'text', description: 'text' }); // Text search
gameSchema.index({ 'genres.id': 1 });
gameSchema.index({ 'platforms.id': 1 });
gameSchema.index({ 'multiplayer.online': 1 });
gameSchema.index({ popularity: -1, rating: -1 }); // For sorting
gameSchema.index({ lastSyncedAt: 1 }); // For sync management
gameSchema.index({ 'maogaData.playerCount': -1 }); // For trending

// Virtual for full cover image URL (future CDN integration)
gameSchema.virtual('coverImageUrl').get(function () {
  if (this.coverImage && this.coverImage.url) {
    // In the future, this could prepend CDN URL
    return this.coverImage.url;
  }
  return null;
});

// Instance method to check if game needs re-sync
gameSchema.methods.needsSync = function () {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.lastSyncedAt < oneDayAgo || this.syncStatus === 'failed';
};

// Static method to find games by platform
gameSchema.statics.findByPlatform = function (platformId) {
  return this.find({ 'platforms.id': platformId }).sort({ popularity: -1 }).limit(100);
};

// Static method to find trending games
gameSchema.statics.findTrending = function (limit = 20) {
  return this.find({ 'maogaData.trending': true })
    .sort({ 'maogaData.playerCount': -1, popularity: -1 })
    .limit(limit);
};

// Static method for search with filters
gameSchema.statics.searchGames = function (options = {}) {
  const {
    query,
    genres,
    platforms,
    multiplayer,
    limit = 20,
    skip = 0,
    sortBy = 'popularity'
  } = options;

  const filter = {};

  // Text search
  if (query) {
    filter.$text = { $search: query };
  }

  // Genre filter
  if (genres && genres.length > 0) {
    filter['genres.id'] = { $in: genres };
  }

  // Platform filter
  if (platforms && platforms.length > 0) {
    filter['platforms.id'] = { $in: platforms };
  }

  // Multiplayer filter
  if (multiplayer !== undefined) {
    filter['multiplayer.online'] = multiplayer;
  }

  // Sort options
  const sortOptions = {
    popularity: { popularity: -1 },
    rating: { rating: -1 },
    recent: { releaseDate: -1 },
    name: { name: 1 }
  };

  const sort = sortOptions[sortBy] || sortOptions.popularity;

  return this.find(filter).sort(sort).limit(limit).skip(skip);
};

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
