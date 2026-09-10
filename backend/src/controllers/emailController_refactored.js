const enhancedEmailService = require('../services/enhancedEmailService');
const ApiResponse = require('../middleware/apiResponse');
const { asyncHandler } = require('../utils');
const { getLocalDateString } = require('../utils/localDate');

exports.testEmailConfiguration = asyncHandler(async (req, res) => {
  try {
    const { testEmail } = req.body;

    const result = await enhancedEmailService.testEmailConfiguration(testEmail);

    if (result.success) {
      return ApiResponse.success(res, result, 'Email configuration test successful', 200);
    }

    return ApiResponse.error(res, result.message, 500);
  } catch (error) {
    console.error('Email test error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendCustomEmail = asyncHandler(async (req, res) => {
  try {
    const { to, subject, content, template } = req.body;

    if (!to || !subject || !content) {
      return ApiResponse.validationError(res, null, 'Recipient email, subject, and content are required');
    }

    const result = await enhancedEmailService.sendCustomEmail(to, subject, content, template);

    return ApiResponse.success(res, result, 'Email sent successfully', 200);
  } catch (error) {
    console.error('Send email error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendAppointmentConfirmation = asyncHandler(async (req, res) => {
  try {
    const {
      patientEmail,
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      appointmentType
    } = req.body;

    if (!patientEmail || !patientName || !doctorName || !appointmentDate || !appointmentTime) {
      return ApiResponse.validationError(res, null, 'Missing required fields for appointment confirmation');
    }

    const result = await enhancedEmailService.sendAppointmentConfirmation(
      patientEmail,
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      appointmentType
    );

    return ApiResponse.success(res, result, 'Appointment confirmation email sent', 200);
  } catch (error) {
    console.error('Appointment confirmation error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendAppointmentReminder = asyncHandler(async (req, res) => {
  try {
    const { patientEmail, patientName, doctorName, appointmentDate, appointmentTime } = req.body;

    if (!patientEmail || !patientName || !doctorName || !appointmentDate || !appointmentTime) {
      return ApiResponse.validationError(res, null, 'Missing required fields for appointment reminder');
    }

    const result = await enhancedEmailService.sendAppointmentReminder(
      patientEmail,
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime
    );

    return ApiResponse.success(res, result, 'Appointment reminder email sent', 200);
  } catch (error) {
    console.error('Appointment reminder error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendPaymentConfirmation = asyncHandler(async (req, res) => {
  try {
    const { patientEmail, patientName, billNumber, amount, paymentMethod, paymentDate } = req.body;

    if (!patientEmail || !patientName || !billNumber || !amount || !paymentMethod) {
      return ApiResponse.validationError(res, null, 'Missing required fields for payment confirmation');
    }

    const result = await enhancedEmailService.sendPaymentConfirmation(
      patientEmail,
      patientName,
      billNumber,
      amount,
      paymentMethod,
      paymentDate || getLocalDateString()
    );

    return ApiResponse.success(res, result, 'Payment confirmation email sent', 200);
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendWelcomeEmail = asyncHandler(async (req, res) => {
  try {
    const { userEmail, userName, userType } = req.body;

    if (!userEmail || !userName) {
      return ApiResponse.validationError(res, null, 'User email and name are required');
    }

    const result = await enhancedEmailService.sendWelcomeEmail(userEmail, userName, userType);

    return ApiResponse.success(res, result, 'Welcome email sent', 200);
  } catch (error) {
    console.error('Welcome email error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendPrescriptionReady = asyncHandler(async (req, res) => {
  try {
    const { patientEmail, patientName, doctorName, prescriptionId, readyDate } = req.body;

    if (!patientEmail || !patientName || !doctorName || !prescriptionId) {
      return ApiResponse.validationError(res, null, 'Missing required fields for prescription notification');
    }

    const result = await enhancedEmailService.sendPrescriptionReady(
      patientEmail,
      patientName,
      doctorName,
      prescriptionId,
      readyDate || getLocalDateString()
    );

    return ApiResponse.success(res, result, 'Prescription ready email sent', 200);
  } catch (error) {
    console.error('Prescription ready error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendTestResultsReady = asyncHandler(async (req, res) => {
  try {
    const { patientEmail, patientName, testName, testDate, reportAvailable } = req.body;

    if (!patientEmail || !patientName || !testName) {
      return ApiResponse.validationError(res, null, 'Missing required fields for test results notification');
    }

    const result = await enhancedEmailService.sendTestResultsReady(
      patientEmail,
      patientName,
      testName,
      testDate || getLocalDateString(),
      reportAvailable || getLocalDateString()
    );

    return ApiResponse.success(res, result, 'Test results ready email sent', 200);
  } catch (error) {
    console.error('Test results ready error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.getEmailStats = asyncHandler(async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const result = await enhancedEmailService.getEmailStats(parseInt(days));

    if (result.success) {
      return ApiResponse.success(res, result, 'Email statistics retrieved', 200);
    }

    return ApiResponse.error(res, result.message, 500);
  } catch (error) {
    console.error('Email stats error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});
