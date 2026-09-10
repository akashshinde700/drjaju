// src/routes/patientRoutes.js
const express = require('express');

const patientController = require('../controllers/patientController');

const {
  getPatientsInQueue,
  updatePatientQueueStatus,
  assignPatientToDoctor
} = require('../controllers/staffDashboardController');
const { listTimeline } = require('../controllers/patientDataController');
const { getComplianceReport } = require('../controllers/complianceController');

// SAHI IMPORT - Destructuring se teeno middleware ek saath
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');

const { validateId } = require('../middleware/validator');
const joiValidate = require('../middleware/joiValidate');
const { createPatient, updatePatient: updatePatientSchema } = require('../validation/patientSchemas');
const { cacheMiddleware } = require('../middleware/cache');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

// SECURITY FIX (2026-07-11): both endpoints previously used optionalAuth, which
// allowed unauthenticated callers to create patients and list/search the entire
// patient database (PHI exposure). Public booking flows use /api/qr/check-patient
// and POST /api/appointment-intents instead, so nothing legitimate breaks.
router.post('/',
  authenticateToken,
  joiValidate(createPatient),
  patientController.addPatient
);

router.get('/', authenticateToken, patientController.listPatients);

// All other routes require authentication
router.use(authenticateToken);

// Dashboard helper endpoints (must be before '/:id')
router.get('/my-patients', requireRole('doctor', 'admin'), patientController.getMyPatientsCount);
router.get('/today', requireRole('staff', 'admin'), patientController.getTodayNewPatientsCount);

// ⚠️ IMPORTANT: /merge and /check-duplicate must come BEFORE /:id routes to avoid conflict
router.post('/merge', requireRole('admin', 'doctor'), auditLogger('PATIENT'), patientController.mergePatients);

// Duplicate patient check (phone + fuzzy name)
router.get('/check-duplicate', patientController.checkDuplicate);

// Queue management endpoints for patients
router.get('/queue', getPatientsInQueue);
router.put('/:id/queue-status', validateId('id'), updatePatientQueueStatus);
router.put('/:id/assign-doctor', validateId('id'), assignPatientToDoctor);

// Get single patient by ID
router.get('/:id', validateId('id'), cacheMiddleware(2 * 60 * 1000), patientController.getPatient);

// Update patient
router.put('/:id',
  validateId('id'),
  joiValidate(updatePatientSchema),
  auditLogger('PATIENT'),
  patientController.updatePatient
);

// Delete patient
router.delete('/:id', validateId('id'), auditLogger('PATIENT'), patientController.deletePatient);

// Patient timeline endpoint
router.get('/:id/timeline', validateId('id'), listTimeline);

// Patient compliance report endpoint
router.get('/:id/compliance-report', validateId('id'), getComplianceReport);

module.exports = router;