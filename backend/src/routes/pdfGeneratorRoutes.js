// =====================================================
// PDF GENERATOR ROUTES
// Purpose: Routes for generating PDFs
// =====================================================

const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfGeneratorController');
const { authenticateToken } = require('../middleware/auth');

// =====================================================
// PUBLIC ROUTES (no authentication required for sharing via QR, WhatsApp, Email)
// =====================================================

/**
 * @route GET /api/pdf/lab-report/:patientId
 * @desc Generate PDF for lab results (optionally filtered by report_group)
 * @access Public (for sharing via WhatsApp, QR, Email)
 * @query report_group - optional filter for specific report group
 * @returns PDF file
 */
router.get('/lab-report/:patientId', pdfController.generateLabReportPDF);

/**
 * @route GET /api/pdf/prescription/:prescriptionId
 * @desc Generate PDF for a prescription
 * @access Public (for sharing via WhatsApp, QR, Email)
 * @returns PDF file
 */
router.get('/prescription/:prescriptionId', pdfController.generatePrescriptionPDF);

/**
 * @route GET /api/pdf/bill/:billId
 * @desc Generate PDF for a bill/invoice
 * @access Public (for sharing via WhatsApp, QR, Email)
 * @returns PDF file
 */
router.get('/bill/:billId', pdfController.generateBillingPDF);

// All remaining routes require authentication
router.use(authenticateToken);

// =====================================================
// MEDICAL CERTIFICATE PDF
// =====================================================

/**
 * @route GET /api/pdf/certificate/:certificateId
 * @desc Generate PDF for a medical certificate
 * @access Private (Authenticated users)
 * @returns PDF file
 */
router.get('/certificate/:certificateId', pdfController.generateCertificatePDF);

// =====================================================
// REFERRAL PDF
// =====================================================

/**
 * @route GET /api/pdf/referral/:referralId
 * @desc Generate PDF for a referral letter
 * @access Private (Authenticated users)
 * @returns PDF file
 */
router.get('/referral/:referralId', pdfController.generateReferralPDF);

module.exports = router;
