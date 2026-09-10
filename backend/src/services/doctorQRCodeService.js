/**
 * Doctor QR Code Service
 * Generates QR codes for doctor booking links
 * Uses free QR code generation (qr-code.co.in or similar)
 */

const crypto = require('crypto');

// Configurable QR code service URL
const QR_CODE_SERVICE_URL = process.env.QR_CODE_SERVICE_URL || 'https://api.qrserver.com/v1/create-qr-code';

/**
 * Generate booking link for doctor
 */
function generateDoctorBookingLink(doctorData) {
  const {
    doctorId,
    doctorName,
    clinicId,
    clinicName,
    baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  } = doctorData;

  if (!doctorId || !doctorName) {
    throw new Error('Doctor ID and name are required');
  }

  // Generate unique token for tracking
  const token = crypto.randomBytes(8).toString('hex');

  // Build booking link with doctor pre-selected - use landing page for public booking
  const bookingLink = `${baseUrl}/landing?doctor=${doctorId}&clinic=${clinicId || ''}&token=${token}&source=qr`;

  return {
    bookingLink,
    token,
    doctorId,
    doctorName,
    clinicName,
    shortUrl: bookingLink.substring(0, 50) + '...'
  };
}

/**
 * Generate QR code URL using free service
 * Uses qr-server.com (free, no API key required)
 */
function generateQRCodeURL(data, size = 300) {
  if (!data) {
    throw new Error('Data is required to generate QR code');
  }

  // Encode data for URL
  const encodedData = encodeURIComponent(data);

  // Use free QR code service
  const qrCodeUrl = `${QR_CODE_SERVICE_URL}/?size=${size}x${size}&data=${encodedData}`;

  return qrCodeUrl;
}

/**
 * Generate QR code for doctor booking
 */
function generateDoctorQRCode(doctorData, options = {}) {
  try {
    const {
      size = 300,
      format = 'png',
      errorCorrection = 'M'
    } = options;

    // Generate booking link
    const linkData = generateDoctorBookingLink(doctorData);

    // Generate QR code URL
    const qrCodeUrl = generateQRCodeURL(linkData.bookingLink, size);

    return {
      success: true,
      doctorId: doctorData.doctorId,
      doctorName: doctorData.doctorName,
      clinicName: doctorData.clinicName,
      bookingLink: linkData.bookingLink,
      qrCodeUrl,
      token: linkData.token,
      size,
      format,
      errorCorrection,
      generatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      fallback: 'Unable to generate QR code. Use direct booking link instead.'
    };
  }
}

/**
 * Generate multiple QR codes for doctors
 */
function generateBulkQRCodes(doctorsData, options = {}) {
  const results = {
    timestamp: new Date().toISOString(),
    total: doctorsData.length,
    successful: 0,
    failed: 0,
    qrCodes: []
  };

  doctorsData.forEach(doctorData => {
    const qrCode = generateDoctorQRCode(doctorData, options);
    results.qrCodes.push(qrCode);

    if (qrCode.success) {
      results.successful++;
    } else {
      results.failed++;
    }
  });

  return results;
}

/**
 * Generate QR code with custom branding
 */
