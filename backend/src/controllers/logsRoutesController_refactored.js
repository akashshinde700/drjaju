const LogsRoutesService = require('../services/LogsRoutesService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const asyncHandler = require('../utils/asyncHandler');

class LogsRoutesController {
  static logClientError = asyncHandler(async (req, res) => {
    try {
      const {
        message,
        stack,
        url,
        userAgent,
        context = {},
        severity = 'error'
      } = req.body;

      await LogsRoutesService.logClientError(
        message,
        stack,
        url,
        userAgent,
        context,
        severity,
        req.user?.id || null,
        req.sessionID || null,
        req.ip
      );

      sendSuccess(res, null, 'Error logged successfully');
    } catch (error) {
      console.error('Failed to log client error:', error);
      sendError(res, 'Failed to log error', 500, error.message);
    }
  });

  static logAnalyticsEvent = asyncHandler(async (req, res) => {
    try {
      const {
        eventName,
        eventData = {},
        timestamp
      } = req.body;

      await LogsRoutesService.logAnalyticsEvent(
        eventName,
        eventData,
        timestamp,
        req.user?.id || null
      );

      sendSuccess(res, null, 'Analytics event logged');
    } catch (error) {
      console.error('Failed to log analytics event:', error);
      sendError(res, 'Failed to log analytics', 500, error.message);
    }
  });

  static getLoggingStatus = asyncHandler(async (req, res) => {
    const status = LogsRoutesService.getLoggingStatus();
    sendSuccess(res, status, 'Logging status retrieved');
  });
}

module.exports = LogsRoutesController;
