const mongoose = require('mongoose');

const lobbySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    status: {
      type: String,
      enum: ['forming', 'ready', 'active', 'closed'],
      default: 'forming',
      required: true,
      index: true
    },
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
    matchHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MatchHistory',
      index: true
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        status: {
          type: String,
          enum: ['joined', 'ready', 'left', 'kicked'],
          default: 'joined'
        },
        isHost: {
          type: Boolean,
          default: false
        },
        readyStatus: {
          type: Boolean,
          default: false
        },
        joinedAt: {
          type: Date,
          default: Date.now
        },
        leftAt: Date
      }
    ],
    capacity: {
      min: {
        type: Number,
        default: 2,
        min: 1
      },
      max: {
        type: Number,
        default: 10,
        max: 100
      }
    },
    settings: {
      isPrivate: {
        type: Boolean,
        default: false
      },
      allowSpectators: {
        type: Boolean,
        default: false
      },
      autoStart: {
        type: Boolean,
        default: true
      },
      autoClose: {
        type: Boolean,
        default: true
      },
      customSettings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat'
    },
    region: String,
    autoMessages: {
      type: Boolean,
      default: true
    },
    formedAt: {
      type: Date,
      default: Date.now
    },
    readyAt: Date,
    activeAt: Date,
    closedAt: Date
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

// Indexes
lobbySchema.index({ status: 1, gameId: 1 });
lobbySchema.index({ 'members.userId': 1, status: 1 });
lobbySchema.index({ hostId: 1, status: 1 });

// Virtuals
lobbySchema.virtual('memberCount').get(function () {
  return this.members.filter((m) => m.status === 'joined' || m.status === 'ready').length;
});

lobbySchema.virtual('readyCount').get(function () {
  return this.members.filter((m) => m.readyStatus === true).length;
});

lobbySchema.virtual('isReady').get(function () {
  const activeMemberCount = this.memberCount;
  return activeMemberCount >= this.capacity.min && this.readyCount === activeMemberCount;
});

// Instance methods
lobbySchema.methods.addMember = function (userId, isHost = false) {
  const existingMember = this.members.find((m) => {
    const memberId = m.userId && m.userId._id ? m.userId._id : m.userId;
    return memberId.toString() === userId.toString();
  });

  if (existingMember) {
    if (existingMember.status === 'left' || existingMember.status === 'kicked') {
      existingMember.status = 'joined';
      existingMember.readyStatus = false;
      existingMember.joinedAt = new Date();
      existingMember.leftAt = undefined;
    }
    return existingMember;
  }

  const newMember = {
    userId,
    isHost,
    status: 'joined',
    readyStatus: false
  };

  this.members.push(newMember);
  return newMember;
};

lobbySchema.methods.removeMember = function (userId, reason = 'left') {
  const member = this.members.find((m) => {
    const memberId = m.userId && m.userId._id ? m.userId._id : m.userId;
    return memberId.toString() === userId.toString();
  });

  if (member) {
    member.status = reason;
    member.leftAt = new Date();
    member.readyStatus = false;
  }

  return member;
};

lobbySchema.methods.setMemberReady = function (userId, readyStatus) {
  const member = this.members.find((m) => {
    const memberId = m.userId && m.userId._id ? m.userId._id : m.userId;
    return (
      memberId.toString() === userId.toString() && (m.status === 'joined' || m.status === 'ready')
    );
  });

  if (member) {
    member.readyStatus = readyStatus;
    member.status = readyStatus ? 'ready' : 'joined';
  }

  return member;
};

lobbySchema.methods.canTransitionToReady = function () {
  return this.status === 'forming' && this.isReady;
};

lobbySchema.methods.canTransitionToActive = function () {
  return this.status === 'ready';
};

// Static methods
lobbySchema.statics.findActiveLobby = function (userId) {
  return this.findOne({
    'members.userId': userId,
    'members.status': { $in: ['joined', 'ready'] },
    status: { $in: ['forming', 'ready', 'active'] }
  });
};

const Lobby = mongoose.model('Lobby', lobbySchema);

module.exports = Lobby;
