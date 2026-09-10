const nodemailer = require('nodemailer');
const EmailTemplates = require('../templates/emailTemplates');
const { getDb } = require('../config/db');

class EnhancedEmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL || 'your-email@gmail.com',
        pass: process.env.SMTP_PASSWORD || 'your-app-password'
      }
    });
  }

  async sendEmail(options) {
    try {
      const { to, subject, html, text } = options;
      
      const mailOptions = {
        from: process.env.SMTP_EMAIL || 'your-email@gmail.com',
        to,
        subject,
        text,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      // Log email sent
      await this.logEmailSent(to, subject, info.messageId);
      
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async logEmailSent(to, subject, messageId) {
    try {
      const db = getDb();
      await db.execute(`
        INSERT INTO email_logs (recipient_email, subject, message_id, sent_at, status)
        VALUES (?, ?, ?, ?, ?)
      `, [to, subject, messageId, new Date(), 'sent']);
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  // Send Doctor OTP
  async sendDoctorOTP(email, otp, mobileNumber, doctorName = null) {
    const subject = '🏥 Dr. Jaju - Doctor Login OTP';
    const html = EmailTemplates.getDoctorOTPTemplate(doctorName || 'Doctor', otp, mobileNumber);
    
    return await this.sendEmail({
      to: email,
      subject,
      html
    });
  }

  // Send Appointment Confirmation
  async sendAppointmentConfirmation(patientEmail, patientName, doctorName, appointmentDate, appointmentTime, appointmentType = 'Consultation') {
    const subject = '📅 Appointment Confirmation - Dr. Jaju';
    const html = EmailTemplates.getAppointmentConfirmationTemplate(patientName, doctorName, appointmentDate, appointmentTime, appointmentType);
    
    return await this.sendEmail({
      to: patientEmail,
      subject,
      html
    });
  }

  // Send Appointment Reminder
  async sendAppointmentReminder(patientEmail, patientName, doctorName, appointmentDate, appointmentTime) {
    const subject = '⏰ Appointment Reminder - Dr. Jaju';
    const html = EmailTemplates.getAppointmentReminderTemplate(patientName, doctorName, appointmentDate, appointmentTime);
    
    return await this.sendEmail({
      to: patientEmail,
      subject,
      html
    });
  }

  // Send Payment Confirmation
  async sendPaymentConfirmation(patientEmail, patientName, billNumber, amount, paymentMethod, paymentDate) {
    const subject = '💳 Payment Confirmation - Dr. Jaju';
    const html = EmailTemplates.getPaymentConfirmationTemplate(patientName, billNumber, amount, paymentMethod, paymentDate);
    
    return await this.sendEmail({
      to: patientEmail,
      subject,
      html
    });
  }

  // Send Welcome Email
  async sendWelcomeEmail(userEmail, userName, userType = 'Patient') {
    const subject = '🎉 Welcome to Dr. Jaju';
    const html = EmailTemplates.getWelcomeEmailTemplate(userName, userType);
    
    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  // Send Prescription Ready Notification
  async sendPrescriptionReady(patientEmail, patientName, doctorName, prescriptionId, readyDate) {
    const subject = '💊 Prescription Ready - Dr. Jaju';
    const html = EmailTemplates.getPrescriptionReadyTemplate(patientName, doctorName, prescriptionId, readyDate);
    
    return await this.sendEmail({
      to: patientEmail,
      subject,
      html
    });
  }

  // Send Test Results Ready Notification
  async sendTestResultsReady(patientEmail, patientName, testName, testDate, reportAvailable) {
    const subject = '🔬 Test Results Ready - Dr. Jaju';
    const html = EmailTemplates.getTestResultsReadyTemplate(patientName, testName, testDate, reportAvailable);
    
    return await this.sendEmail({
      to: patientEmail,
      subject,
      html
    });
  }

  // Send Custom Email
  async sendCustomEmail(to, subject, content, template = 'basic') {
    let html;
    
    switch (template) {
      case 'basic':
        html = EmailTemplates.getBaseTemplate(subject, content);
        break;
      default:
        html = content;
    }
    
    return await this.sendEmail({
      to,
      subject,
      html
    });
  }

  // Test email configuration
  async testEmailConfiguration(testEmail = process.env.SMTP_EMAIL) {
    try {
      const subject = '🧪 Email Configuration Test';
      const content = `
        <h2>✅ Email Configuration Test Successful</h2>
        <p>This is a test email to verify that your email configuration is working correctly.</p>
        <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
        <p><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</p>
        <p><strong>From Email:</strong> ${process.env.SMTP_EMAIL}</p>
      `;
      
      const result = await this.sendCustomEmail(testEmail, subject, content);
      
      return {
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      };
      
    } catch (error) {
      return {
        success: false,
        message: error.message,
        details: error
      };
    }
  }

  // Get email statistics
  async getEmailStats(days = 7) {
    try {
      const db = getDb();
      const [stats] = await db.execute(`
        SELECT 
          COUNT(*) as total_emails,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_emails,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_emails,
          DATE(sent_at) as date
        FROM email_logs 
        WHERE sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(sent_at)
        ORDER BY date DESC
      `, [days]);
      
      return {
        success: true,
        data: stats,
        period: `${days} days`
      };
      
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Create singleton instance
const enhancedEmailService = new EnhancedEmailService();

module.exports = enhancedEmailService;
