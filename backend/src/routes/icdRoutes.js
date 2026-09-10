// backend/src/routes/icdRoutes.js
const express = require('express');
const router = express.Router();

const { requireRole } = require('../middleware/auth');
const icdController = require('../controllers/icdController');

// Auth enforced by app.js before this router

// GET /api/icd/search?q=fever&version=icd11&chapter=mms&linearization=2024-01
router.get('/search', icdController.searchICD);

// GET /api/icd/code/:id?version=icd11|icd10
router.get('/code/:id', icdController.getICDCode);

// Admin-only bulk refresh of ICD dataset
// POST /api/icd/admin/refresh?version=icd10|icd11
router.post('/admin/refresh', requireRole('admin'), icdController.refreshICDData);

// Get related symptoms, diagnoses, and medications for an ICD code (DB-driven)
// GET /api/icd/:code/related?limit=20
router.get('/:code/related', icdController.getICDRelated);

// Get medications suggested for an ICD code (DB-driven)
// GET /api/icd/:code/medications
router.get('/:code/medications', icdController.getICDMedications);

module.exports = router;
