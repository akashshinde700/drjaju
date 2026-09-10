const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const customLabTestsController = require('../controllers/customLabTestsController');

const router = express.Router();

// GET /api/custom-lab-tests?patientId=123 - Get all custom lab tests for a patient
router.get('/', authenticateToken, customLabTestsController.getCustomLabTests);

// POST /api/custom-lab-tests - Add a new custom lab test
router.post('/', authenticateToken, customLabTestsController.addCustomLabTest);

// PUT /api/custom-lab-tests/:id - Update a custom lab test
router.put('/:id', authenticateToken, customLabTestsController.updateCustomLabTest);

// DELETE /api/custom-lab-tests/:id - Delete a custom lab test
router.delete('/:id', authenticateToken, customLabTestsController.deleteCustomLabTest);

module.exports = router;
