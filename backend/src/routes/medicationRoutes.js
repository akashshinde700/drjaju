/**
 * Medication Routes
 * All medication-related endpoints
 */

const express = require('express');

const medicationController = require('../controllers/medicationController');
const joiValidate = require('../middleware/joiValidate');
const {
  searchMedicationsSchema,
  medicationsByDiagnosisSchema,
  medicationsBySymptomSchema,
  medicationProtocolSchema,
  patientRecentMedicationsSchema,
  medicationDetailsSchema
} = require('../validation/medicationSchemas');

const router = express.Router();

// Auth enforced by app.js before this router

// Named routes - MUST be BEFORE /:id routes
router.get('/search', joiValidate(searchMedicationsSchema), medicationController.searchMedications);
router.get('/categories', medicationController.getMedicationCategories);
router.post('/by-diagnosis', joiValidate(medicationsByDiagnosisSchema), medicationController.getMedicationsByDiagnosis);
router.post('/by-symptom', joiValidate(medicationsBySymptomSchema), medicationController.getMedicationsBySymptom);
router.get('/protocol/:type', joiValidate(medicationProtocolSchema), medicationController.getMedicationProtocol);
router.get('/recommended', medicationController.getRecommendedMedications);
router.get('/patient-recent/:patientId', joiValidate(patientRecentMedicationsSchema), medicationController.getPatientRecentMedications);

// ID-based routes - AFTER named routes
router.get('/:id/alternatives', joiValidate(medicationDetailsSchema), medicationController.getMedicationAlternatives);
router.get('/:id', joiValidate(medicationDetailsSchema), medicationController.getMedicationDetails);

module.exports = router;
