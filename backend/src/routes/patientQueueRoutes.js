const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const patientQueueController = require('../controllers/patientQueueController');


const router = express.Router();

// Search patients for queue
router.get('/search-patients', authenticateToken, patientQueueController.searchPatients);

// Register new patient and add to queue
router.post('/register-and-queue', authenticateToken, auditLogger('PATIENT_QUEUE'), patientQueueController.registerNewPatientAndQueue);

// Add existing patient to queue
router.post('/add-to-queue', authenticateToken, auditLogger('PATIENT_QUEUE'), patientQueueController.addExistingPatientToQueue);

// Get queue by date
router.get('/queue', authenticateToken, patientQueueController.getQueueByDate);

// Get available doctors
router.get('/doctors', authenticateToken, patientQueueController.getAvailableDoctors);

module.exports = router;
