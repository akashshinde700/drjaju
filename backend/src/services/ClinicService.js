const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class ClinicService {
  static async listClinics() {
    const db = getDb();
    const [clinics] = await db.execute('SELECT * FROM clinics WHERE is_active = 1 ORDER BY name');
    return { clinics };
  }

  static async getClinic(id) {
    const db = getDb();
    const [clinics] = await db.execute('SELECT * FROM clinics WHERE id = ?', [id]);

    if (!clinics || clinics.length === 0) {
      throw ApiError.notFound('Clinic');
    }

    return { clinic: clinics[0] };
  }

  static async createClinic(body) {
    const { name, address, city, state, pincode, phone, email, logo_url } = body;

    if (!name) {
      throw ApiError.badRequest('Clinic name is required');
    }

    const db = getDb();

    try {
      const [result] = await db.execute(
        `INSERT INTO clinics (name, address, city, state, pincode, phone, email, logo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          address || null,
          city || null,
          state || null,
          pincode || null,
          phone || null,
          email || null,
          logo_url || null,
        ]
      );

      return { id: result.insertId };
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw ApiError.conflict('Clinic with this email already exists');
      }
      throw error;
    }
  }

  static async updateClinic({ id, body }) {
    const { name, address, city, state, pincode, phone, email, logo_url, is_active } = body;

    const updateFields = [];
    const params = [];

    if (name) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      params.push(address);
    }
    if (city) {
      updateFields.push('city = ?');
      params.push(city);
    }
    if (state) {
      updateFields.push('state = ?');
      params.push(state);
    }
    if (pincode) {
      updateFields.push('pincode = ?');
      params.push(pincode);
    }
    if (phone) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (email) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (logo_url !== undefined) {
      updateFields.push('logo_url = ?');
      params.push(logo_url);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(is_active);
    }

    if (updateFields.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    params.push(id);

    const db = getDb();
    await db.execute(`UPDATE clinics SET ${updateFields.join(', ')} WHERE id = ?`, params);

    return { updated: true };
  }

  static async switchClinic({ clinic_id, user }) {
    if (!clinic_id) {
      throw ApiError.badRequest('Clinic ID is required');
    }

    const db = getDb();

    const [clinics] = await db.execute('SELECT id FROM clinics WHERE id = ? AND is_active = 1', [clinic_id]);
    if (!clinics || clinics.length === 0) {
      throw ApiError.notFound('Clinic');
    }

    if (user?.role !== 'admin') {
      const [userClinics] = await db.execute('SELECT clinic_id FROM users WHERE id = ?', [user?.id]);
      if (userClinics.length === 0 || userClinics[0].clinic_id !== parseInt(clinic_id, 10)) {
        throw ApiError.forbidden('You do not have access to this clinic');
      }
    }

    const [clinic] = await db.execute('SELECT * FROM clinics WHERE id = ?', [clinic_id]);

    return { clinic: clinic[0] };
  }
}

module.exports = ClinicService;
