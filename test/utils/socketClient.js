// test/utils/socketClient.js
const io = require('socket.io-client');
const logger = require('../../src/utils/logger'); // Assuming logger is in src/utils

class TestSocketClient {
  constructor(serverUrl, authToken, options = {}) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    this.options = options;
    this.socket = null;
    this._createSocket(); // Create the socket instance upon construction
  }

  _createSocket() {
    this.socket = io(this.serverUrl, {
      auth: {
        token: this.authToken
      },
      transports: ['websocket'], // Force websocket for tests
      reconnection: false,
      forceNew: true, // Ensures a new connection for each TestSocketClient instance
      timeout: this.options.timeout || 5000, // Connection attempt timeout for socket.io-client
      autoConnect: false, // IMPORTANT: Prevent immediate connection
      ...this.options
    });

    // Optional: General purpose listener for debugging all events from this client
    // this.socket.onAny((event, ...args) => {
    //   logger.debug(`TestSocketClient event: ${event}`, { args, socketId: this.socket?.id });
    // });
  }

  async connect() {
    if (!this.socket) {
      // Fallback if socket wasn't created, though constructor should handle it
      this._createSocket();
    }

    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve(this.socket);
        return;
      }

      const onConnect = () => {
        logger.debug('Socket.IO client connected successfully (transport established)', {
          socketId: this.socket.id,
          serverUrl: this.serverUrl
        });
        cleanup();
        resolve(this.socket);
      };

      const onConnectError = (error) => {
        logger.error('Socket.IO client connection error', {
          error: error.message || error, // Handle cases where error might not be an Error instance
          serverUrl: this.serverUrl,
          hasToken: !!this.authToken
        });
        cleanup();
        reject(error);
      };

      // Use the timeout from socket.io-client options for the connection attempt
      const connectTimeoutDuration = this.socket.io.opts.timeout || 8000;
      const connectionAttemptTimeout = setTimeout(() => {
        logger.error(`Socket.IO client connection attempt timeout after ${connectTimeoutDuration}ms`, { serverUrl: this.serverUrl });
        cleanup();
        // Important: Manually disconnect if the socket instance exists but didn't connect
        if (this.socket && !this.socket.connected) {
          this.socket.disconnect();
        }
        reject(new Error(`Socket connection attempt timeout after ${connectTimeoutDuration}ms (in TestSocketClient.connect)`));
      }, connectTimeoutDuration);

      const cleanup = () => {
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onConnectError);
        clearTimeout(connectionAttemptTimeout);
      };

      this.socket.on('connect', onConnect);
      this.socket.on('connect_error', onConnectError);

      this.socket.connect(); // Explicitly open the connection
    });
  }

  disconnect() {
    if (this.socket) {
      logger.debug('Socket.IO client disconnecting', { socketId: this.socket.id });
      this.socket.disconnect();
      // Consider whether to nullify this.socket or allow re-connect in your design.
      // For typical test teardown, nullifying or ensuring it's not reused is common.
      // this.socket = null;
    }
  }

  emit(event, data) {
    if (!this.socket) throw new Error('Socket not initialized. Call connect() first.');
    this.socket.emit(event, data);
  }

  on(event, handler) {
    if (!this.socket) throw new Error('Socket not initialized. Call connect() first.');
    this.socket.on(event, handler);
  }

  once(event, handler) {
    if (!this.socket) throw new Error('Socket not initialized. Call connect() first.');
    this.socket.once(event, handler);
  }

  off(event, handler) {
    if (!this.socket) {
      // Allow 'off' to be called even if socket is null (e.g. during cleanup after disconnect)
      // console.warn('Attempted to call "off" on a non-initialized socket.');
      return;
    }
    this.socket.off(event, handler);
  }

  waitForEvent(event, timeout = 5000) {
    if (!this.socket) {
      return Promise.reject(new Error('Socket instance not created in TestSocketClient. Call constructor.'));
    }
    return new Promise((resolve, reject) => {
      let timer; // Declare timer here so it's accessible in eventHandler

      const eventHandler = (data) => {
        clearTimeout(timer);
        this.socket.off(event, eventHandler); // Clean up this specific listener
        resolve(data);
      };

      timer = setTimeout(() => {
        this.socket.off(event, eventHandler); // Clean up listener on timeout
        reject(new Error(`Timeout waiting for event: ${event} after ${timeout}ms`));
      }, timeout);

      this.socket.on(event, eventHandler); // Use .on for flexibility, then .off
    });
  }
}

module.exports = TestSocketClient;