const express = require('express');
const router = express.Router();
const controller = require('../controllers/opdController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// POST /api/opd/register - Register patient at reception
router.post('/register', controller.registerPatient);

// GET /api/opd/queue - Get real-time queue for staff dashboard
router.get('/queue', controller.getQueue);

// PUT /api/opd/start-consultation/:visitId - Start consultation
router.put('/start-consultation/:visitId', controller.startConsultation);

// PUT /api/opd/complete-consultation/:visitId - Complete consultation and create prescription
router.put('/complete-consultation/:visitId', controller.completeConsultation);

// PUT /api/opd/update-payment/:billId - Update payment status
router.put('/update-payment/:billId', controller.updatePayment);

// GET /api/opd/patient-history/:patientId - Get patient visit history
router.get('/patient-history/:patientId', controller.getPatientHistory);

// GET /api/opd/visit/:visitId - Get a single visit + its patient (DoctorConsultation page)
router.get('/visit/:visitId', controller.getVisit);

// GET /api/opd/today-stats - Get today's statistics for dashboard
router.get('/today-stats', controller.getTodayStats);

module.exports = router;
