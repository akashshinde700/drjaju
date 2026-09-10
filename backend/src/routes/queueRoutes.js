const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const queueController = require('../controllers/queueController_refactored');
const joiValidate = require('../middleware/joiValidate');
const { createQueueEntry, updateQueueEntry } = require('../validation/commonSchemas');

const router = express.Router();

// Create queue entry
router.post('/', joiValidate(createQueueEntry), queueController.addToQueue);

// Get today's queue
router.get('/today', queueController.getTodayQueue);

// Get queue statistics
router.get('/stats', queueController.getQueueStats);

// Get Queue Dashboard summary-card counts (today/followups/completed/upcoming/others)
router.get('/dashboard-stats', queueController.getDashboardStats);

// Update queue status
router.patch('/:id/status', joiValidate(updateQueueEntry), queueController.updateQueueStatus);

// Remove from queue
router.delete('/:id', queueController.removeFromQueue);

module.exports = router;
