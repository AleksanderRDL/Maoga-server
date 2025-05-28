const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportType: {
      type: String,
      enum: ['user_profile', 'chat_message', 'lobby_behavior', 'cheating', 'other'],
      required: true
    },
    reason: {
      type: String,
      enum: [
        'inappropriate_content',
        'harassment',
        'spam',
        'cheating',
        'impersonation',
        'hate_speech',
        'threats',
        'other'
      ],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    evidence: {
      screenshots: [String],
      chatLogIds: [mongoose.Schema.Types.ObjectId],
      matchId: mongoose.Schema.Types.ObjectId
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    resolution: {
      action: {
        type: String,
        enum: ['no_action', 'warning', 'suspension', 'ban', 'other']
      },
      notes: String,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolvedAt: Date
    },
    adminNotes: [
      {
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        note: {
          type: String,
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
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

// Indexes for efficient querying
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedId: 1, status: 1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });

// Static method to get report statistics
reportSchema.statics.getStatistics = async function (dateRange) {
  const match = {};
  if (dateRange) {
    match.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
