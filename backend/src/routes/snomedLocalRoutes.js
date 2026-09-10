/**
 * SNOMED CT Local Database Routes
 *
 * API routes for SNOMED CT data stored in local MySQL database.
 */

const express = require('express');
const router = express.Router();
const snomedLocalController = require('../controllers/snomedLocalController');

// Search endpoints
// GET /api/snomed-local/search?q=diabetes&limit=20&semanticTag=disorder&source=INT
router.get('/search', snomedLocalController.search);

// GET /api/snomed-local/drugs?q=paracetamol&limit=20
router.get('/drugs', snomedLocalController.searchDrugs);

// GET /api/snomed-local/ayush?q=ashwagandha&category=Ayurveda
router.get('/ayush', snomedLocalController.searchAyush);

// Concept endpoints
// GET /api/snomed-local/concepts/:id
router.get('/concepts/:id', snomedLocalController.getConcept);

// GET /api/snomed-local/concepts/:id/parents
router.get('/concepts/:id/parents', snomedLocalController.getParents);

// GET /api/snomed-local/concepts/:id/children
router.get('/concepts/:id/children', snomedLocalController.getChildren);

// Validation
// GET /api/snomed-local/validate/:id
router.get('/validate/:id', snomedLocalController.validate);

// ICD-10 mapping
// GET /api/snomed-local/map/icd10/:id
router.get('/map/icd10/:id', snomedLocalController.mapToICD10);

// Utility endpoints
// GET /api/snomed-local/semantic-tags
router.get('/semantic-tags', snomedLocalController.getSemanticTags);

// GET /api/snomed-local/stats
router.get('/stats', snomedLocalController.getImportStats);

module.exports = router;
