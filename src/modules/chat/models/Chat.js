const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  contentType: {
    type: String,
    enum: ['text', 'emoji', 'system', 'auto'],
    default: 'text'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  editedAt: Date,
  deletedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema(
  {
    chatType: {
      type: String,
      enum: ['lobby', 'direct', 'group'],
      required: true,
      index: true
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
      }
    ],
    lobbyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lobby',
      index: true
    },
    messages: [messageSchema],
    lastMessageAt: Date,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
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

// Indexes
chatSchema.index({ chatType: 1, lobbyId: 1 });
chatSchema.index({ participants: 1, chatType: 1 });
chatSchema.index({ lastMessageAt: -1 });

// Instance methods
chatSchema.methods.addMessage = function (senderId, content, contentType = 'text') {
  const message = {
    senderId,
    content,
    contentType,
    createdAt: new Date()
  };

  this.messages.push(message);
  this.lastMessageAt = message.createdAt;

  return message;
};

chatSchema.methods.addSystemMessage = function (content) {
  return this.addMessage(null, content, 'system');
};

// Static methods
chatSchema.statics.createLobbyChat = async function (lobbyId, participants) {
  const chat = new this({
    chatType: 'lobby',
    lobbyId,
    participants
  });

  await chat.save();
  return chat;
};

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
