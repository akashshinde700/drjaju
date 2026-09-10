// backend/src/routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const exportRoutesController = require('../controllers/exportRoutesController');
const exportRoutesFormatsController = require('../controllers/exportRoutesFormatsController');

// Auth enforced by app.js before this router

/**
 * @route   GET /api/export/patient/:id
 * @query   format=json|pdf|excel
 * @query   allPatients=true|false (optional, for doctor's all patients)
 * @query   doctorId=integer (optional, to filter patients by doctor)
 * @desc    Export patient data in specified format
 */
router.get('/patient/:id', exportRoutesController.exportPatient);

/**
 * @route   GET /api/export/all-patients
 * @query   format=json|pdf|excel
 * @query   doctorId=integer (optional, filter by doctor)
 * @desc    Export all patients data
 */
router.get('/all-patients', exportRoutesController.exportAllPatients);

/**
 * @route   GET /api/export/formats
 * @desc    Get available export formats
 */
router.get('/formats', exportRoutesFormatsController.getFormats);

module.exports = router;
