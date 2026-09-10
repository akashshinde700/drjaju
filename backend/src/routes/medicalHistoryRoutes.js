/**
 * Medical History Routes
 * Routes for configurable patient medical history in prescription pad
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/medicalHistoryController');

// All routes require authentication
router.use(authenticateToken);

// =====================================================
// CONFIGURATION ROUTES
// =====================================================

/**
 * @route GET /api/medical-history/options
 * @desc Get all medical history options (master list)
 * @access Private
 */
router.get('/options', controller.getMedicalHistoryOptions);

/**
 * @route POST /api/medical-history/options
 * @desc Add custom medical history option
 * @access Private
 */
router.post('/options', controller.addCustomOption);

/**
 * @route POST /api/medical-history/configure
 * @desc Save doctor's configuration for which options to show
 * @access Private
 */
router.post('/configure', controller.saveDoctorConfiguration);

// =====================================================
// PATIENT HISTORY ROUTES
// =====================================================

/**
 * @route GET /api/medical-history/patient/:patientId
 * @desc Get patient's complete medical history for prescription pad
 * @access Private
 */
router.get('/patient/:patientId', controller.getPatientMedicalHistory);

/**
 * @route POST /api/medical-history/patient/:patientId
 * @desc Save patient's medical history selections (bulk)
 * @access Private
 */
router.post('/patient/:patientId', controller.savePatientMedicalHistory);

/**
 * @route PUT /api/medical-history/patient/:patientId/toggle
 * @desc Toggle single condition for patient (Y/N)
 * @access Private
 */
router.put('/patient/:patientId/toggle', controller.togglePatientCondition);

/**
 * @route POST /api/medical-history/patient/:patientId/existing-condition
 * @desc Add existing condition (chronic condition)
 * @access Private
 */
router.post('/patient/:patientId/existing-condition', controller.addExistingCondition);

/**
 * @route DELETE /api/medical-history/patient/:patientId/existing-condition/:conditionId
 * @desc Delete existing condition
 * @access Private
 */
router.delete('/patient/:patientId/existing-condition/:conditionId', controller.deleteExistingCondition);

/**
 * @route POST /api/medical-history/patient/:patientId/surgical-procedure
 * @desc Add surgical procedure
 * @access Private
 */
router.post('/patient/:patientId/surgical-procedure', controller.addSurgicalProcedure);

/**
 * @route DELETE /api/medical-history/patient/:patientId/surgical-procedure/:procedureId
 * @desc Delete surgical procedure
 * @access Private
 */
router.delete('/patient/:patientId/surgical-procedure/:procedureId', controller.deleteSurgicalProcedure);

module.exports = router;
