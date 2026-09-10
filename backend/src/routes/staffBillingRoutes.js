const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const staffBillingController = require('../controllers/staffBillingController');


const router = express.Router();

// Get completed visits for billing
router.get('/completed-visits', authenticateToken, staffBillingController.getCompletedVisits);

// Create bill from visit
router.post('/create-bill', authenticateToken, auditLogger('BILL'), staffBillingController.createBillFromVisit);

module.exports = router;
