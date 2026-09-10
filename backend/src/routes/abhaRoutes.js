const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const abhaController = require('../controllers/abhaController');
const joiValidate = require('../middleware/joiValidate');
const {
  initiateAbhaRegistration,
  verifyAbhaOtp,
  initiateAbhaLogin,
  unlinkAbha: unlinkAbhaSchema
} = require('../validation/commonSchemas');

const router = express.Router();

// New ABHA registration flow (using ABDM v3 APIs)
router.post('/register/init', authenticateToken, joiValidate(initiateAbhaRegistration), abhaController.initiateRegistration);
router.post('/register/verify-otp', authenticateToken, joiValidate(verifyAbhaOtp), abhaController.verifyRegistrationOtp);

// New ABHA login flow (for existing ABHA accounts)
router.post('/login/init', authenticateToken, joiValidate(initiateAbhaLogin), abhaController.initiateLogin);
router.post('/login/verify-otp', authenticateToken, joiValidate(verifyAbhaOtp), abhaController.verifyLoginOtp);

// ABHA account management
router.get('/status/:patient_id', authenticateToken, abhaController.getAbhaStatus);
router.get('/stats', authenticateToken, abhaController.getAbhaStats);
// Dashboard and HFR management
router.get('/dashboard', authenticateToken, abhaController.getAbhaDashboard);
router.patch('/hfr-id', authenticateToken, abhaController.updateHfrId);
router.get('/records/:patient_id', authenticateToken, abhaController.getAbhaRecords);
router.post('/unlink', authenticateToken, joiValidate(unlinkAbhaSchema), abhaController.unlinkAbha);

// Legacy endpoints (for backward compatibility - deprecated)
router.post('/enroll', authenticateToken, abhaController.enroll);
router.post('/link', authenticateToken, abhaController.link);

module.exports = router;
