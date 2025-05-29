module.exports = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CONNECTED: 'connected',
  ERROR: 'error',

  // Matchmaking events
  MATCHMAKING_SUBSCRIBE: 'matchmaking:subscribe',
  MATCHMAKING_UNSUBSCRIBE: 'matchmaking:unsubscribe',
  MATCHMAKING_SUBSCRIBED: 'matchmaking:subscribed',
  MATCHMAKING_UNSUBSCRIBED: 'matchmaking:unsubscribed',
  MATCHMAKING_STATUS: 'matchmaking:status',

  // User status events
  USER_STATUS_SUBSCRIBE: 'user:status:subscribe',
  USER_STATUS_UNSUBSCRIBE: 'user:status:unsubscribe',
  USER_STATUS_UPDATE: 'user:status:update',
  USER_STATUS: 'user:status',

  // Future events (Sprint 7+)
  LOBBY_UPDATE: 'lobby:update',
  LOBBY_MEMBER_JOINED: 'lobby:member:joined',
  LOBBY_MEMBER_LEFT: 'lobby:member:left',
  LOBBY_MEMBER_READY: 'lobby:member:ready',

  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',

  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count'
};
