/**
 * Error Logging Routes
 * Frontend endpoints for client-side error reporting
 */

const express = require('express');
const router = express.Router();
const joiValidate = require('../middleware/joiValidate');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { errorLogSchema, analyticsEventSchema } = require('../validation/logsSchemas');
const logsRoutesController = require('../controllers/logsRoutesController');

/**
 * POST /api/logs/error
 * Log client-side errors
 */
router.post('/error', joiValidate(errorLogSchema), logsRoutesController.logClientError);

/**
 * POST /api/logs/analytics
 * Log analytics events
 */
router.post('/analytics', authenticateToken, requireRole('admin'), joiValidate(analyticsEventSchema), logsRoutesController.logAnalyticsEvent);

/**
 * GET /api/logs/status
 * Get logging status (debug info)
 */
router.get('/status', authenticateToken, requireRole('admin'), logsRoutesController.getLoggingStatus);

module.exports = router;
