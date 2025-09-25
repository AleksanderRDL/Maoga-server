const pino = require('pino');
const config = require('../config');

const moduleLoggerCache = new Map();

function resolveModuleLevel(moduleName) {
  if (!moduleName || typeof moduleName !== 'string') {
    return undefined;
  }

  const modules = new Map(Object.entries(config.logging?.modules || {}));

  if (modules.has(moduleName)) {
    return modules.get(moduleName);
  }

  const segments = moduleName.split(':');
  while (segments.length > 1) {
    segments.pop();
    const candidate = segments.join(':');
    if (modules.has(candidate)) {
      return modules.get(candidate);
    }
  }

  return undefined;
}

const loggerOptions = {
  level: config.logging?.level || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  },
  base: {
    service: 'maoga-backend',
    env: config.env
  }
};

const shouldPrettyPrint =
  typeof config.logging?.pretty === 'boolean'
    ? config.logging.pretty
    : config.env === 'development';

if (shouldPrettyPrint) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  };
}

const logger = pino(loggerOptions);

function forModule(moduleName, additionalContext = {}) {
  if (!moduleName || typeof moduleName !== 'string') {
    throw new Error('logger.forModule requires a module name string');
  }

  const moduleLevel = resolveModuleLevel(moduleName);
  const hasExtraContext = additionalContext && Object.keys(additionalContext).length > 0;
  const cacheKey = moduleName + '|' + (moduleLevel || '');

  if (!hasExtraContext && moduleLoggerCache.has(cacheKey)) {
    return moduleLoggerCache.get(cacheKey);
  }

  const childBindings = {
    module: moduleName,
    ...additionalContext
  };

  const childOptions = moduleLevel ? { level: moduleLevel } : undefined;
  const childLogger = logger.child(childBindings, childOptions);

  if (!hasExtraContext) {
    moduleLoggerCache.set(cacheKey, childLogger);
  }

  return childLogger;
}

logger.forModule = forModule;
logger.getLogger = forModule;
logger.withModule = forModule;

module.exports = logger;
