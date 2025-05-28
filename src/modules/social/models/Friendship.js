const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema(
  {
    user1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    user2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked', 'declined'],
      default: 'pending',
      required: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acceptedAt: Date,
    blockedAt: Date,
    declinedAt: Date
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

// Ensure unique friendship between two users
friendshipSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

// Compound indexes for efficient queries
friendshipSchema.index({ user1Id: 1, status: 1 });
friendshipSchema.index({ user2Id: 1, status: 1 });

// Pre-save hook to ensure user1Id < user2Id for consistency
friendshipSchema.pre('save', function (next) {
  // Always store with smaller ID first to prevent duplicates
  if (this.user1Id.toString() > this.user2Id.toString()) {
    const temp = this.user1Id;
    this.user1Id = this.user2Id;
    this.user2Id = temp;
  }
  next();
});

// Static method to find friendship between two users
friendshipSchema.statics.findFriendship = async function (userId1, userId2) {
  const [smallerId, largerId] = [userId1.toString(), userId2.toString()].sort();
  return await this.findOne({
    user1Id: smallerId,
    user2Id: largerId
  });
};

// Static method to get all friends of a user
friendshipSchema.statics.getFriends = async function (userId, status = 'accepted') {
  return await this.find({
    $or: [
      { user1Id: userId, status },
      { user2Id: userId, status }
    ]
  }).populate('user1Id user2Id', 'username displayName profileImage');
};

// Static method to get pending friend requests
friendshipSchema.statics.getPendingRequests = async function (userId) {
  return await this.find({
    $or: [
      { user1Id: userId, status: 'pending', requestedBy: { $ne: userId } },
      { user2Id: userId, status: 'pending', requestedBy: { $ne: userId } }
    ]
  }).populate('requestedBy', 'username displayName profileImage');
};

const Friendship = mongoose.model('Friendship', friendshipSchema);

module.exports = Friendship;
