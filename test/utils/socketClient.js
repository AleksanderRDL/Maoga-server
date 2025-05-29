// test/utils/socketClient.js
const io = require('socket.io-client');
const logger = require('../../src/utils/logger');
// const config = require('../../src/config'); // Not needed if port is passed

class TestSocketClient {
  constructor() {
    this.socket = null;
  }

  async connect(serverUrl, authToken, options = {}) {
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        auth: {
          token: authToken
        },
        transports: ['websocket'], // Force websocket for tests
        reconnection: false,
        forceNew: true,
        timeout: 5000, // Add connection timeout
        ...options
      });

      // Set up event handlers before connecting
      this.socket.on('connect', () => {
        logger.debug('Socket.IO client connected successfully', {
          socketId: this.socket.id,
          serverUrl
        });
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        logger.error('Socket.IO client connection error', {
          error: error.message,
          serverUrl,
          hasToken: !!authToken
        });
        reject(error);
      });

      // Add timeout as backup
      const timeout = setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          logger.error('Socket.IO client connection timeout', { serverUrl });
          this.socket.disconnect();
          reject(new Error('Socket connection timeout'));
        }
      }, 8000); // Increased timeout for slower test environments

      // Clear timeout on successful connection
      this.socket.on('connect', () => {
        clearTimeout(timeout);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  on(event, handler) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on(event, handler);
  }

  once(event, handler) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.once(event, handler);
  }

  off(event, handler) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.off(event, handler);
  }

  waitForEvent(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket not connected before waiting for event'));
      }
      const timer = setTimeout(() => {
        this.off(event, handler); // Clean up listener on timeout
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.once(event, handler);
    });
  }
}

module.exports = TestSocketClient;
