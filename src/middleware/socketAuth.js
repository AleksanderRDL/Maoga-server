// src/middleware/socketAuth.js
const socketManager = require('../services/socketManager');

/**
 * Attach socket information to request if user is connected
 */
const attachSocketInfo = (req, res, next) => {
  if (req.user) {
    const userId = req.user.id;
    const isConnected = socketManager.getUserSocketCount(userId) > 0;

    req.socketInfo = {
      isConnected,
      socketCount: socketManager.getUserSocketCount(userId),
      canEmit: isConnected
    };
  }

  next();
};

module.exports = {
  attachSocketInfo
};
