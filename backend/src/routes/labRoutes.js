const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const labRoutesController = require('../controllers/labRoutesController');
const labController = require('../controllers/labController');
const { auditLogger } = require('../middleware/auditLogger');
const joiValidate = require('../middleware/joiValidate');
const { createInvestigation, updateInvestigation } = require('../validation/commonSchemas');

const router = express.Router();

router.get('/', authenticateToken, labController.listLabs);
router.post('/', authenticateToken, joiValidate(createInvestigation), auditLogger('LAB'), labController.addLab);

// POST /api/labs/:patientId - Add lab result for a patient (used by PatientOverview & PrescriptionPad)
router.post('/:patientId', authenticateToken, labRoutesController.addLabResultForPatient);

// GET /api/labs/:patientId - Get lab results for a patient (used by PatientOverview)
router.get('/:patientId', authenticateToken, labRoutesController.listLabsForPatient);

router.put('/:id', authenticateToken, joiValidate(updateInvestigation), auditLogger('LAB'), labController.updateLab);
router.delete('/:id', authenticateToken, auditLogger('LAB'), labController.deleteLab);

module.exports = router;
