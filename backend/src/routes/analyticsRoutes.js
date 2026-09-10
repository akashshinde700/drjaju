const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.get('/', authenticateToken, analyticsController.summary);
router.get('/overview', authenticateToken, analyticsController.overview);
router.get('/diagnosis', authenticateToken, analyticsController.diagnosis);
router.get('/diagnosis-list', authenticateToken, analyticsController.diagnosisList);
router.get('/diagnosis-patients', authenticateToken, analyticsController.diagnosisPatients);
router.get('/status', authenticateToken, analyticsController.status);
router.get('/medication-list', authenticateToken, analyticsController.medicationList);
router.get('/medication-patients', authenticateToken, analyticsController.medicationPatients);
router.get('/lab-test-list', authenticateToken, analyticsController.labTestList);
router.get('/lab-test-patients', authenticateToken, analyticsController.labTestPatients);
router.get('/wow', authenticateToken, analyticsController.wow);
router.get('/top-symptoms', authenticateToken, analyticsController.topSymptoms);
router.get('/top-medications', authenticateToken, analyticsController.topMedications);
router.get('/appointment-breakdown', authenticateToken, analyticsController.appointmentBreakdown);
router.get('/summary', authenticateToken, analyticsController.summary);

module.exports = router;
