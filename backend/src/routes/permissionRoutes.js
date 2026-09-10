const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const permissionController = require('../controllers/permissionController');

const router = express.Router();

router.get('/', authenticateToken, requireRole('admin'), permissionController.getAllPermissions);
router.get('/me', authenticateToken, permissionController.getUserPermissions);

module.exports = router;

