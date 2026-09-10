const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const { validateRequired, validateId } = require('../middleware/validator');
const { auditLogger } = require('../middleware/auditLogger');
const joiValidate = require('../middleware/joiValidate');
const { createInsurancePolicy: createInsurancePolicySchema, updateInsurancePolicy: updateInsurancePolicySchema } = require('../validation/commonSchemas');

const insuranceController = require('../controllers/insuranceController');

const router = express.Router();

router.get('/patient/:patientId', authenticateToken, validateId('patientId'), insuranceController.getPatientInsurance);

// Get a single insurance policy
router.get('/:id', authenticateToken, validateId('id'), insuranceController.getInsurancePolicy);

router.post(
  '/',
  authenticateToken,
  joiValidate(createInsurancePolicySchema),
  auditLogger('INSURANCE'),
  insuranceController.createInsurancePolicy
);

// Update an insurance policy
router.put(
  '/:id',
  authenticateToken,
  validateId('id'),
  joiValidate(updateInsurancePolicySchema),
  auditLogger('INSURANCE'),
  insuranceController.updateInsurancePolicy
);

// Delete an insurance policy
router.delete(
  '/:id',
  authenticateToken,
  validateId('id'),
  auditLogger('INSURANCE'),
  insuranceController.deleteInsurancePolicy
);

module.exports = router;

