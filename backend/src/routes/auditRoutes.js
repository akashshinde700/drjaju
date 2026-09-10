const express = require('express');
const auditController = require('../controllers/auditController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get audit logs (admin only)
router.get('/', authenticateToken, auditController.getAuditLogs);

// Get audit log details
router.get('/:id', authenticateToken, auditController.getAuditLogById);

module.exports = router;