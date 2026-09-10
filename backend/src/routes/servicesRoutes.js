const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const servicesController = require('../controllers/servicesController');

const router = express.Router();

// Get all services for a clinic
router.get('/', authenticateToken, servicesController.getServices);

// Get service by ID
router.get('/:id', authenticateToken, servicesController.getServiceById);

module.exports = router;
