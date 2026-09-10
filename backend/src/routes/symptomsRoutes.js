/**
 * Symptoms Routes
 * Searches symptoms from:
 *  - snomed_clinical_findings (finding_type='Symptom') - clinical findings
 *  - symptom_medication_mapping - symptoms with medications
 */

const express = require('express');
const router = express.Router();
const symptomsController = require('../controllers/symptomsController');

// Auth enforced by app.js before this router

router.get('/search', symptomsController.searchSymptoms);
router.get('/:symptom/medications', symptomsController.getMedicationsBySymptom);
router.get('/:symptom/related', symptomsController.getRelatedDiagnoses);
router.post('/', symptomsController.saveCustomSymptom);

module.exports = router;
