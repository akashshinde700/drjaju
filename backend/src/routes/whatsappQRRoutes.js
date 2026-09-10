const express = require('express');
const router = express.Router();
const whatsappQRController = require('../controllers/whatsappQRController');
const { authenticateToken } = require('../middleware/auth');

// =====================================================
// WHATSAPP VERIFICATION ROUTES
// =====================================================

// Verify individual endpoints
router.post('/verify/appointment-reminder', authenticateToken, whatsappQRController.verifyAppointmentReminder);
router.post('/verify/followup-reminder', authenticateToken, whatsappQRController.verifyFollowupReminder);
router.post('/verify/receipt', authenticateToken, whatsappQRController.verifyReceiptSharing);
router.post('/verify/prescription', authenticateToken, whatsappQRController.verifyPrescriptionSharing);
router.post('/verify/qr-code', authenticateToken, whatsappQRController.verifyQRCodeSharing);

// Run all verifications
router.post('/verify/all', authenticateToken, whatsappQRController.runAllVerifications);

// Get and clear logs
router.get('/logs', authenticateToken, whatsappQRController.getVerificationLogs);
router.delete('/logs', authenticateToken, whatsappQRController.clearVerificationLogs);

// =====================================================
// DOCTOR QR CODE ROUTES
// =====================================================

// Generate QR codes
router.post('/doctor', authenticateToken, whatsappQRController.generateDoctorQRCode);
router.post('/bulk', authenticateToken, whatsappQRController.generateBulkQRCodes);
router.post('/branded', authenticateToken, whatsappQRController.generateBrandedQRCode);

// Generate for specific channels
router.post('/whatsapp', authenticateToken, whatsappQRController.generateQRCodeForWhatsApp);
router.post('/email', authenticateToken, whatsappQRController.generateQRCodeForEmail);
router.post('/download', authenticateToken, whatsappQRController.generateQRCodeDownloadLink);

// Registration flow
router.post('/registration', authenticateToken, whatsappQRController.generateQRCodeWithRegistration);

// Validation and analytics
router.get('/validate/:token', authenticateToken, whatsappQRController.validateQRCodeToken);
router.get('/analytics/:doctorId', authenticateToken, whatsappQRController.getQRCodeAnalytics);

module.exports = router;
