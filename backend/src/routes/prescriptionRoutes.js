// src/routes/prescriptionRoutes.js
const express = require('express');
const { getDb } = require('../config/db');

const prescriptionController = require('../controllers/prescriptionController');

const {
  saveDraft,
  getDraft,
  deleteDraft,
  listDrafts
} = require('../controllers/prescriptionDraftController');

// ✅ SAHI IMPORT - Destructuring se authenticateToken le rahe hain
const { authenticateToken } = require('../middleware/auth');
const { validateId } = require('../middleware/validator');

const { auditLogger } = require('../middleware/auditLogger');
const joiValidate = require('../middleware/joiValidate');
const { createPrescription, updatePrescription, saveDiagnoses } = require('../validation/prescriptionSchemas');

const router = express.Router();

// Public routes (no auth required)
router.get('/pdf/:prescriptionId', prescriptionController.generatePrescriptionPDF);
router.get('/view/:id', prescriptionController.getPublicPrescriptionView);

// All other routes require authentication
router.use(authenticateToken);

// Draft routes (must be before other routes to avoid conflicts)
router.get('/drafts', listDrafts);
router.get('/draft', getDraft);
router.post('/draft', saveDraft);
router.delete('/draft/:id', validateId('id'), deleteDraft);

// Collection search (date range + optional filters)
router.get('/', prescriptionController.searchPrescriptions);

// Dashboard helper
router.get('/recent', prescriptionController.getRecentPrescriptionsCount);

// Get prescription detail by ID
router.get('/detail/:id', validateId('id'), prescriptionController.getPrescription);
router.delete('/detail/:id', validateId('id'), auditLogger('PRESCRIPTION'), prescriptionController.deletePrescription);

// ICD diagnoses for a prescription (define BEFORE generic routes)
router.get('/detail/:id/diagnoses', validateId('id'), prescriptionController.getPrescriptionDiagnoses);
router.post('/detail/:id/diagnoses', validateId('id'), joiValidate(saveDiagnoses), auditLogger('PRESCRIPTION'), prescriptionController.savePrescriptionDiagnoses);

// Add medications to existing prescription
router.post('/:prescriptionId/add-medications', validateId('prescriptionId'), auditLogger('PRESCRIPTION'), prescriptionController.addMedicationsToPrescription);

// Get last prescription for a patient
router.get('/patient/:patientId/latest-id', validateId('patientId'), prescriptionController.getLatestPrescriptionId);
router.get('/patient/:patientId/last', validateId('patientId'), prescriptionController.getLastPrescription);

// List all prescriptions for a patient
router.get('/:patientId', validateId('patientId'), prescriptionController.listPrescriptions);

// Create new prescription
router.post('/', joiValidate(createPrescription), auditLogger('PRESCRIPTION'), prescriptionController.addPrescription);

// End patient visit without prescription
router.post('/end-visit', auditLogger('PRESCRIPTION'), prescriptionController.endVisit);

// Share a prescription (WhatsApp link / QR code / email the public view link)
router.post('/:prescriptionId/share', prescriptionController.sharePrescription);
router.get('/:prescriptionId/share-options', prescriptionController.getShareOptions);

module.exports = router;