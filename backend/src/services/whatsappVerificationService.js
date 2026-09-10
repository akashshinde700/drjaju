/**
 * WhatsApp Endpoint Verification Service
 * Verifies all WhatsApp endpoints and provides error handling
 * Uses free wa.me links (no paid API required)
 */

const fs = require('fs');
const path = require('path');

// WhatsApp verification log file
const LOG_FILE = path.join(__dirname, '../../logs/whatsapp-verification.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log WhatsApp verification events
 */
function logEvent(eventType, data) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    data,
    status: 'logged'
  };

  try {
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify(logEntry) + '\n'
    );
  } catch (err) {
    console.error('Failed to write WhatsApp log:', err);
  }
}

/**
 * Verify appointment reminder endpoint
 */
async function verifyAppointmentReminder(appointmentData) {
  try {
    const {
      patientPhone,
      patientName,
      appointmentDate,
      appointmentTime,
      doctorName,
      clinicName
    } = appointmentData;

    // Validate required fields
    if (!patientPhone || !patientName || !appointmentDate || !appointmentTime || !doctorName) {
      throw new Error('Missing required appointment data');
    }

    // Format phone number
    const cleanPhone = formatPhoneNumber(patientPhone);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    // Generate message
    const message = generateAppointmentReminderMessage({
      patientName,
      appointmentDate,
      appointmentTime,
      doctorName,
      clinicName
    });

    // Log verification
    logEvent('APPOINTMENT_REMINDER_VERIFIED', {
      phone: cleanPhone,
      patientName,
      messageLength: message.length,
      status: 'success'
    });

    return {
      success: true,
      endpoint: 'appointment_reminder',
      phone: cleanPhone,
      message,
      waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logEvent('APPOINTMENT_REMINDER_ERROR', {
      error: err.message,
      data: appointmentData,
      status: 'failed'
    });

    return {
      success: false,
      endpoint: 'appointment_reminder',
      error: err.message,
      fallback: 'Manual reminder via SMS or email'
    };
  }
}

/**
 * Verify follow-up reminder endpoint
 */
async function verifyFollowupReminder(followupData) {
  try {
    const {
      patientPhone,
      patientName,
      followupDate,
      doctorName,
      reason,
      clinicName
    } = followupData;

    // Validate required fields
    if (!patientPhone || !patientName || !followupDate || !doctorName) {
      throw new Error('Missing required follow-up data');
    }

    // Format phone number
    const cleanPhone = formatPhoneNumber(patientPhone);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    // Generate message
    const message = generateFollowupReminderMessage({
      patientName,
      followupDate,
      doctorName,
      reason,
      clinicName
    });

    // Log verification
    logEvent('FOLLOWUP_REMINDER_VERIFIED', {
      phone: cleanPhone,
      patientName,
      followupDate,
      messageLength: message.length,
      status: 'success'
    });

    return {
      success: true,
      endpoint: 'followup_reminder',
      phone: cleanPhone,
      message,
      waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logEvent('FOLLOWUP_REMINDER_ERROR', {
      error: err.message,
      data: followupData,
      status: 'failed'
    });

    return {
      success: false,
      endpoint: 'followup_reminder',
      error: err.message,
      fallback: 'Manual reminder via SMS or email'
    };
  }
}

/**
 * Verify receipt sharing endpoint
 */
async function verifyReceiptSharing(receiptData) {
  try {
    const {
      patientPhone,
      patientName,
      billId,
      billAmount,
      clinicName
    } = receiptData;

    // Validate required fields
    if (!patientPhone || !patientName || !billId || !billAmount) {
      throw new Error('Missing required receipt data');
    }

    // Format phone number
    const cleanPhone = formatPhoneNumber(patientPhone);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    // Generate message
    const message = generateReceiptMessage({
      patientName,
      billId,
      billAmount,
      clinicName
    });

    // Log verification
    logEvent('RECEIPT_SHARING_VERIFIED', {
      phone: cleanPhone,
      patientName,
      billId,
      messageLength: message.length,
      status: 'success'
    });

    return {
      success: true,
      endpoint: 'receipt_sharing',
      phone: cleanPhone,
      message,
      waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logEvent('RECEIPT_SHARING_ERROR', {
      error: err.message,
      data: receiptData,
      status: 'failed'
    });

    return {
      success: false,
      endpoint: 'receipt_sharing',
      error: err.message,
      fallback: 'Email receipt or manual sharing'
    };
  }
}

/**
 * Verify prescription sharing endpoint
 */
async function verifyPrescriptionSharing(prescriptionData) {
  try {
    const {
      patientPhone,
      patientName,
      doctorName,
      prescriptionDate,
      clinicName
    } = prescriptionData;

    // Validate required fields
    if (!patientPhone || !patientName || !doctorName) {
      throw new Error('Missing required prescription data');
    }

    // Format phone number
    const cleanPhone = formatPhoneNumber(patientPhone);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    // Generate message
    const message = generatePrescriptionMessage({
      patientName,
      doctorName,
      prescriptionDate,
      clinicName
    });

    // Log verification
    logEvent('PRESCRIPTION_SHARING_VERIFIED', {
      phone: cleanPhone,
      patientName,
      doctorName,
      messageLength: message.length,
      status: 'success'
    });

    return {
      success: true,
      endpoint: 'prescription_sharing',
      phone: cleanPhone,
      message,
      waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logEvent('PRESCRIPTION_SHARING_ERROR', {
      error: err.message,
      data: prescriptionData,
      status: 'failed'
    });

    return {
      success: false,
      endpoint: 'prescription_sharing',
      error: err.message,
      fallback: 'Email prescription or manual sharing'
    };
  }
}

/**
 * Verify QR code sharing endpoint
 */
async function verifyQRCodeSharing(qrData) {
  try {
    const {
      patientPhone,
      patientName,
      doctorName,
      qrCodeUrl,
      clinicName
    } = qrData;

    // Validate required fields
    if (!patientPhone || !patientName || !doctorName || !qrCodeUrl) {
      throw new Error('Missing required QR code data');
    }

    // Format phone number
    const cleanPhone = formatPhoneNumber(patientPhone);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    // Generate message
    const message = generateQRCodeMessage({
      patientName,
      doctorName,
      qrCodeUrl,
      clinicName
    });

    // Log verification
    logEvent('QR_CODE_SHARING_VERIFIED', {
      phone: cleanPhone,
      patientName,
      doctorName,
      messageLength: message.length,
      status: 'success'
    });

    return {
      success: true,
      endpoint: 'qr_code_sharing',
      phone: cleanPhone,
      message,
      waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      qrCodeUrl,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logEvent('QR_CODE_SHARING_ERROR', {
      error: err.message,
      data: qrData,
      status: 'failed'
    });

    return {
      success: false,
      endpoint: 'qr_code_sharing',
      error: err.message,
      fallback: 'Email QR code or manual sharing'
    };
  }
}

/**
 * Run all endpoint verifications
 */
async function runAllVerifications(testData) {
  const results = {
    timestamp: new Date().toISOString(),
    endpoints: {},
    summary: {
      total: 5,
      successful: 0,
      failed: 0
    }
  };

  // Test appointment reminder
  const appointmentResult = await verifyAppointmentReminder(testData.appointment);
  results.endpoints.appointment_reminder = appointmentResult;
  if (appointmentResult.success) results.summary.successful++;
  else results.summary.failed++;

  // Test follow-up reminder
  const followupResult = await verifyFollowupReminder(testData.followup);
  results.endpoints.followup_reminder = followupResult;
  if (followupResult.success) results.summary.successful++;
  else results.summary.failed++;

  // Test receipt sharing
  const receiptResult = await verifyReceiptSharing(testData.receipt);
  results.endpoints.receipt_sharing = receiptResult;
  if (receiptResult.success) results.summary.successful++;
  else results.summary.failed++;

  // Test prescription sharing
  const prescriptionResult = await verifyPrescriptionSharing(testData.prescription);
  results.endpoints.prescription_sharing = prescriptionResult;
  if (prescriptionResult.success) results.summary.successful++;
  else results.summary.failed++;

  // Test QR code sharing
  const qrResult = await verifyQRCodeSharing(testData.qrCode);
  results.endpoints.qr_code_sharing = qrResult;
  if (qrResult.success) results.summary.successful++;
  else results.summary.failed++;

  // Log overall verification
  logEvent('ALL_VERIFICATIONS_COMPLETE', results.summary);

  return results;
}

/**
 * Get verification logs
 */
function getVerificationLogs(limit = 100) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }

    const logs = fs.readFileSync(LOG_FILE, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .slice(-limit);

    return logs;
  } catch (err) {
    console.error('Failed to read WhatsApp logs:', err);
    return [];
  }
}

/**
 * Clear verification logs
 */
function clearVerificationLogs() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
      logEvent('LOGS_CLEARED', { status: 'success' });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to clear logs:', err);
    return false;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format phone number for WhatsApp
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^0-9+]/g, '');

  // If no country code, assume India (+91)
  if (!cleaned.startsWith('+') && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }

  // Remove + if present
  cleaned = cleaned.replace('+', '');

  // Validate length (Indian numbers should be 12 digits with country code)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Format date in Indian format
 */
function formatIndianDate(dateString) {
  if (!dateString) return 'TBD';

  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format time in 12-hour format
 */
function formatIndianTime(timeString) {
  if (!timeString) return 'TBD';

  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Generate appointment reminder message
 */
function generateAppointmentReminderMessage(data) {
  const { patientName, appointmentDate, appointmentTime, doctorName, clinicName } = data;
  const formattedDate = formatIndianDate(appointmentDate);
  const formattedTime = formatIndianTime(appointmentTime);

  return `Hello ${patientName},

This is a reminder for your appointment:

📅 Date: ${formattedDate}
⏰ Time: ${formattedTime}
👨‍⚕️ Doctor: Dr. ${doctorName}
${clinicName ? `🏥 Clinic: ${clinicName}` : ''}

Please arrive 10 minutes early.

Thank you!`;
}

/**
 * Generate follow-up reminder message
 */
function generateFollowupReminderMessage(data) {
  const { patientName, followupDate, doctorName, reason, clinicName } = data;
  const formattedDate = formatIndianDate(followupDate);

  return `Hello ${patientName},

This is a reminder for your follow-up appointment:

📅 Date: ${formattedDate}
👨‍⚕️ Doctor: Dr. ${doctorName}
${reason ? `📝 Reason: ${reason}` : ''}
${clinicName ? `🏥 Clinic: ${clinicName}` : ''}

Please contact us if you need to reschedule.

Thank you!`;
}

/**
 * Generate receipt message
 */
function generateReceiptMessage(data) {
  const { patientName, billId, billAmount, clinicName } = data;

  return `Hello ${patientName},

Your bill from *${clinicName || 'Our Clinic'}* is ready.

💳 *Bill ID:* ${billId}
💰 *Amount:* ₹${billAmount}

📄 *Please download your bill PDF from the clinic portal or contact us for a copy.*

Thank you for visiting us!`;
}

/**
 * Generate prescription message
 */
function generatePrescriptionMessage(data) {
  const { patientName, doctorName, prescriptionDate, clinicName } = data;
  const formattedDate = formatIndianDate(prescriptionDate);

  return `Hello ${patientName},

Your prescription from Dr. ${doctorName} (${formattedDate}) is ready.

${clinicName ? `🏥 Clinic: ${clinicName}` : ''}

Please follow the prescribed medications as advised.

Get well soon!`;
}

/**
 * Generate QR code message
 */
function generateQRCodeMessage(data) {
  const { patientName, doctorName, qrCodeUrl, clinicName } = data;

  return `Hello ${patientName},

Here's the QR code to book an appointment with Dr. ${doctorName}:

${qrCodeUrl}

${clinicName ? `🏥 Clinic: ${clinicName}` : ''}

Scan the QR code or click the link to book your appointment.

Thank you!`;
}

module.exports = {
  verifyAppointmentReminder,
  verifyFollowupReminder,
  verifyReceiptSharing,
  verifyPrescriptionSharing,
  verifyQRCodeSharing,
  runAllVerifications,
  getVerificationLogs,
  clearVerificationLogs,
  formatPhoneNumber
};
