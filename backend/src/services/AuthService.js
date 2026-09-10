const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');
const env = require('../config/env');
const otpService = require('./otpService');
const { ApiError } = require('../utils');

async function getDoctorIdByUserId(userId) {
  const db = getDb();
  const [doctors] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [userId]);
  return doctors.length > 0 ? doctors[0].id : null;
}

const AuthService = {
  async verifyCredentials({ email, password }) {
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const db = getDb();

    const [users] = await db.execute(
      `
      SELECT id, email, name, phone, role, is_active, password
      FROM users
      WHERE email = ? AND is_active = 1
    `,
      [email]
    );

    if (users.length === 0) {
      throw ApiError.notFound('User');
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const payload = {
      email: user.email,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        doctor_id: user.role === 'doctor' ? await getDoctorIdByUserId(user.id) : null,
      },
      mobile_number: null,
      user_id: user.id,
    };

    if (user.role !== 'admin') {
      const mobileNumber = user.phone;
      if (!mobileNumber) {
        throw ApiError.badRequest('Mobile number not found. Please update your profile.');
      }

      const cleanMobile = String(mobileNumber).replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        throw ApiError.badRequest('Invalid mobile number format');
      }

      payload.mobile_number = cleanMobile;
    }

    return payload;
  },

  async login({ email, password }) {
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const db = getDb();
    const [users] = await db.execute(
      'SELECT id, email, password, role, name, clinic_id FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      const ttlMs = Number(process.env.OTP_LOGIN_TTL_MS || 5 * 60 * 1000);
      
      // Check database-backed OTP verification first (cluster-safe, survives server restart)
      const [otpRecords] = await db.execute(
        `SELECT verified_at FROM otp_logs 
         WHERE email = ? AND verified_at IS NOT NULL 
         ORDER BY verified_at DESC LIMIT 1`,
        [email]
      );
      
      let isVerified = false;
      if (otpRecords.length > 0) {
        const verifiedAt = new Date(otpRecords[0].verified_at).getTime();
        isVerified = (Date.now() - verifiedAt) <= ttlMs;
      }
      
      // Fallback to in-memory check (for backward compatibility)
      if (!isVerified) {
        const ok = otpService.consumeLoginVerification(email, ttlMs);
        if (!ok) {
          throw ApiError.forbidden('OTP verification required');
        }
      }
    }

    let doctor_id = null;
    if (user.role === 'doctor') {
      doctor_id = await getDoctorIdByUserId(user.id);
    } else if (user.role === 'staff') {
      // Find which doctor this staff member is assigned to
      const db2 = getDb();
      const [ds] = await db2.execute(
        'SELECT doctor_id FROM doctor_staff WHERE staff_user_id = ? AND is_active = 1 LIMIT 1',
        [user.id]
      );
      if (ds.length > 0) doctor_id = ds[0].doctor_id;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, doctor_id, clinic_id: user.clinic_id },
      env.jwtSecret,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clinic_id: user.clinic_id,
        doctor_id,
      },
    };
  },

  async register({ name, email, password, role, clinic_id, phone }) {
    if (!name || !email || !password) {
      throw ApiError.badRequest('Name, email and password are required');
    }

    // SECURITY: whitelist assignable roles. 'super_admin' can never be created
    // through this endpoint, and unknown values fall back to 'staff'.
    const ASSIGNABLE_ROLES = ['staff', 'doctor', 'receptionist', 'admin', 'moderator'];
    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      throw ApiError.badRequest(`Invalid role. Allowed: ${ASSIGNABLE_ROLES.join(', ')}`);
    }

    if (password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters');
    }

    const db = getDb();

    const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      throw ApiError.conflict('User with this email already exists', 'email');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let finalClinicId = clinic_id || null;
    if (!finalClinicId) {
      try {
        const [clinics] = await db.execute('SELECT id FROM clinics ORDER BY id ASC LIMIT 1');
        finalClinicId = clinics[0]?.id || null;
      } catch (_e) {
        finalClinicId = null;
      }
    }

    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, role, clinic_id, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, email, hashedPassword, role || 'staff', finalClinicId, phone || null]
    );

    const token = jwt.sign(
      { id: result.insertId, email, role: role || 'staff' },
      env.jwtSecret,
      { expiresIn: '24h' }
    );

    return {
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertId,
        email,
        name,
        role: role || 'staff',
        clinic_id: finalClinicId,
      },
    };
  },

  async verifyToken({ user }) {
    if (!user) {
      throw ApiError.unauthorized('Invalid token');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  },

  async refreshToken({ user }) {
    if (!user) {
      throw ApiError.unauthorized('Invalid token');
    }

    const db = getDb();
    const [users] = await db.execute('SELECT id, email, role FROM users WHERE id = ? AND is_active = 1', [user.id]);

    if (users.length === 0) {
      throw ApiError.unauthorized('User not found');
    }

    const userData = users[0];

    const newToken = jwt.sign(
      { id: userData.id, email: userData.email, role: userData.role },
      env.jwtSecret,
      { expiresIn: '24h' }
    );

    return {
      token: newToken,
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
      },
    };
  },

  async logout() {
    return { message: 'Logged out successfully' };
  },

  async getMe({ user }) {
    if (!user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const db = getDb();
    const [rows] = await db.execute('SELECT id, name, email, phone, role, clinic_id FROM users WHERE id = ?', [user.id]);

    if (rows.length === 0) {
      throw ApiError.notFound('User');
    }

    return rows[0];
  },
};

module.exports = AuthService;
