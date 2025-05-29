// test/utils/socketClient.js
const io = require('socket.io-client');
// const config = require('../../src/config'); // Not needed if port is passed

class TestSocketClient {
  constructor() {
    this.socket = null;
  }

  async connect(serverUrl, authToken, options = {}) {
    // Added serverUrl parameter
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        // Use serverUrl
        auth: {
          token: authToken
        },
        transports: ['websocket'],
        reconnection: false, // Prevent auto-reconnection during tests
        forceNew: true, // Ensure a new connection for each test
        ...options
      });

      this.socket.on('connect', () => {
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        // console.error('Client connect_error:', error); // Useful for debugging error structure
        reject(error);
      });

      setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          this.socket.disconnect();
          reject(new Error('Socket connection timeout'));
        }
      }, 5000);
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
