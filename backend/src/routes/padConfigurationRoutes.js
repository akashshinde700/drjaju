/**
 * Pad Configuration Routes
 * Routes for prescription pad settings and customization
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const padConfigurationController = require('../controllers/padConfigurationController');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/pad-config
 * @desc Get prescription pad configuration for current doctor
 * @access Private
 */
router.get('/', padConfigurationController.getPadConfiguration);

/**
 * @route GET /api/pad-config/print-layout
 * @desc Page margins + pre-printed letterhead padding used when rendering PDFs
 * @access Private
 */
router.get('/print-layout', padConfigurationController.getPrintLayout);

/**
 * @route POST /api/pad-config/print-layout
 * @desc Save the print layout so it takes effect on every generated PDF
 * @access Private
 */
router.post('/print-layout', padConfigurationController.savePrintLayout);

/**
 * @route POST /api/pad-config
 * @desc Save/Update prescription pad configuration
 * @access Private
 */
router.post('/', padConfigurationController.savePadConfiguration);

/**
 * @route POST /api/pad-config/field-order
 * @desc Save field order and section configuration
 * @access Private
 */
router.post('/field-order', padConfigurationController.saveFieldOrder);

/**
 * @route GET /api/pad-config/patient-history/:patientId
 * @desc Get patient medical history summary for prescription pad
 * @access Private
 */
router.get('/patient-history/:patientId', padConfigurationController.getPatientHistoryForPad);

/**
 * @route POST /api/pad-config/chronic-condition/:patientId
 * @desc Add chronic condition to patient
 * @access Private
 */
router.post('/chronic-condition/:patientId', padConfigurationController.addChronicCondition);

/**
 * @route POST /api/pad-config/surgical-history/:patientId
 * @desc Add surgical history to patient
 * @access Private
 */
router.post('/surgical-history/:patientId', padConfigurationController.addSurgicalHistory);

module.exports = router;
