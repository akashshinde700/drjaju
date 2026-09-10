const app = require('./app');
const env = require('./config/env');
const { initDb } = require('./config/db');
const logger = require('./services/logger');

const cluster = require('cluster');
const os = require('os');

let serverInstance = null;

process.on('unhandledRejection', (reason, promise) => {
  logger.critical('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise)
  });
});

process.on('uncaughtException', (err) => {
  logger.critical('Uncaught Exception - shutting down', err);
  if (serverInstance) {
    serverInstance.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 10000).unref();
  } else {
    process.exit(1);
  }
});

async function start() {
  try {
    await initDb();
    serverInstance = app.listen(env.port, () => {
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

if (env.nodeEnv === 'production' && (cluster.isPrimary || cluster.isMaster)) {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    cluster.fork();
  });
} else {
  start();
}

