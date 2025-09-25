const moduleLogLevels = {
  'jobs:gameSync': process.env.LOG_LEVEL_GAME_SYNC || 'warn',
  'jobs:notificationQueue': process.env.LOG_LEVEL_NOTIFICATION_QUEUE || 'warn',
  'services:socket': process.env.LOG_LEVEL_SOCKET || 'warn',
  'database:mongoose': process.env.LOG_LEVEL_MONGOOSE || 'warn'
};

module.exports = {
  database: {
    options: {
      // Additional development-specific options
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    modules: moduleLogLevels
  }
};