function generateBrandedQRCode(doctorData, brandingOptions = {}) {
  try {
    const {
      size = 300,
      logoUrl = null,
      brandColor = '#2563eb',
      includeClinicName = true
    } = brandingOptions;

    // Generate booking link
    const linkData = generateDoctorBookingLink(doctorData);

    // Generate QR code URL
    const qrCodeUrl = generateQRCodeURL(linkData.bookingLink, size);

    // Generate branded message
    const brandedMessage = `
Dr. ${doctorData.doctorName}
${includeClinicName && doctorData.clinicName ? `${doctorData.clinicName}` : ''}

Scan to book appointment
    `.trim();

    return {
      success: true,
      doctorId: doctorData.doctorId,
      doctorName: doctorData.doctorName,
      clinicName: doctorData.clinicName,
      bookingLink: linkData.bookingLink,
      qrCodeUrl,
      brandedMessage,
      brandColor,
      logoUrl,
      token: linkData.token,
      generatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Generate QR code for WhatsApp sharing
 */
function generateQRCodeForWhatsApp(doctorData) {
  try {
    const qrCode = generateDoctorQRCode(doctorData);

    if (!qrCode.success) {
      throw new Error(qrCode.error);
    }

    // Generate WhatsApp message
    const whatsappMessage = `
Hello! 👋

Book an appointment with Dr. ${doctorData.doctorName}

Scan the QR code below or click the link:
${qrCode.bookingLink}

${doctorData.clinicName ? `📍 ${doctorData.clinicName}` : ''}

Looking forward to seeing you!
    `.trim();

    return {
      success: true,
      qrCodeUrl: qrCode.qrCodeUrl,
      bookingLink: qrCode.bookingLink,
      whatsappMessage,
      whatsappLink: `https://wa.me/?text=${encodeURIComponent(whatsappMessage + '\n\n' + qrCode.bookingLink)}`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Generate QR code for email sharing
 */
function generateQRCodeForEmail(doctorData) {
  try {
    const qrCode = generateDoctorQRCode(doctorData);

    if (!qrCode.success) {
      throw new Error(qrCode.error);
    }

    // Generate email content
    const emailSubject = `Book an Appointment with Dr. ${doctorData.doctorName}`;
    const emailBody = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2>Book an Appointment</h2>
  
  <p>Hello,</p>
  
  <p>We're pleased to invite you to book an appointment with <strong>Dr. ${doctorData.doctorName}</strong>.</p>
  
  ${doctorData.clinicName ? `<p><strong>Clinic:</strong> ${doctorData.clinicName}</p>` : ''}
  
  <h3>How to Book:</h3>
  <ol>
    <li>Scan the QR code below with your phone camera</li>
    <li>Or click the link: <a href="${qrCode.bookingLink}">${qrCode.bookingLink}</a></li>
    <li>Fill in your details and select your preferred time slot</li>
  </ol>
  
  <div style="text-align: center; margin: 30px 0;">
    <img src="${qrCode.qrCodeUrl}" alt="Booking QR Code" style="width: 300px; height: 300px; border: 2px solid #2563eb; padding: 10px;">
  </div>
  
  <p>If you have any questions, please don't hesitate to contact us.</p>
  
  <p>Best regards,<br>
  ${doctorData.clinicName || 'Our Clinic'}</p>
</body>
</html>
    `;

    return {
      success: true,
      emailSubject,
      emailBody,
      qrCodeUrl: qrCode.qrCodeUrl,
      bookingLink: qrCode.bookingLink
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Generate QR code download link
 */
function generateQRCodeDownloadLink(doctorData, format = 'png') {
  try {
    const qrCode = generateDoctorQRCode(doctorData);

    if (!qrCode.success) {
      throw new Error(qrCode.error);
    }

    // The QR code URL from qr-server.com can be directly downloaded
    return {
      success: true,
      downloadUrl: qrCode.qrCodeUrl,
      filename: `${doctorData.doctorName.replace(/\s+/g, '_')}_booking_qr.${format}`,
      format,
      instructions: 'Right-click the download link and select "Save image as" to download'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Validate QR code token
 */
function validateQRCodeToken(token) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Invalid token format'
    };
  }

  // Token should be 16 characters (8 bytes in hex)
  if (token.length !== 16 || !/^[a-f0-9]{16}$/.test(token)) {
    return {
      valid: false,
      error: 'Token format mismatch'
    };
  }

  return {
    valid: true,
    token,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate QR code analytics data
 */
function generateQRCodeAnalytics(scanData) {
  const {
    doctorId,
    doctorName,
    scans = 0,
    conversions = 0,
    lastScanned = null
  } = scanData;

  const conversionRate = scans > 0 ? ((conversions / scans) * 100).toFixed(2) : 0;

  return {
    doctorId,
    doctorName,
    totalScans: scans,
    totalConversions: conversions,
    conversionRate: `${conversionRate}%`,
    lastScanned,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate QR code with new patient registration flow
 */
function generateQRCodeWithRegistration(doctorData) {
  try {
    const qrCode = generateDoctorQRCode(doctorData);

    if (!qrCode.success) {
      throw new Error(qrCode.error);
    }

    // Add registration flow parameter
    const registrationLink = `${qrCode.bookingLink}&register=true&flow=new_patient`;

    // Generate new QR code with registration link
    const registrationQRUrl = generateQRCodeURL(registrationLink, 300);

    return {
      success: true,
      doctorId: doctorData.doctorId,
      doctorName: doctorData.doctorName,
      clinicName: doctorData.clinicName,
      bookingLink: qrCode.bookingLink,
      registrationLink,
      qrCodeUrl: qrCode.qrCodeUrl,
      registrationQRUrl,
      message: 'New patients will be guided through registration process',
      generatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  generateDoctorBookingLink,
  generateQRCodeURL,
  generateDoctorQRCode,
  generateBulkQRCodes,
  generateBrandedQRCode,
  generateQRCodeForWhatsApp,
  generateQRCodeForEmail,
  generateQRCodeDownloadLink,
  validateQRCodeToken,
  generateQRCodeAnalytics,
  generateQRCodeWithRegistration
};
