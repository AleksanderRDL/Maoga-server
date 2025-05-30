const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'friend_request',
        'friend_accepted',
        'match_found',
        'lobby_invite',
        'lobby_ready',
        'message_received',
        'system_announcement',
        'achievement_earned',
        'report_update'
      ],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    data: {
      // For deep linking and additional context
      entityType: {
        type: String,
        enum: ['user', 'lobby', 'match', 'game', 'report', 'achievement']
      },
      entityId: mongoose.Schema.Types.ObjectId,
      actionUrl: String,
      metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'archived'],
      default: 'unread',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    deliveryChannels: [
      {
        type: String,
        enum: ['inApp', 'push', 'email']
      }
    ],
    deliveryStatus: {
      inApp: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        error: String
      },
      push: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        error: String,
        deviceTokens: [String]
      },
      email: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        error: String,
        messageId: String
      }
    },
    expiresAt: {
      type: Date,
      index: true
    },
    readAt: Date,
    archivedAt: Date
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
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function () {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = function () {
  if (this.status === 'unread') {
    this.status = 'read';
    this.readAt = new Date();
  }
  return this.save();
};

// Instance method to archive
notificationSchema.methods.archive = function () {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

// Static method to mark multiple as read
notificationSchema.statics.markManyAsRead = async function (userId, notificationIds) {
  return await this.updateMany(
    {
      _id: { $in: notificationIds },
      userId,
      status: 'unread'
    },
    {
      $set: {
        status: 'read',
        readAt: new Date()
      }
    }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    userId,
    status: 'unread',
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
