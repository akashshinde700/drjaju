const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/smartPrescriptionController');

router.use(authenticateToken);

// GET /api/smart-prescription/suggestions?patientId=&diagnosis=&symptoms=&age=&weight=
router.get('/suggestions', controller.getSmartSuggestions);

// POST /api/smart-prescription/check-interactions
router.post('/check-interactions', controller.checkDrugInteractions);

// GET /api/smart-prescription/calculate-dosage?medicineName=&age=&weight=&patientType=
router.get('/calculate-dosage', controller.calculateDosage);

module.exports = router;
