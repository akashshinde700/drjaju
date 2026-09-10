const express = require('express');

const { validateId } = require('../middleware/validator');
const complianceController = require('../controllers/complianceController');
const router = express.Router();

// POST /api/compliance/log
router.post('/log', complianceController.logCompliance);

// GET /api/compliance/patients/:patientId/compliance-report
router.get('/patients/:patientId/compliance-report', validateId('patientId'), complianceController.getComplianceReport);

module.exports = router;
