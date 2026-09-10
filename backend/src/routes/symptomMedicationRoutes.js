const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const symptomMedicationController = require('../controllers/symptomMedicationController');

const router = express.Router();

// Public route for getting medication suggestions (used by prescription pad)
router.get('/suggestions', symptomMedicationController.getMedicationSuggestions);

// Protected routes for managing mappings (admin/doctor only)
router.get('/', authenticateToken, symptomMedicationController.getAllMappings);
router.post('/', authenticateToken, requireRole('admin', 'doctor'), symptomMedicationController.addMapping);
router.delete('/:id', authenticateToken, requireRole('admin', 'doctor'), symptomMedicationController.deleteMapping);

module.exports = router;
