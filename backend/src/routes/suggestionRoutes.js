/**
 * Suggestion Routes
 * API routes for getting symptom-based medication, diagnosis, and dosage suggestions
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

const suggestionController = require('../controllers/suggestionController_refactored');

/**
 * @route POST /api/suggestions/symptom-based
 * @desc Get medications and diagnoses based on symptoms
 * @access Private
 * @body {
 *   symptoms: string[],
 *   patient_id?: number,
 *   age?: number,
 *   gender?: 'M' | 'F' | 'O' | 'U',
 *   patient_weight?: number,
 *   allergies?: string[],
 *   limit?: number
 * }
 */
router.post('/symptom-based', authenticateToken, suggestionController.getSymptomBasedSuggestions);

/**
 * @route GET /api/suggestions/diagnosis/:icd_code
 * @desc Get medications and dosages for a specific diagnosis
 * @access Private
 * @param {string} icd_code - ICD-10 code
 * @query {
 *   patient_id?: number,
 *   age?: number,
 *   gender?: 'M' | 'F' | 'O' | 'U',
 *   weight?: number,
 *   limit?: number
 * }
 */
router.get('/diagnosis/:icd_code', authenticateToken, suggestionController.getDiagnosisMedicationsAndDosages);

/**
 * @route POST /api/suggestions/prescription
 * @desc Get complete prescription suggestion with symptoms and diagnoses
 * @access Private
 * @body {
 *   symptoms: string[],
 *   diagnoses: string[],
 *   patient_id?: number,
 *   age?: number,
 *   gender?: string,
 *   weight?: number,
 *   allergies?: string[],
 *   limit?: number
 * }
 */
router.post('/prescription', authenticateToken, suggestionController.getPrescriptionSuggestion);

/**
 * @route POST /api/suggestions/integrated-prescription
 * @desc Get COMPREHENSIVE integrated suggestions: symptoms → diagnosis → medicines + injections with dosages
 * @desc Combines everything: symptoms, ICD codes, diagnosis names, medicines, injections, and proper dosages
 * @access Private
 * @body {
 *   symptoms: string[] - REQUIRED: Patient symptoms (e.g., ["fever", "cough"])
 *   icd_codes?: string[] - Optional: ICD-10 codes (e.g., ["J06.9", "I10"])
 *   diagnosis_names?: string[] - Optional: Diagnosis names
 *   patient_id?: number,
 *   age?: number - Patient age for age-based dosing
 *   gender?: string,
 *   weight?: number - Patient weight for weight-based dosing calculations
 *   allergies?: string[] - Drug allergies to exclude from suggestions
 *   limit?: number - Max results (default: 20, max: 100)
 * }
 * @returns {
 *   request: { symptoms, diagnoses, patient_age, patient_weight },
 *   suggestions: {
 *     diagnoses: [{ icd_code, diagnosis_name, confidence_score }],
 *     medicines: [{ id, name, brand, form, standard_dosage, frequency, duration, is_first_line, ... }],
 *     injections: [{ similar structure }],
 *     total_suggestions: { diagnoses, medicines, injections }
 *   },
 *   ready_for_prescription: boolean
 * }
 * @example
 * POST /api/suggestions/integrated-prescription
 * {
 *   "symptoms": ["fever", "cough", "body pain"],
 *   "age": 45,
 *   "weight": 70,
 *   "allergies": ["penicillin"]
 * }
 * 
 * Response includes:
 * - Likely diagnoses (with ICD codes)
 * - Tablet medicines with dosages
 * - Injectable medicines with dosages
 * - Age/weight-adjusted recommendations
 * - First-line vs alternative medicines
 */
router.post('/integrated-prescription', authenticateToken, suggestionController.getIntegratedPrescriptionSuggestions);

module.exports = router;
