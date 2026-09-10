const express = require('express');
const router = express.Router();
const controller = require('../controllers/qrController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/availability/:doctorId', controller.getDoctorAvailability);
router.get('/doctor/:doctorId', controller.getDoctorQRInfo);
router.get('/check-patient', controller.checkPatientExists);
router.post('/book/:doctorId', controller.bookViaQR);

// Protected routes (authentication required)
router.use(authenticateToken);

// POST /api/qr/generate/:doctorId - Generate QR code for doctor
router.post('/generate/:doctorId', controller.generateDoctorQR);

// GET /api/qr/all - Get all QR codes (admin only)
router.get('/all', requireRole('admin'), controller.getAllQRCodes);

// PUT /api/qr/toggle/:doctorId - Toggle QR code active status
router.put('/toggle/:doctorId', requireRole('admin'), controller.toggleQRStatus);

module.exports = router;
