const express = require('express');
const { authenticateToken } = require('../middleware/auth');
 const { getDiagnosesBySymptoms, getMedicinesByDiagnoses } = require('../controllers/diagnosisSuggestionController');


const router = express.Router();

// Get diagnoses suggested by symptoms
router.get('/diagnoses/suggest-by-symptoms', authenticateToken, getDiagnosesBySymptoms);

// Get medicines with dosage for given diagnoses
router.get('/medicines/suggest-by-diagnoses', authenticateToken, getMedicinesByDiagnoses);

module.exports = router;
