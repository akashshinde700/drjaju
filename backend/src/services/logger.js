/**
 * Centralized Logging Service
 * Handles application logging with different levels and destinations
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

const LOG_DIR = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class Logger {
  constructor() {
    this.currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];
  }

  /**
   * Format timestamp
   */
  static getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  static formatMessage(level, message, data = {}) {
    return JSON.stringify({
      timestamp: Logger.getTimestamp(),
      level,
      message,
      ...data
    });
  }

  /**
   * Write to file
   */
  static writeToFile(filename, message) {
    try {
      const filePath = path.join(LOG_DIR, filename);
      fs.appendFileSync(filePath, message + '\n');
    } catch (err) {
      console.error('Failed to write log file:', err);
    }
  }

  /**
   * Debug level logging
   */
  debug(message, data = {}) {
    if (this.currentLevel <= LOG_LEVELS.DEBUG) {
      const formatted = Logger.formatMessage('DEBUG', message, data);
      Logger.writeToFile('app.log', formatted);
    }
  }

  /**
   * Info level logging
   */
  info(message, data = {}) {
    if (this.currentLevel <= LOG_LEVELS.INFO) {
      const formatted = Logger.formatMessage('INFO', message, data);
      Logger.writeToFile('app.log', formatted);
    }
  }

  /**
   * Warning level logging
   */
  warn(message, data = {}) {
    if (this.currentLevel <= LOG_LEVELS.WARN) {
      const formatted = Logger.formatMessage('WARN', message, data);
      console.warn(formatted);
      Logger.writeToFile('warnings.log', formatted);
    }
  }

  /**
   * Error level logging with stack trace
   */
  error(message, error = {}, context = {}) {
    if (this.currentLevel <= LOG_LEVELS.ERROR) {
      const errorData = {
        message: error.message || error,
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage,
        ...context
      };
      const formatted = Logger.formatMessage('ERROR', message, errorData);
      console.error(formatted);
      Logger.writeToFile('errors.log', formatted);
    }
  }

  /**
   * Critical level logging
   */
  critical(message, error = {}, context = {}) {
    if (this.currentLevel <= LOG_LEVELS.CRITICAL) {
      const errorData = {
        message: error.message || error,
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage,
        ...context
      };
      const formatted = Logger.formatMessage('CRITICAL', message, errorData);
      console.error(formatted);
      Logger.writeToFile('critical.log', formatted);
      
      // Send critical alerts via email or webhooks if configured
      if (process.env.CRITICAL_ALERT_EMAIL) {
        // TODO: Implement email notification
      }
    }
  }

  /**
   * Log client-side errors
   */
  clientError(message, error = {}, userContext = {}) {
    const clientErrorData = {
      message: error.message || error,
      stack: error.stack,
      userAgent: userContext.userAgent,
      url: userContext.url,
      userId: userContext.userId,
      sessionId: userContext.sessionId,
      timestamp: userContext.timestamp
    };
    const formatted = Logger.formatMessage('ERROR', `Client: ${message}`, clientErrorData);
    Logger.writeToFile('client-errors.log', formatted);
  }

  /**
   * Log authentication events
   */
  authEvent(action, userId, success = true, context = {}) {
    const authData = {
      action,
      userId,
      success,
      ip: context.ip,
      userAgent: context.userAgent,
      timestamp: Logger.getTimestamp(),
      ...context
    };
    const formatted = Logger.formatMessage('INFO', `Auth: ${action}`, authData);
    Logger.writeToFile('auth.log', formatted);
  }

  /**
   * Log database operations
   */
  dbOperation(operation, table, userId = null, context = {}) {
    const dbData = {
      operation,
      table,
      userId,
      duration: context.duration,
      rowsAffected: context.rowsAffected,
      timestamp: Logger.getTimestamp()
    };
    const formatted = Logger.formatMessage('DEBUG', `Database: ${operation} on ${table}`, dbData);
    Logger.writeToFile('database.log', formatted);
  }

  /**
   * Log API requests
   */
  apiRequest(method, path, statusCode, context = {}) {
    const apiData = {
      method,
      path,
      statusCode,
      userId: context.userId,
      ip: context.ip,
      duration: context.duration,
      timestamp: Logger.getTimestamp()
    };
    const formatted = Logger.formatMessage('DEBUG', `API: ${method} ${path}`, apiData);
    Logger.writeToFile('api.log', formatted);
  }
}

module.exports = new Logger();
