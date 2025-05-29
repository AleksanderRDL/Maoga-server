const { expect } = require('chai');
const socketManager = require('../../../src/services/socketManager');

describe('SocketManager Unit Tests', () => {
  describe('User Socket Management', () => {
    beforeEach(() => {
      socketManager.userSockets.clear();
      socketManager.socketUsers.clear();
    });

    it('should track user sockets correctly', () => {
      // Simulate adding sockets
      socketManager.userSockets.set('user1', new Set(['socket1', 'socket2']));
      socketManager.socketUsers.set('socket1', 'user1');
      socketManager.socketUsers.set('socket2', 'user1');

      expect(socketManager.getUserSocketCount('user1')).to.equal(2);
      expect(socketManager.getOnlineUsers(['user1', 'user2'])).to.deep.equal(['user1']);
    });

    it('should handle user disconnection', () => {
      socketManager.userSockets.set('user1', new Set(['socket1']));
      socketManager.socketUsers.set('socket1', 'user1');

      // Simulate disconnection
      socketManager.userSockets.get('user1').delete('socket1');
      socketManager.socketUsers.delete('socket1');

      if (socketManager.userSockets.get('user1').size === 0) {
        socketManager.userSockets.delete('user1');
      }

      expect(socketManager.getUserSocketCount('user1')).to.equal(0);
      expect(socketManager.getOnlineUsers(['user1'])).to.deep.equal([]);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      socketManager.userSockets.set('user1', new Set(['socket1', 'socket2']));
      socketManager.userSockets.set('user2', new Set(['socket3']));
      socketManager.socketUsers.set('socket1', 'user1');
      socketManager.socketUsers.set('socket2', 'user1');
      socketManager.socketUsers.set('socket3', 'user2');

      const stats = socketManager.getStats();
      expect(stats.connectedUsers).to.equal(2);
      expect(stats.totalSockets).to.equal(3);
    });
  });
});
