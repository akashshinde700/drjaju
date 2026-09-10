const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');
const env = require('../config/env');
const otpService = require('./otpService');

class OtpAuthService {
  static async requestOtp({ email, mobileNumber }) {
    const db = getDb();

    let doctors = [];
    let mobileNumberToUse = mobileNumber;

    if (!mobileNumber) {
      const [doctorRecords] = await db.execute(
        `
        SELECT d.*, u.email, u.name, u.phone
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        WHERE u.email = ? AND u.role = 'doctor' AND u.is_active = 1
      `,
        [email]
      );

      doctors = doctorRecords;

      if (doctors.length === 0) {
        return { ok: false, code: 'not_found', message: 'Doctor account not found with this email' };
      }

      mobileNumberToUse = doctors[0].phone;

      if (!mobileNumberToUse) {
        return {
          ok: false,
          code: 'validation',
          message: 'Mobile number not found for this doctor. Please update your profile.'
        };
      }
    } else {
      const [doctorRecords] = await db.execute(
        `
        SELECT d.*, u.email, u.name, u.phone
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        WHERE u.email = ? AND u.phone = ? AND u.role = 'doctor' AND u.is_active = 1
      `,
        [email, mobileNumber]
      );

      doctors = doctorRecords;

      if (doctors.length === 0) {
        return {
          ok: false,
          code: 'not_found',
          message: 'Doctor account not found with this email and mobile number'
        };
      }
    }

    const doctor = doctors[0];
    const otpResult = await otpService.sendOTP(email, mobileNumberToUse);

    return {
      ok: true,
      data: {
        otpId: otpResult.otpId,
        expiresIn: otpResult.expiresIn,
        doctorName: doctor.name,
        mobileNumber: mobileNumberToUse
      }
    };
  }

  static async sendOtp({ email, mobile_number, user_id }) {
    const result = await otpService.sendOTP(email, mobile_number);

    if (result.success) {
      return {
        ok: true,
        data: {
          otpId: result.otpId,
          expiresIn: result.expiresIn,
          message: 'OTP sent successfully'
        }
      };
    }

    return { ok: false, code: 'server', message: result.message };
  }

  static async verifyDoctorOtp({ otpId, otp, ip }) {
    const result = await otpService.verifyOTP(otpId, otp);

    if (!result.success) {
      return { ok: false, code: 'invalid', message: result.message };
    }

    const db = getDb();
    const [doctors] = await db.execute(
      `
        SELECT d.*, u.email, u.name, u.phone
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        WHERE u.email = ? AND u.role = 'doctor' AND u.is_active = 1
      `,
      [result.email]
    );

    if (doctors.length === 0) {
      return { ok: false, code: 'not_found', message: 'Doctor account not found' };
    }

    const doctor = doctors[0];

    const token = jwt.sign(
      {
        id: doctor.user_id,
        doctorId: doctor.id,
        doctor_id: doctor.id,
        clinic_id: doctor.clinic_id,
        email: doctor.email,
        name: doctor.name,
        role: 'doctor',
        specialization: doctor.specialization
      },
      env.jwtSecret,
      { expiresIn: '24h' }
    );

    await db.execute(
      `
        UPDATE users 
        SET last_login = ?, last_login_ip = ?
        WHERE id = ?
      `,
      [new Date(), ip, doctor.user_id]
    );

    return {
      ok: true,
      data: {
        token,
        user: {
          id: doctor.user_id,
          doctorId: doctor.id,
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          role: 'doctor',
          specialization: doctor.specialization,
          consultation_fee: doctor.consultation_fee
        }
      }
    };
  }

  static async verifyOtp({ email, otp }) {
    const result = await otpService.verifyOTPByEmail(email, otp);

    if (!result.success) {
      return { ok: false, code: 'invalid', message: result.message };
    }

    otpService.markLoginVerified(email);

    return {
      ok: true,
      data: {
        verified: true,
        message: 'OTP verified successfully'
      }
    };
  }

  static getOtpStatus({ otpId }) {
    const status = otpService.getOTPStatus(otpId);
    return { ok: true, data: status };
  }

  static async resendOtp({ email, mobileNumber }) {
    const db = getDb();
    const [doctors] = await db.execute(
      `
      SELECT d.*, u.email, u.name, u.phone
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE u.email = ? AND u.phone = ? AND u.role = 'doctor' AND u.is_active = 1
    `,
      [email, mobileNumber]
    );

    if (doctors.length === 0) {
      return {
        ok: false,
        code: 'not_found',
        message: 'Doctor account not found with this email and mobile number'
      };
    }

    const otpResult = await otpService.sendOTP(email, mobileNumber);

    return {
      ok: true,
      data: {
        otpId: otpResult.otpId,
        expiresIn: otpResult.expiresIn,
        doctorName: doctors[0].name
      }
    };
  }
}

module.exports = OtpAuthService;
