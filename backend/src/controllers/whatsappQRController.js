/**
 * WhatsApp & QR Code Controller
 * Handles WhatsApp verification and Doctor QR code generation
 */

const whatsappVerificationService = require('../services/whatsappVerificationService');
const doctorQRCodeService = require('../services/doctorQRCodeService');
const { ApiError, ApiResponse, asyncHandler } = require('../utils');

// =====================================================
// WHATSAPP VERIFICATION ENDPOINTS
// =====================================================

/**
 * Verify appointment reminder endpoint
 * POST /api/whatsapp/verify/appointment-reminder
 */
exports.verifyAppointmentReminder = async (req, res) => {
  const appointmentData = req.body;

  const result = await whatsappVerificationService.verifyAppointmentReminder(appointmentData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to verify appointment reminder');
  }

  res.json(ApiResponse.success(result, 'Appointment reminder verified'));
};

exports.verifyAppointmentReminder = asyncHandler(exports.verifyAppointmentReminder);

/**
 * Verify follow-up reminder endpoint
 * POST /api/whatsapp/verify/followup-reminder
 */
exports.verifyFollowupReminder = async (req, res) => {
  const followupData = req.body;

  const result = await whatsappVerificationService.verifyFollowupReminder(followupData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to verify follow-up reminder');
  }

  res.json(ApiResponse.success(result, 'Follow-up reminder verified'));
};

exports.verifyFollowupReminder = asyncHandler(exports.verifyFollowupReminder);

/**
 * Verify receipt sharing endpoint
 * POST /api/whatsapp/verify/receipt
 */
exports.verifyReceiptSharing = async (req, res) => {
  const receiptData = req.body;

  const result = await whatsappVerificationService.verifyReceiptSharing(receiptData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to verify receipt sharing');
  }

  res.json(ApiResponse.success(result, 'Receipt sharing verified'));
};

exports.verifyReceiptSharing = asyncHandler(exports.verifyReceiptSharing);

/**
 * Verify prescription sharing endpoint
 * POST /api/whatsapp/verify/prescription
 */
exports.verifyPrescriptionSharing = async (req, res) => {
  const prescriptionData = req.body;

  const result = await whatsappVerificationService.verifyPrescriptionSharing(prescriptionData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to verify prescription sharing');
  }

  res.json(ApiResponse.success(result, 'Prescription sharing verified'));
};

exports.verifyPrescriptionSharing = asyncHandler(exports.verifyPrescriptionSharing);

/**
 * Verify QR code sharing endpoint
 * POST /api/whatsapp/verify/qr-code
 */
exports.verifyQRCodeSharing = async (req, res) => {
  const qrData = req.body;

  const result = await whatsappVerificationService.verifyQRCodeSharing(qrData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to verify QR code sharing');
  }

  res.json(ApiResponse.success(result, 'QR code sharing verified'));
};

exports.verifyQRCodeSharing = asyncHandler(exports.verifyQRCodeSharing);

/**
 * Run all WhatsApp verifications
 * POST /api/whatsapp/verify/all
 */
exports.runAllVerifications = async (req, res) => {
  const testData = req.body;
  if (!testData?.appointment || !testData?.followup || !testData?.receipt || !testData?.prescription || !testData?.qrCode) {
    throw ApiError.badRequest('Missing test data for one or more endpoints');
  }

  const results = await whatsappVerificationService.runAllVerifications(testData);
  res.json(ApiResponse.success(results, 'All WhatsApp endpoints verified'));
};

exports.runAllVerifications = asyncHandler(exports.runAllVerifications);

/**
 * Get WhatsApp verification logs
 * GET /api/whatsapp/logs
 */
exports.getVerificationLogs = async (req, res) => {
  const { limit = 100 } = req.query;
  const logs = whatsappVerificationService.getVerificationLogs(parseInt(limit, 10));
  res.json(ApiResponse.success({ total: logs.length, logs }, 'Verification logs'));
};

exports.getVerificationLogs = asyncHandler(exports.getVerificationLogs);

/**
 * Clear WhatsApp verification logs
 * DELETE /api/whatsapp/logs
 */
exports.clearVerificationLogs = async (req, res) => {
  const cleared = whatsappVerificationService.clearVerificationLogs();
  if (!cleared) {
    throw ApiError.badRequest('No logs to clear');
  }
  res.json(ApiResponse.success(null, 'Verification logs cleared'));
};

exports.clearVerificationLogs = asyncHandler(exports.clearVerificationLogs);

// =====================================================
// DOCTOR QR CODE ENDPOINTS
// =====================================================

/**
 * Generate doctor QR code
 * POST /api/qr-code/doctor
 */
