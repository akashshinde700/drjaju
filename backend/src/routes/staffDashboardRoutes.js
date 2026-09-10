const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const staffDashboardController = require('../controllers/staffDashboardController');


const router = express.Router();

// Batched dashboard endpoint (reduces parallel calls)
router.get('/', authenticateToken, staffDashboardController.getStaffDashboard);

// Get staff dashboard statistics
router.get('/stats', authenticateToken, staffDashboardController.getStaffStats);

// Get patients in queue
router.get('/queue', authenticateToken, staffDashboardController.getPatientsInQueue);

// Update patient queue status
router.put('/patients/:id/queue-status', authenticateToken, staffDashboardController.updatePatientQueueStatus);

// Assign patient to doctor
router.put('/patients/:id/assign-doctor', authenticateToken, staffDashboardController.assignPatientToDoctor);

module.exports = router;
