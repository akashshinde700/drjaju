const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
const clinicalController = require('../controllers/clinicalController');

// Get clinical data
router.get('/', authenticateToken, clinicalController.getClinicalData);

// Get clinical record by ID
router.get('/:id', authenticateToken, clinicalController.getClinicalRecordById);

module.exports = router;
