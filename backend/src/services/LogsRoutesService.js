const logger = require('../services/logger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

class LogsRoutesService {
  static async logClientError(message, stack, url, userAgent, context, severity, userId, sessionId, ip) {
    // Log the error
    logger.clientError(message, {
      message,
      stack
    }, {
      url,
      userAgent,
      userId: userId || null,
      sessionId: sessionId || null,
      ip,
      severity
    });

    // If critical, also log as critical
    if (severity === 'critical') {
      logger.critical('Client-side critical error', {
        message,
        stack
      }, {
        url,
        userAgent,
        userId: userId,
        ip
      });
    }
  }

  static async logAnalyticsEvent(eventName, eventData, timestamp, userId) {
    logger.info(`Analytics: ${eventName}`, {
      eventName,
      eventData,
      userId: userId || null,
      timestamp
    });
  }

  static getLoggingStatus() {
    return {
      logging: 'active',
      level: process.env.LOG_LEVEL || 'INFO',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = LogsRoutesService;
