const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/vitalsController');

router.use(authenticateToken);

// GET /api/vitals/exists?patientId=&appointmentId=
router.get('/exists', controller.exists);

module.exports = router;