exports.generateDoctorQRCode = async (req, res) => {
  const doctorData = req.body;
  const options = req.query;

  const result = doctorQRCodeService.generateDoctorQRCode(doctorData, options);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to generate doctor QR code');
  }

  res.json(ApiResponse.success(result, 'Doctor QR code generated'));
};

exports.generateDoctorQRCode = asyncHandler(exports.generateDoctorQRCode);

/**
 * Generate bulk QR codes for multiple doctors
 * POST /api/qr-code/bulk
 */
exports.generateBulkQRCodes = async (req, res) => {
  const { doctors } = req.body;
  const options = req.query;

  if (!doctors || !Array.isArray(doctors)) {
    throw ApiError.badRequest('Doctors array is required');
  }

  const results = doctorQRCodeService.generateBulkQRCodes(doctors, options);
  res.json(ApiResponse.success(results, 'Bulk QR codes generated'));
};

exports.generateBulkQRCodes = asyncHandler(exports.generateBulkQRCodes);

/**
 * Generate branded QR code
 * POST /api/qr-code/branded
 */
exports.generateBrandedQRCode = async (req, res) => {
  const { doctorData, brandingOptions } = req.body;
  const result = doctorQRCodeService.generateBrandedQRCode(doctorData, brandingOptions);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to generate branded QR code');
  }
  res.json(ApiResponse.success(result, 'Branded QR code generated'));
};

exports.generateBrandedQRCode = asyncHandler(exports.generateBrandedQRCode);

/**
 * Generate QR code for WhatsApp sharing
 * POST /api/qr-code/whatsapp
 */
exports.generateQRCodeForWhatsApp = async (req, res) => {
  const doctorData = req.body;
  const result = doctorQRCodeService.generateQRCodeForWhatsApp(doctorData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to generate QR code for WhatsApp');
  }
  res.json(ApiResponse.success(result, 'QR code for WhatsApp generated'));
};

exports.generateQRCodeForWhatsApp = asyncHandler(exports.generateQRCodeForWhatsApp);

/**
 * Generate QR code for email sharing
 * POST /api/qr-code/email
 */
exports.generateQRCodeForEmail = async (req, res) => {
  const doctorData = req.body;
  const result = doctorQRCodeService.generateQRCodeForEmail(doctorData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to generate QR code for email');
  }
  res.json(ApiResponse.success(result, 'QR code for email generated'));
};

exports.generateQRCodeForEmail = asyncHandler(exports.generateQRCodeForEmail);

/**
 * Generate QR code download link
 * POST /api/qr-code/download
 */
exports.generateQRCodeDownloadLink = async (req, res) => {
  const { doctorData, format = 'png' } = req.body;
  const result = doctorQRCodeService.generateQRCodeDownloadLink(doctorData, format);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to generate QR code download link');
  }
  res.json(ApiResponse.success(result, 'QR code download link generated'));
};

exports.generateQRCodeDownloadLink = asyncHandler(exports.generateQRCodeDownloadLink);

/**
 * Generate QR code with new patient registration
 * POST /api/qr-code/registration
 */
exports.generateQRCodeWithRegistration = async (req, res) => {
  const doctorData = req.body;
  const result = doctorQRCodeService.generateQRCodeWithRegistration(doctorData);
  if (!result?.success) {
    throw ApiError.badRequest(result?.error || 'Failed to generate QR code with registration');
  }
  res.json(ApiResponse.success(result, 'QR code with registration flow generated'));
};

exports.generateQRCodeWithRegistration = asyncHandler(exports.generateQRCodeWithRegistration);

/**
 * Validate QR code token
 * GET /api/qr-code/validate/:token
 */
exports.validateQRCodeToken = async (req, res) => {
  const { token } = req.params;
  const result = doctorQRCodeService.validateQRCodeToken(token);

  if (!result?.valid) {
    throw ApiError.badRequest(result?.error || 'Invalid QR code token');
  }

  res.json(ApiResponse.success(result, 'QR code token is valid'));
};

exports.validateQRCodeToken = asyncHandler(exports.validateQRCodeToken);

/**
 * Get QR code analytics
 * GET /api/qr-code/analytics/:doctorId
 */
exports.getQRCodeAnalytics = async (req, res) => {
  const { doctorId } = req.params;
  const { doctorName, scans = 0, conversions = 0 } = req.query;

  const result = doctorQRCodeService.generateQRCodeAnalytics({
    doctorId,
    doctorName,
    scans: parseInt(scans, 10),
    conversions: parseInt(conversions, 10),
  });

  res.json(ApiResponse.success(result, 'QR code analytics retrieved'));
};

exports.getQRCodeAnalytics = asyncHandler(exports.getQRCodeAnalytics);
