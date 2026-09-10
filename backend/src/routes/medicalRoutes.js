const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { joiValidate } = require('../middleware/joiValidate');
const medicalRoutesController = require('../controllers/medicalRoutesController');

const router = express.Router();

// Search symptoms from SNOMED CT
router.get('/symptoms/search', authenticateToken, medicalRoutesController.searchSymptoms);

// Get diagnosis suggestions based on symptoms
router.post('/diagnosis/suggestions', authenticateToken, medicalRoutesController.diagnosisSuggestions);

// Get medicine suggestions based on diagnosis or symptoms
router.post('/medicines/suggestions', authenticateToken, medicalRoutesController.medicineSuggestions);

// Get dosage information for a specific medicine
router.get('/medicines/:medicineName/dosage', authenticateToken, medicalRoutesController.medicineDosage);

// Search ICD codes directly
router.get('/icd/search', authenticateToken, medicalRoutesController.searchIcd);

module.exports = router;
