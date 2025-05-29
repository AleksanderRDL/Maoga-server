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

  // Lobby events
  LOBBY_CREATED: 'lobby:created',
  LOBBY_SUBSCRIBE: 'lobby:subscribe',
  LOBBY_UNSUBSCRIBE: 'lobby:unsubscribe',
  LOBBY_SUBSCRIBED: 'lobby:subscribed',
  LOBBY_UNSUBSCRIBED: 'lobby:unsubscribed',
  LOBBY_UPDATE: 'lobby:update',
  LOBBY_MEMBER_JOINED: 'lobby:member:joined',
  LOBBY_MEMBER_LEFT: 'lobby:member:left',
  LOBBY_MEMBER_READY: 'lobby:member:ready',
  LOBBY_CLOSED: 'lobby:closed',

  // Chat events
  CHAT_MESSAGE: 'chat:message',
  CHAT_SEND: 'chat:send',
  CHAT_TYPING: 'chat:typing',

  // Future events (Sprint 8+)
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count'
};
