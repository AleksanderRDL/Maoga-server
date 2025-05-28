const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, underscores and hyphens'
      ]
    },
    hashedPassword: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    profile: {
      displayName: {
        type: String,
        trim: true,
        maxlength: [50, 'Display name cannot exceed 50 characters']
      },
      bio: {
        type: String,
        maxlength: [500, 'Bio cannot exceed 500 characters']
      },
      profileImage: String,
      privacySettings: {
        showGameProfiles: {
          type: Boolean,
          default: true
        },
        showPreferences: {
          type: Boolean,
          default: true
        },
        showActivity: {
          type: Boolean,
          default: true
        }
      }
    },
    gamingPreferences: {
      competitiveness: {
        type: String,
        enum: ['casual', 'balanced', 'competitive'],
        default: 'balanced'
      },
      preferredGames: [
        {
          gameId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Game'
          },
          weight: {
            type: Number,
            min: 0,
            max: 100,
            default: 50
          }
        }
      ],
      gameWeights: {
        type: Map,
        of: Number,
        default: new Map()
      },
      regions: [String],
      languages: [String],
      playTimePreferences: {
        weekdays: {
          start: String, // e.g., "19:00"
          end: String // e.g., "23:00"
        },
        weekends: {
          start: String,
          end: String
        },
        timezone: {
          type: String,
          default: 'UTC'
        }
      }
    },
    gameProfiles: [
      {
        gameId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Game',
          required: true
        },
        inGameName: {
          type: String,
          trim: true
        },
        rank: String,
        skillLevel: {
          type: Number,
          min: 0,
          max: 100
        },
        stats: {
          type: Map,
          of: mongoose.Schema.Types.Mixed
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    notificationSettings: {
      email: {
        friendRequests: { type: Boolean, default: true },
        matchFound: { type: Boolean, default: true },
        lobbyInvites: { type: Boolean, default: true },
        messages: { type: Boolean, default: false }
      },
      push: {
        friendRequests: { type: Boolean, default: true },
        matchFound: { type: Boolean, default: true },
        lobbyInvites: { type: Boolean, default: true },
        messages: { type: Boolean, default: true }
      },
      inApp: {
        friendRequests: { type: Boolean, default: true },
        matchFound: { type: Boolean, default: true },
        lobbyInvites: { type: Boolean, default: true },
        messages: { type: Boolean, default: true }
      }
    },
    karmaPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    virtualCurrency: {
      type: Number,
      default: 0,
      min: 0
    },
    deviceTokens: [
      {
        token: String,
        platform: {
          type: String,
          enum: ['ios', 'android', 'web']
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned', 'deleted'],
      default: 'active'
    },
    suspensionDetails: {
      reason: String,
      startDate: Date,
      endDate: Date,
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    refreshTokens: [
      {
        token: String,
        createdAt: {
          type: Date,
          default: Date.now
        },
        expiresAt: Date
      }
    ],
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.hashedPassword;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Virtual for user's full profile URL
userSchema.virtual('profileImageUrl').get(function () {
  if (this.profile.profileImage) {
    return this.profile.profileImage;
  }
  return null;
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('hashedPassword')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.hashedPassword = await bcrypt.hash(this.hashedPassword, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.hashedPassword);
};

// Instance method to clean expired refresh tokens
userSchema.methods.cleanExpiredTokens = function () {
  this.refreshTokens = this.refreshTokens.filter((tokenObj) => tokenObj.expiresAt > new Date());
};

// Static method to find by email or username
userSchema.statics.findByCredential = async function (credential) {
  return await this.findOne({
    $or: [{ email: credential.toLowerCase() }, { username: credential }]
  }).select('+hashedPassword');
};

// Index for game profiles
userSchema.index({ 'gameProfiles.gameId': 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
