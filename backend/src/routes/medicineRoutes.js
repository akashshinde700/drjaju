/**
 * Medicine Search & Suggestions API
 * Searches from:
 *  - medicines table (92 entries, doctor-specific ranking)
 *  - dosage_references (98 entries with full dosage info)
 *  - medicines_consolidated (761,764 Indian brand medicines) ← NEW!
 *  - snomed_medications (47K+ entries)
 */

const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');

// Auth enforced by app.js before this router

/**
 * Search medicines with intelligent ranking from ALL sources
 * GET /api/medicines/search?q=paracetamol&limit=20
 */
router.get('/search', medicineController.searchMedicines);

/**
 * Get dosage info for a medicine by name
 * GET /api/medicines/dosage?name=Paracetamol
 */
router.get('/dosage', medicineController.getDosageInfo);

/**
 * Get medicines suggested for a diagnosis (ICD code)
 * GET /api/medicines/for-diagnosis/:icd_code?limit=8
 */
router.get('/for-diagnosis/:icd_code', medicineController.getMedicinesForDiagnosis);

/**
 * Get doctor's frequently used medicines
 * GET /api/medicines/frequent?limit=12
 */
router.get('/frequent', medicineController.getFrequentMedicines);

/**
 * Get medicine defaults by ID
 * GET /api/medicines/:id/defaults
 */
router.get('/:id/defaults', medicineController.getMedicineDefaultsById);

/**
 * Get recent medicines for patient
 * GET /api/medicines/patient/:patientId/recent
 */
router.get('/patient/:patientId/recent', medicineController.getRecentMedicinesForPatient);

/**
 * Create a custom medicine (auto-save from prescription pad)
 * POST /api/medicines
 */
router.post('/', medicineController.createCustomMedicine);

/**
 * Save medicine defaults (dosage, frequency, timing, duration, instructions) for a doctor
 * POST /api/medicines/defaults
 */
router.post('/defaults', medicineController.saveMedicineDefaults);

/**
 * Get medicine defaults for a doctor
 * GET /api/medicines/my-defaults?name=Paracetamol
 */
router.get('/my-defaults', medicineController.getMyDefaults);

/**
 * Medicine Master: list all local medicines with optional search/pagination
 * GET /api/medicines/master?page=1&limit=20&search=para
 */
router.get('/master', medicineController.listMasterMedicines);

/**
 * Medicine Master: update a medicine
 * PUT /api/medicines/:id
 */
router.put('/:id', medicineController.updateMedicine);

/**
 * Medicine Master: soft-delete a medicine
 * DELETE /api/medicines/:id
 */
router.delete('/:id', medicineController.deleteMedicine);

module.exports = router;
