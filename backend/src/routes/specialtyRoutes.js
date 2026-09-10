// routes/specialtyRoutes.js
const express = require('express');
const router = express.Router();
const specialtyController = require('../controllers/specialtyController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const joiValidate = require('../middleware/joiValidate');
const {
  createCardiologyAssessment,
  updateCardiologyAssessment,
  createPediatricAssessment,
  updatePediatricAssessment,
  createOrthopedicAssessment,
  updateOrthopedicAssessment,
  createOphthalmologyAssessment,
  updateOphthalmologyAssessment
} = require('../validation/commonSchemas');

// All routes require authentication
router.use(authenticateToken);

// =====================================================
// CARDIOLOGY ROUTES
// =====================================================
router.post(
  '/cardiology',
  requireRole('doctor', 'admin'),
  joiValidate(createCardiologyAssessment),
  specialtyController.createCardiologyAssessment
);

router.get(
  '/cardiology/patient/:patientId',
  specialtyController.getCardiologyByPatient
);

router.get(
  '/cardiology/:id',
  specialtyController.getCardiologyById
);

router.put(
  '/cardiology/:id',
  requireRole('doctor', 'admin'),
  joiValidate(updateCardiologyAssessment),
  specialtyController.updateCardiologyAssessment
);

router.delete(
  '/cardiology/:id',
  requireRole('doctor', 'admin'),
  specialtyController.deleteCardiologyAssessment
);

// =====================================================
// PEDIATRICS ROUTES
// =====================================================
router.post(
  '/pediatrics',
  requireRole('doctor', 'admin'),
  joiValidate(createPediatricAssessment),
  specialtyController.createPediatricAssessment
);

router.get(
  '/pediatrics/patient/:patientId',
  specialtyController.getPediatricByPatient
);

router.get(
  '/pediatrics/:id',
  specialtyController.getPediatricById
);

router.put(
  '/pediatrics/:id',
  requireRole('doctor', 'admin'),
  joiValidate(updatePediatricAssessment),
  specialtyController.updatePediatricAssessment
);

router.delete(
  '/pediatrics/:id',
  requireRole('doctor', 'admin'),
  specialtyController.deletePediatricAssessment
);

// =====================================================
// ORTHOPEDICS ROUTES
// =====================================================
router.post(
  '/orthopedics',
  requireRole('doctor', 'admin'),
  joiValidate(createOrthopedicAssessment),
  specialtyController.createOrthopedicAssessment
);

router.get(
  '/orthopedics/patient/:patientId',
  specialtyController.getOrthopedicByPatient
);

router.get(
  '/orthopedics/:id',
  specialtyController.getOrthopedicById
);

router.put(
  '/orthopedics/:id',
  requireRole('doctor', 'admin'),
  joiValidate(updateOrthopedicAssessment),
  specialtyController.updateOrthopedicAssessment
);

router.delete(
  '/orthopedics/:id',
  requireRole('doctor', 'admin'),
  specialtyController.deleteOrthopedicAssessment
);

// =====================================================
// OPHTHALMOLOGY ROUTES
// =====================================================
router.post(
  '/ophthalmology',
  requireRole('doctor', 'admin'),
  joiValidate(createOphthalmologyAssessment),
  specialtyController.createOphthalmologyAssessment
);

router.get(
  '/ophthalmology/patient/:patientId',
  specialtyController.getOphthalmologyByPatient
);

router.get(
  '/ophthalmology/:id',
  specialtyController.getOphthalmologyById
);

router.put(
  '/ophthalmology/:id',
  requireRole('doctor', 'admin'),
  joiValidate(updateOphthalmologyAssessment),
  specialtyController.updateOphthalmologyAssessment
);

router.delete(
  '/ophthalmology/:id',
  requireRole('doctor', 'admin'),
  specialtyController.deleteOphthalmologyAssessment
);

// =====================================================
// UNIFIED / GENERAL ROUTES
// =====================================================
router.get(
  '/:specialtyType/prescription/:prescriptionId',
  specialtyController.getSpecialtyAssessmentByPrescription
);

router.get(
  '/all/patient/:patientId',
  specialtyController.getAllAssessmentsByPatient
);

module.exports = router;