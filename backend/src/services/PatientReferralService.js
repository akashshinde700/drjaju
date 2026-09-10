const { getDb } = require('../config/db');

class PatientReferralService {
  static async getAllReferrals({ query, user }) {
    const db = getDb();
    const userId = user?.id;
    const userRole = user?.role;

    let sql = `
      SELECT pr.*,
             p.name as patient_name, p.patient_id as uhid, p.phone as patient_phone,
             p.age_years as patient_age, p.gender as patient_gender,
             u1.name as referring_doctor_name,
             u2.name as referred_to_doctor_name
      FROM patient_referrals pr
      LEFT JOIN patients p ON pr.patient_id = p.id
      LEFT JOIN users u1 ON pr.referring_doctor_id = u1.id
      LEFT JOIN users u2 ON pr.referred_to_doctor_id = u2.id
      WHERE 1=1
    `;

    const params = [];

    if (query.patient_id) {
      sql += ` AND pr.patient_id = ?`;
      params.push(query.patient_id);
    }

    if (userRole === 'doctor') {
      sql += ` AND pr.referring_doctor_id = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY pr.referral_date DESC, pr.created_at DESC`;

    const [referrals] = await db.execute(sql, params);
    return { referrals };
  }

  static async getReferralById(id) {
    const db = getDb();

    const [referrals] = await db.execute(
      `
      SELECT pr.*,
             p.name as patient_name, p.patient_id as uhid, p.phone as patient_phone, p.age_years as age, p.gender,
             u1.name as referring_doctor_name,
             u2.name as referred_to_doctor_name
      FROM patient_referrals pr
      LEFT JOIN patients p ON pr.patient_id = p.id
      LEFT JOIN users u1 ON pr.referring_doctor_id = u1.id
      LEFT JOIN users u2 ON pr.referred_to_doctor_id = u2.id
      WHERE pr.id = ?
    `,
      [id]
    );

    if (referrals.length === 0) {
      const err = new Error('Referral not found');
      err.statusCode = 404;
      throw err;
    }

    return { referral: referrals[0] };
  }

  static async createReferral({ body, user }) {
    const {
      patient_id,
      referred_to_doctor_id,
      referred_doctor_name,
      referred_doctor_phone,
      referred_doctor_email,
      referred_doctor_specialization,
      hospital_name,
      referral_date,
      referral_time,
      reason,
      priority,
      notes,
    } = body;

    if (!patient_id || !referral_date) {
      const err = new Error('Patient ID and referral date are required');
      err.statusCode = 400;
      throw err;
    }

    if (!referred_to_doctor_id && !referred_doctor_name) {
      const err = new Error('Either referred doctor ID or name is required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    const [result] = await db.execute(
      `
      INSERT INTO patient_referrals
      (patient_id, referring_doctor_id, referred_to_doctor_id, referred_doctor_name,
       referred_doctor_phone, referred_doctor_email, referred_doctor_specialization,
       hospital_name, referral_date, referral_time, reason, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        patient_id,
        user?.id || null,
        referred_to_doctor_id || null,
        referred_doctor_name || null,
        referred_doctor_phone || null,
        referred_doctor_email || null,
        referred_doctor_specialization || null,
        hospital_name || null,
        referral_date,
        referral_time || null,
        reason || null,
        priority || 'routine',
        notes || null,
      ]
    );

    return { referral_id: result.insertId };
  }

  static async updateReferral({ id, body }) {
    const db = getDb();

    const [existing] = await db.execute('SELECT * FROM patient_referrals WHERE id = ?', [id]);
    if (existing.length === 0) {
      const err = new Error('Referral not found');
      err.statusCode = 404;
      throw err;
    }

    const updateFields = [];
    const values = [];

    const allowedFields = [
      'referred_doctor_name',
      'referred_doctor_phone',
      'referred_doctor_email',
      'referred_doctor_specialization',
      'hospital_name',
      'referral_date',
      'referral_time',
      'reason',
      'priority',
      'status',
      'notes',
      'outcome',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updateFields.length === 0) {
      const err = new Error('No fields to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(id);

    await db.execute(
      `
      UPDATE patient_referrals
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `,
      values
    );

    return { updated: true };
  }

  static async deleteReferral(id) {
    const db = getDb();
    await db.execute('DELETE FROM patient_referrals WHERE id = ?', [id]);
    return { deleted: true };
  }

  static async getReferralNetwork(user) {
    const db = getDb();
    const userId = user?.id;

    const [network] = await db.execute(
      `
      SELECT * FROM referral_network
      WHERE doctor_id = ? AND is_active = 1
      ORDER BY is_preferred DESC, referral_count DESC, network_doctor_name ASC
    `,
      [userId]
    );

    return { network };
  }

  static async addToNetwork({ body, user }) {
    const {
      network_doctor_name,
      network_doctor_phone,
      network_doctor_email,
      specialization,
      hospital_name,
      hospital_address,
      city,
      state,
      notes,
      is_preferred,
    } = body;

    if (!network_doctor_name) {
      const err = new Error('Doctor name is required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    const [result] = await db.execute(
      `
      INSERT INTO referral_network
      (doctor_id, network_doctor_name, network_doctor_phone, network_doctor_email,
       specialization, hospital_name, hospital_address, city, state, notes, is_preferred)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        user?.id,
        network_doctor_name,
        network_doctor_phone || null,
        network_doctor_email || null,
        specialization || null,
        hospital_name || null,
        hospital_address || null,
        city || null,
        state || null,
        notes || null,
        is_preferred || 0,
      ]
    );

    return { network_id: result.insertId };
  }

  static async updateNetworkDoctor({ id, body }) {
    const db = getDb();

    const updateFields = [];
    const values = [];

    const allowedFields = [
      'network_doctor_name',
      'network_doctor_phone',
      'network_doctor_email',
      'specialization',
      'hospital_name',
      'hospital_address',
      'city',
      'state',
      'notes',
      'is_preferred',
      'is_active',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updateFields.length === 0) {
      const err = new Error('No fields to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(id);

    await db.execute(
      `
      UPDATE referral_network
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `,
      values
    );

    return { updated: true };
  }

  static async deleteNetworkDoctor(id) {
    const db = getDb();
    await db.execute('UPDATE referral_network SET is_active = 0 WHERE id = ?', [id]);
    return { deleted: true };
  }
}

module.exports = PatientReferralService;
