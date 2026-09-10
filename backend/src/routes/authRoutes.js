const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, register, verifyToken, refreshToken, logout, verifyCredentials, getMe } = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Brute-force protection for credential endpoints.
// The global limiter (2000 req/15min) is far too loose for password guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Verify credentials (for OTP flow) - returns mobile number
router.post('/verify-credentials', loginLimiter, verifyCredentials);

// Standard login (email + password)
router.post('/login', loginLimiter, login);

// SECURITY FIX (2026-07-11): /register was public and accepted `role` from the
// request body, letting anyone create an admin account. It is only ever called
// from the admin User Management page, so it now requires an admin token.
router.post('/register', authenticateToken, requireRole('admin'), register);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshToken);
router.get('/verify', authenticateToken, verifyToken);
router.get('/me', authenticateToken, getMe);

module.exports = router;
