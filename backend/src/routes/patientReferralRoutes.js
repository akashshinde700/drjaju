const express = require('express');

const joiValidate = require('../middleware/joiValidate');
const { createPatientReferral, updatePatientReferral } = require('../validation/commonSchemas');
// Auth middleware
const { authenticateToken, requireRole } = require('../middleware/auth');

const patientReferralController = require('../controllers/patientReferralController');

const router = express.Router();

// Auth handled by app.js: app.use('/api/patient-referrals', authenticateToken, ...)

// Referral Network (MUST be before /:id to avoid conflict)
router.get('/network/doctors', patientReferralController.getReferralNetwork);
router.post('/network/doctors', patientReferralController.addToNetwork);
router.put('/network/doctors/:id', patientReferralController.updateNetworkDoctor);
router.delete('/network/doctors/:id', patientReferralController.deleteNetworkDoctor);

// Referral CRUD
router.get('/', patientReferralController.getAllReferrals);
router.get('/:id', patientReferralController.getReferralById);
router.post('/', joiValidate(createPatientReferral), patientReferralController.createReferral);
router.put('/:id', joiValidate(updatePatientReferral), patientReferralController.updateReferral);
router.delete('/:id', patientReferralController.deleteReferral);

module.exports = router;
