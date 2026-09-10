const express = require('express');
const router = express.Router();
const snomedController = require('../controllers/snomedController');

// GET /api/snomed/search?q=asthma&limit=10&lang=en
router.get('/search', snomedController.search);

// GET /api/snomed/concepts/195967001
router.get('/concepts/:id', snomedController.getConcept);

// GET /api/snomed/validate/195967001
router.get('/validate/:id', snomedController.validate);

// GET /api/snomed/map/icd10/195967001
router.get('/map/icd10/:id', snomedController.mapToICD10);

// GET /api/snomed/ecl?ecl=<<195967001&limit=50
router.get('/ecl', snomedController.ecl);

module.exports = router;
