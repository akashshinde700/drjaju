class EmailTemplates {
  // Hospital branding
  static getHospitalBranding() {
    return {
      name: 'Dr. Jaju',
      logo: '🏥',
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
      accentColor: '#f59e0b',
      website: 'https://drjaju.com'
    };
  }

  // Base template structure
  static getBaseTemplate(title, content) {
    const branding = this.getHospitalBranding();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          .header p {
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
          }
          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          .footer-info {
            margin-bottom: 20px;
            color: #666;
            font-size: 14px;
          }
          .footer-info div {
            margin-bottom: 8px;
          }
          .social-links {
            margin-top: 20px;
          }
          .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: ${branding.primaryColor};
            text-decoration: none;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background: ${branding.primaryColor};
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: background-color 0.3s;
          }
          .btn:hover {
            background: ${branding.secondaryColor};
          }
          .otp-box {
            background: #f8f9fa;
            border: 2px dashed ${branding.primaryColor};
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: ${branding.primaryColor};
            letter-spacing: 5px;
            font-family: 'Courier New', monospace;
          }
          .alert {
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .alert-info {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            color: #1565c0;
          }
          .alert-success {
            background: #e8f5e8;
            border-left: 4px solid #4caf50;
            color: #2e7d32;
          }
          .alert-warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            color: #856404;
          }
          .appointment-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid ${branding.primaryColor};
          }
          .appointment-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e9ecef;
          }
          .appointment-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .appointment-label {
            font-weight: 600;
            color: #666;
          }
          .appointment-value {
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${branding.logo} ${branding.name}</h1>
            <p>${title}</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <div class="social-links">
              <a href="${branding.website}">Visit Website</a>
            </div>
            <p style="margin-top: 20px; color: #999; font-size: 12px;">
              © ${new Date().getFullYear()} ${branding.name}. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Doctor OTP Login Template
  static getDoctorOTPTemplate(doctorName, otp, mobileNumber, expiryMinutes = 5) {
    const content = `
      <h2>🔐 Doctor Login Verification</h2>
      <p>Dear <strong>Dr. ${doctorName}</strong>,</p>
      <p>You have requested to login to the hospital management system. Please use the following One-Time Password (OTP) to complete your login:</p>
      
      <div class="otp-box">
        <p style="margin-bottom: 10px; font-weight: 600;">Your OTP Code:</p>
        <div class="otp-code">${otp}</div>
        <p style="margin-top: 15px; color: #666; font-size: 14px;">
          Valid for <strong>${expiryMinutes} minutes</strong>
        </p>
      </div>

      <div class="alert alert-info">
        <strong>📱 Login Details:</strong><br>
        <strong>Mobile Number:</strong> ${mobileNumber}<br>
        <strong>Email:</strong> ${doctorName.includes('@') ? doctorName : 'Registered Email'}<br>
        <strong>Time:</strong> ${new Date().toLocaleString()}
      </div>

      <div class="alert alert-warning">
        <strong>🛡️ Security Notice:</strong>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>This OTP will expire in ${expiryMinutes} minutes</li>
          <li>Never share your OTP with anyone</li>
          <li>If you didn't request this login, please contact security immediately</li>
          <li>For security reasons, OTPs can only be used once</li>
        </ul>
      </div>

      <p style="margin-top: 30px;">
        <strong>Need Help?</strong><br>
        If you face any issues with login, please contact the IT support team.
      </p>
    `;

    return this.getBaseTemplate('Doctor Login OTP', content);
  }

  // Patient Appointment Confirmation Template
  static getAppointmentConfirmationTemplate(patientName, doctorName, appointmentDate, appointmentTime, appointmentType = 'Consultation') {
    const content = `
      <h2>📅 Appointment Confirmation</h2>
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your appointment has been successfully confirmed. Here are your appointment details:</p>
      
      <div class="appointment-card">
        <div class="appointment-item">
          <span class="appointment-label">👨‍⚕️ Doctor:</span>
          <span class="appointment-value">Dr. ${doctorName}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">📅 Date:</span>
          <span class="appointment-value">${appointmentDate}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">⏰ Time:</span>
          <span class="appointment-value">${appointmentTime}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">🏥 Type:</span>
          <span class="appointment-value">${appointmentType}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">🆔 Patient ID:</span>
          <span class="appointment-value">${patientName}</span>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>📝 Important Instructions:</strong>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>Please arrive 15 minutes before your appointment time</li>
          <li>Bring your ID proof and previous medical records</li>
          <li>If you need to reschedule, please call us at least 2 hours in advance</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="#" class="btn">View Appointment Details</a>
      </div>

      <p style="margin-top: 30px;">
        <strong>Questions?</strong><br>
        Call us at ${this.getHospitalBranding().phone} if you have any questions about your appointment.
      </p>
    `;

    return this.getBaseTemplate('Appointment Confirmation', content);
  }

  // Patient Appointment Reminder Template
  static getAppointmentReminderTemplate(patientName, doctorName, appointmentDate, appointmentTime) {
    const content = `
      <h2>⏰ Appointment Reminder</h2>
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>This is a friendly reminder about your upcoming appointment:</p>
      
      <div class="appointment-card">
        <div class="appointment-item">
          <span class="appointment-label">👨‍⚕️ Doctor:</span>
          <span class="appointment-value">Dr. ${doctorName}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">📅 Date:</span>
          <span class="appointment-value">${appointmentDate}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">⏰ Time:</span>
          <span class="appointment-value">${appointmentTime}</span>
        </div>
      </div>

      <div class="alert alert-warning">
        <strong>⚠️ Please Remember:</strong>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>Arrive 15 minutes early for registration</li>
          <li>Bring your ID and medical records</li>
          <li>Follow COVID-19 safety protocols</li>
        </ul>
      </div>

      <p style="margin-top: 30px;">
        <strong>Running Late?</strong><br>
        Please inform us if you're running late: ${this.getHospitalBranding().phone}
      </p>
    `;

    return this.getBaseTemplate('Appointment Reminder', content);
  }

  // Bill Payment Confirmation Template
  static getPaymentConfirmationTemplate(patientName, billNumber, amount, paymentMethod, paymentDate) {
    const content = `
      <h2>💳 Payment Confirmation</h2>
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your payment has been successfully processed. Here are your payment details:</p>
      
      <div class="appointment-card">
        <div class="appointment-item">
          <span class="appointment-label">🧾 Bill Number:</span>
          <span class="appointment-value">${billNumber}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">💰 Amount Paid:</span>
          <span class="appointment-value">₹${amount}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">💳 Payment Method:</span>
          <span class="appointment-value">${paymentMethod}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">📅 Payment Date:</span>
          <span class="appointment-value">${paymentDate}</span>
        </div>
      </div>

      <div class="alert alert-success">
        <strong>✅ Payment Status:</strong> Successfully Completed<br>
        <strong>📧 Receipt:</strong> Detailed receipt has been sent to your registered email
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="#" class="btn">Download Receipt</a>
      </div>

      <p style="margin-top: 30px;">
        <strong>Thank You!</strong><br>
        Thank you for choosing ${this.getHospitalBranding().name} for your healthcare needs.
      </p>
    `;

    return this.getBaseTemplate('Payment Confirmation', content);
  }

  // Welcome Email Template
  static getWelcomeEmailTemplate(userName, userType = 'Patient') {
    const content = `
      <h2>🎉 Welcome to ${this.getHospitalBranding().name}</h2>
      <p>Dear <strong>${userName}</strong>,</p>
      <p>Welcome to the ${this.getHospitalBranding().name} family! We're delighted to have you with us.</p>
      
      <div class="alert alert-info">
        <strong>🏥 About ${this.getHospitalBranding().name}:</strong>
        <p style="margin-top: 10px;">
          We are committed to providing exceptional healthcare services with compassion, 
          integrity, and excellence. Our team of experienced doctors and medical professionals 
          are here to serve your healthcare needs.
        </p>
      </div>

      <div class="appointment-card">
        <h3 style="margin-bottom: 15px; color: ${this.getHospitalBranding().primaryColor};">🌟 What You Can Do:</h3>
        <ul style="margin-left: 20px;">
          <li>📅 Book appointments online</li>
          <li>👨‍⚕️ Consult with expert doctors</li>
          <li>💊 Access prescription services</li>
          <li>🧪 Get lab tests done</li>
          <li>💳 Make secure online payments</li>
          <li>📱 Access your medical records</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="#" class="btn">Get Started</a>
      </div>

      <p style="margin-top: 30px;">
        <strong>Need Assistance?</strong><br>
        Our support team is here to help you. Call us at ${this.getHospitalBranding().phone}.
      </p>
    `;

    return this.getBaseTemplate('Welcome to Dr. Jaju', content);
  }

  // Prescription Ready Template
  static getPrescriptionReadyTemplate(patientName, doctorName, prescriptionId, readyDate) {
    const content = `
      <h2💊 Prescription Ready</h2>
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your prescription from Dr. ${doctorName} is ready for collection:</p>
      
      <div class="appointment-card">
        <div class="appointment-item">
          <span class="appointment-label">👨‍⚕️ Doctor:</span>
          <span class="appointment-value">Dr. ${doctorName}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">🆔 Prescription ID:</span>
          <span class="appointment-value">${prescriptionId}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">📅 Ready Date:</span>
          <span class="appointment-value">${readyDate}</span>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>📝 Collection Instructions:</strong>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>Bring your ID proof for verification</li>
          <li>Prescription can be collected from the pharmacy counter</li>
          <li>Pharmacy hours: 9:00 AM - 8:00 PM</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="#" class="btn">View Prescription Details</a>
      </div>

      <p style="margin-top: 30px;">
        <strong>Questions?</strong><br>
        Pharmacy: ${this.getHospitalBranding().phone}
      </p>
    `;

    return this.getBaseTemplate('Prescription Ready', content);
  }

  // Test Results Ready Template
  static getTestResultsReadyTemplate(patientName, testName, testDate, reportAvailable) {
    const content = `
      <h2>🔬 Test Results Ready</h2>
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your test results are now available:</p>
      
      <div class="appointment-card">
        <div class="appointment-item">
          <span class="appointment-label">🧪 Test Name:</span>
          <span class="appointment-value">${testName}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">📅 Test Date:</span>
          <span class="appointment-value">${testDate}</span>
        </div>
        <div class="appointment-item">
          <span class="appointment-label">📊 Report Available:</span>
          <span class="appointment-value">${reportAvailable}</span>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>📋 Next Steps:</strong>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>Login to your patient portal to view detailed reports</li>
          <li>Consult with your doctor for result interpretation</li>
          <li>Download reports for your records</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="#" class="btn">View Test Results</a>
      </div>

      <p style="margin-top: 30px;">
        <strong>Need Help?</strong><br>
        Lab Department: ${this.getHospitalBranding().phone}
      </p>
    `;

    return this.getBaseTemplate('Test Results Ready', content);
  }
}

module.exports = EmailTemplates;
