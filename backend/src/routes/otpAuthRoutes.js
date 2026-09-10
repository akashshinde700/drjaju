const express = require('express');
const rateLimit = require('express-rate-limit');
const otpAuthController = require('../controllers/otpAuthController');

const router = express.Router();

// Rate limiting for OTP requests
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 OTP requests per 15 minutes
  message: {
    success: false,
    error: 'Too many OTP requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for OTP verification
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 verification attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many verification attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request OTP for doctor login
router.post('/request', otpLimiter, otpAuthController.requestOtp);

// Send OTP after credential verification (new flow)
router.post('/send', otpLimiter, otpAuthController.sendOtp);

// Verify OTP for doctor login (using otpId)
router.post('/verify-doctor', verifyLimiter, otpAuthController.verifyDoctor);

// Verify OTP (for new credential-based login flow)
router.post('/verify', verifyLimiter, otpAuthController.verify);

// Check OTP status
router.get('/status/:otpId', otpAuthController.status);

// Resend OTP
router.post('/resend', otpLimiter, otpAuthController.resend);

module.exports = router;
