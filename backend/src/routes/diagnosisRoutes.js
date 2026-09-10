/**
 * Diagnosis Routes
 * API endpoints for searching diagnoses and their related medications
 */

const express = require('express');
const diagnosisController = require('../controllers/diagnosisController');
const router = express.Router();

// Auth enforced by app.js before this router

router.get('/frequently-used', diagnosisController.getFrequentlyUsedDiagnoses);
router.get('/search', diagnosisController.searchDiagnoses);
router.get('/suggest-by-symptoms', diagnosisController.suggestBySymptoms);
router.get('/:icd_code/medications', diagnosisController.getMedicationsForDiagnosis);
router.get('/:icd_code', diagnosisController.getDiagnosisDetails);
router.post('/', diagnosisController.saveCustomDiagnosis);

module.exports = router;
