const io = require('socket.io-client');
const config = require('../../src/config');

class TestSocketClient {
  constructor() {
    this.socket = null;
  }

  async connect(authToken, options = {}) {
    return new Promise((resolve, reject) => {
      this.socket = io(`http://localhost:${config.port}`, {
        auth: {
          token: authToken
        },
        transports: ['websocket'],
        ...options
      });

      this.socket.on('connect', () => {
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        reject(error);
      });

      // Set timeout
      setTimeout(() => {
        reject(new Error('Socket connection timeout'));
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
      const timer = setTimeout(() => {
        this.off(event, handler);
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
