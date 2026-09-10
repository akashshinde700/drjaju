const express = require('express');
const router = express.Router();
const vipPatientController = require('../controllers/vipPatientController');
const { authenticateToken } = require('../middleware/auth');
const joiValidate = require('../middleware/joiValidate');
const { createVipPatient, updateVipPatient } = require('../validation/commonSchemas');

// =====================================================
// VIP PATIENT ROUTES
// =====================================================

// Create VIP patient
router.post('/', authenticateToken, joiValidate(createVipPatient), vipPatientController.createVIPPatient);

// Get all VIP patients
router.get('/', authenticateToken, vipPatientController.getAllVIPPatients);

// Get VIP queue priority
router.get('/queue/priority', authenticateToken, vipPatientController.getVIPQueuePriority);

// Get VIP patient details
router.get('/:patient_id', authenticateToken, vipPatientController.getVIPPatient);

// Update VIP patient
router.patch('/:patient_id', authenticateToken, joiValidate(updateVipPatient), vipPatientController.updateVIPPatient);

// Remove VIP status
router.delete('/:patient_id', authenticateToken, vipPatientController.removeVIPStatus);

// =====================================================
// ACCESS CONTROL ROUTES
// =====================================================

// Grant record access
router.post('/:patient_id/access-control', authenticateToken, vipPatientController.grantRecordAccess);

// Revoke record access
router.delete('/:patient_id/access-control/:access_id', authenticateToken, vipPatientController.revokeRecordAccess);

// Check record access
router.get('/:patient_id/check-access', authenticateToken, vipPatientController.checkRecordAccess);

// =====================================================
// ACTIVITY & REPORTING ROUTES
// =====================================================

// Get VIP activity logs
router.get('/:patient_id/activity-logs', authenticateToken, vipPatientController.getVIPActivityLogs);

// Generate VIP report
router.get('/:patient_id/report', authenticateToken, vipPatientController.generateVIPReport);

// =====================================================
// QUEUE MANAGEMENT ROUTES
// =====================================================

module.exports = router;
