const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken, requireRole } = require('../middleware/auth');
const emailController = require('../controllers/emailController');

const router = express.Router();

// Rate limiting for email sending
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Maximum 50 emails per hour
  message: {
    success: false,
    error: 'Too many email requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Test email configuration (admin only)
router.post('/test', authenticateToken, requireRole('admin'), emailController.testEmailConfiguration);

// Send custom email (admin only)
router.post('/send', authenticateToken, requireRole('admin'), emailLimiter, emailController.sendCustomEmail);

// Send appointment confirmation
router.post('/appointment-confirmation', authenticateToken, emailLimiter, emailController.sendAppointmentConfirmation);

// Send appointment reminder
router.post('/appointment-reminder', authenticateToken, emailLimiter, emailController.sendAppointmentReminder);

// Send payment confirmation
router.post('/payment-confirmation', authenticateToken, emailLimiter, emailController.sendPaymentConfirmation);

// Send welcome email
router.post('/welcome', authenticateToken, emailLimiter, emailController.sendWelcomeEmail);

// Send prescription ready notification
router.post('/prescription-ready', authenticateToken, emailLimiter, emailController.sendPrescriptionReady);

// Send test results ready notification
router.post('/test-results-ready', authenticateToken, emailLimiter, emailController.sendTestResultsReady);

// Get email statistics (admin only)
router.get('/stats', authenticateToken, requireRole('admin'), emailController.getEmailStats);

module.exports = router;
