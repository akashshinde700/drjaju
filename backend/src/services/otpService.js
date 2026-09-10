const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getDb } = require('../config/db');
const EmailTemplates = require('../templates/emailTemplates');
const logger = require('./logger');

class OTPService {
  constructor() {
    this.otpStore = new Map(); // In-memory OTP storage
    this.otpExpiry = 5 * 60 * 1000; // 5 minutes
    this.maxAttempts = 3;
    this.attempts = new Map(); // Track failed attempts
    this.loginVerified = new Map(); // email -> verifiedAt (ms)
  }

  // Initialize email transporter
  createTransporter() {
    const smtpUser = process.env.SMTP_EMAIL || process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '';

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }

  // Generate 6-digit OTP.
  // SECURITY: use crypto (CSPRNG) instead of Math.random, which is predictable
  // and unsuitable for authentication tokens.
  generateOTP() {
    return (crypto.randomInt(0, 1000000)).toString().padStart(6, '0');
  }

  // Send OTP to doctor's email only
  async sendOTP(email, mobileNumber, doctorName = 'Doctor') {
    try {
      const otp = this.generateOTP();
      const otpId = crypto.randomBytes(16).toString('hex');
      
      // Store OTP with expiry
      this.otpStore.set(otpId, {
        otp,
        email,
        mobileNumber,
        createdAt: new Date(),
        attempts: 0
      });

      // Development: print OTP to console for testing
      if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
      }

      const db = getDb();

      // Best-effort: get doctor name for personalization (do not fail OTP if this query fails)
      let resolvedName = doctorName;
      try {
        const [doctors] = await db.execute(`
          SELECT u.name 
          FROM users u 
          JOIN doctors d ON u.id = d.user_id 
          WHERE u.email = ? AND u.role = 'doctor'
        `, [email]);
        resolvedName = doctors.length > 0 ? doctors[0].name : doctorName;
      } catch (_) {
        logger.debug('OTP doctor name resolution failed', { message: _.message, email });
      }

      // Send email
      let emailSent = false;
      try {
        const smtpUser = process.env.SMTP_EMAIL || process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
        if (smtpUser && smtpPass) {
          const transporter = this.createTransporter();
          const mailOptions = {
            from: process.env.SMTP_FROM || smtpUser,
            to: email,
            subject: '🏥 Dr. Jaju - Login OTP',
            html: EmailTemplates.getDoctorOTPTemplate(resolvedName, otp, mobileNumber)
          };
          await transporter.sendMail(mailOptions);
          emailSent = true;
        }
      } catch (e) {
        console.error('OTP email send failed:', e.message);
      }

      // Best-effort: store in database for persistence (do not fail OTP if otp_logs missing)
      try {
        await db.execute(`
          INSERT INTO otp_logs (otp_id, email, mobile_number, otp, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [otpId, email, mobileNumber, otp, new Date(), new Date(Date.now() + this.otpExpiry)]);
      } catch (e) {
        console.error('OTP log insert failed:', e.message);
      }

      return {
        success: true,
        otpId,
        message: emailSent ? 'OTP sent via email' : 'OTP generated (email not configured)',
        expiresIn: this.otpExpiry
      };

    } catch (error) {
      console.error('Failed to send OTP:', error);
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.'
      };
    }
  }

  // Verify OTP — checks in-memory first, falls back to DB (cluster-safe)
  async verifyOTP(otpId, otp) {
    try {
      const storedOTP = this.otpStore.get(otpId);

      if (storedOTP) {
        const timeDiff = Date.now() - storedOTP.createdAt;
        if (timeDiff > this.otpExpiry) {
          this.otpStore.delete(otpId);
          throw new Error('OTP has expired. Please request a new one.');
        }
        if (storedOTP.attempts >= this.maxAttempts) {
          this.otpStore.delete(otpId);
          throw new Error('Maximum attempts exceeded. Please request a new OTP.');
        }
        if (storedOTP.otp !== otp) {
          storedOTP.attempts++;
          throw new Error(`Invalid OTP. ${this.maxAttempts - storedOTP.attempts} attempts remaining.`);
        }
        this.otpStore.delete(otpId);
        return { success: true, email: storedOTP.email, mobileNumber: storedOTP.mobileNumber };
      }

      // In-memory miss — try DB (handles restarts and multi-worker clusters)
      const db = getDb();
      const [records] = await db.execute(
        'SELECT * FROM otp_logs WHERE otp_id = ? AND expires_at > NOW() AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [otpId]
      );
      if (records.length === 0) throw new Error('Invalid or expired OTP');
      const record = records[0];
      if (record.otp !== otp) throw new Error('Invalid OTP.');
      await db.execute('UPDATE otp_logs SET verified_at = NOW() WHERE otp_id = ?', [otpId]);
      return { success: true, email: record.email, mobileNumber: record.mobile_number };

    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Verify OTP by email (for new login flow)
  async verifyOTPByEmail(email, otp) {
    try {
      // Find OTP by email
      let foundOTPId = null;
      let storedOTP = null;
      
      for (const [otpId, otpData] of this.otpStore.entries()) {
        if (otpData.email === email) {
          foundOTPId = otpId;
          storedOTP = otpData;
          break;
        }
      }

      if (!storedOTP) {
        // Check database as fallback
        const db = getDb();
        const [otpRecords] = await db.execute(
          'SELECT * FROM otp_logs WHERE email = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1',
          [email, new Date(Date.now() - this.otpExpiry)]
        );

        if (otpRecords.length === 0) {
          throw new Error('Invalid or expired OTP');
        }

        const otpRecord = otpRecords[0];
        
        // Check expiry
        const now = new Date();
        const timeDiff = now - new Date(otpRecord.created_at);
        
        if (timeDiff > this.otpExpiry) {
          throw new Error('OTP has expired. Please request a new one.');
        }

        // Verify OTP
        if (otpRecord.otp !== otp) {
          throw new Error('Invalid OTP');
        }

        // Mark as verified in database (cluster-safe)
        await db.execute(
          'UPDATE otp_logs SET verified_at = NOW() WHERE email = ? AND verified_at IS NULL LIMIT 1',
          [email]
        );

        return {
          success: true,
          email: email
        };
      }

      // Check expiry for in-memory OTP
      const now = new Date();
      const timeDiff = now - storedOTP.createdAt;
      
      if (timeDiff > this.otpExpiry) {
        this.otpStore.delete(foundOTPId);
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Check attempts
      if (storedOTP.attempts >= this.maxAttempts) {
        this.otpStore.delete(foundOTPId);
        throw new Error('Maximum attempts exceeded. Please request a new OTP.');
      }

      // Verify OTP
      if (storedOTP.otp !== otp) {
        storedOTP.attempts++;
        throw new Error(`Invalid OTP. ${this.maxAttempts - storedOTP.attempts} attempts remaining.`);
      }

      // OTP verified successfully
      this.otpStore.delete(foundOTPId);
      
      // Try to mark as verified in database if OTP logs exist (cluster-safe)
      try {
        const db = getDb();
        await db.execute(
          'UPDATE otp_logs SET verified_at = NOW() WHERE email = ? AND verified_at IS NULL LIMIT 1',
          [storedOTP.email]
        );
      } catch (_) {
        // Best effort - if DB update fails, in-memory verification still works
      }
      
      return {
        success: true,
        email: storedOTP.email,
        mobileNumber: storedOTP.mobileNumber
      };

    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Clean up expired OTPs
  cleanupExpiredOTPs() {
    const now = new Date();
    
    for (const [otpId, otpData] of this.otpStore.entries()) {
      const timeDiff = now - otpData.createdAt;
      if (timeDiff > this.otpExpiry) {
        this.otpStore.delete(otpId);
      }
    }
  }

  // Get OTP status
  getOTPStatus(otpId) {
    const otpData = this.otpStore.get(otpId);
    
    if (!otpData) {
      return { exists: false };
    }

    const now = new Date();
    const timeDiff = now - otpData.createdAt;
    const isExpired = timeDiff > this.otpExpiry;
    const remainingTime = Math.max(0, this.otpExpiry - timeDiff);

    return {
      exists: true,
      isExpired,
      remainingTime,
      attempts: otpData.attempts,
      maxAttempts: this.maxAttempts
    };
  }

  // Mark an email as OTP-verified for login gating
  markLoginVerified(email) {
    if (!email) return;
    this.loginVerified.set(String(email).toLowerCase(), Date.now());
  }

  // Consume verification (one-time) if still within TTL
  consumeLoginVerification(email, ttlMs) {
    const key = String(email || '').toLowerCase();
    if (!key) return false;
    const at = this.loginVerified.get(key);
    if (!at) return false;
    const ttl = Number(ttlMs) > 0 ? Number(ttlMs) : (5 * 60 * 1000);
    const ok = (Date.now() - at) <= ttl;
    if (ok) {
      this.loginVerified.delete(key);
      return true;
    }
    this.loginVerified.delete(key);
    return false;
  }
}

// Auto-cleanup expired OTPs every 2 minutes
const otpService = new OTPService();
setInterval(() => {
  otpService.cleanupExpiredOTPs();
}, 2 * 60 * 1000);

module.exports = otpService;
