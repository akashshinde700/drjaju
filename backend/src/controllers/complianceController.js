// src/controllers/complianceController.js
/**
 * Minimal compliance controller to accept prescription compliance logs
 * This endpoint exists to avoid 404s from frontend compliance tracker.
 */
const { sendCreated, sendError, sendSuccess } = require('../utils/responseHelper');

async function logCompliance(req, res) {
  try {
    const payload = req.body || {};
    // For now, just log and acknowledge. In future we can persist to DB.
    sendCreated(res, null, 'Compliance logged');
  } catch (err) {
    console.error('Error logging compliance:', err);
    sendError(res, 'Failed to log compliance', 500, err.message);
  }
}

async function getComplianceReport(req, res) {
  try {
    const { patientId } = req.params;
    // For now, return mock compliance data
    const mockReport = {
      patientId,
      overallCompliance: 85,
      medications: [
        {
          name: 'Sample Medication',
          prescribedFrequency: 'Twice daily',
          takenDoses: 15,
          totalDoses: 20,
          compliance: 75
        }
      ],
      period: 'Last 30 days',
      generatedAt: new Date().toISOString()
    };
    
    sendSuccess(res, mockReport, 'Compliance report retrieved');
  } catch (err) {
    console.error('Error getting compliance report:', err);
    sendError(res, 'Failed to get compliance report', 500, err.message);
  }
}

module.exports = require('./complianceController_refactored');
