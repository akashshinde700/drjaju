// =====================================================
// MY GENIE ROUTES
// AI-Powered Medical Assistant Routes
// =====================================================

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const joiValidate = require('../middleware/joiValidate');
const { analyzeSymptoms: analyzeSymptomsSchema, applySuggestion: applySuggestionSchema } = require('../validation/commonSchemas');

const myGenieController = require('../controllers/myGenieController');

/**
 * @route POST /api/my-genie/analyze
 * @desc Analyze symptoms and get diagnosis suggestions
 * @access Private (Authenticated users)
 * @body { symptoms: [], patient_id, age, gender, medical_history, allergies, language }
 */
router.post('/analyze', authenticateToken, joiValidate(analyzeSymptomsSchema), myGenieController.analyzeSymptoms);

/**
 * @route GET /api/my-genie/suggestion/:id
 * @desc Get details of a specific suggestion
 * @access Private (Authenticated users)
 */
router.get('/suggestion/:id', authenticateToken, myGenieController.getSuggestionDetails);

/**
 * @route POST /api/my-genie/apply/:suggestionId
 * @desc Apply a suggestion to a prescription
 * @access Private (Authenticated users)
 * @body { prescription_id }
 */
router.post('/apply/:suggestionId', authenticateToken, joiValidate(applySuggestionSchema), myGenieController.applySuggestion);

/**
 * @route GET /api/my-genie/history/:patientId
 * @desc Get analysis history for a patient
 * @access Private (Authenticated users)
 * @query { limit: 10 }
 */
router.get('/history/:patientId', authenticateToken, myGenieController.getAnalysisHistory);

module.exports = router;
