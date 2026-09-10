const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class DoctorStaffService {
  static async listDoctorStaff(doctorId) {
    const parsedDoctorId = parseInt(doctorId, 10);
    if (Number.isNaN(parsedDoctorId)) {
      throw ApiError.badRequest('Invalid doctorId');
    }

    const db = getDb();
    const [staff] = await db.execute(
      `SELECT ds.id as id, ds.role as role, ds.is_active as is_active,
              u.id as user_id, u.name, u.phone, u.email, u.role as user_role
       FROM doctor_staff ds
       JOIN users u ON u.id = ds.staff_user_id
       WHERE ds.doctor_id = ?
       ORDER BY u.name ASC`,
      [parsedDoctorId]
    );

    return { staff };
  }

  static async createDoctorStaff({ doctor_id, staff_user_id, name, phone, role, is_active = 1 }) {
    const doctorId = parseInt(doctor_id, 10);
    if (!doctorId) {
      throw ApiError.badRequest('doctor_id is required');
    }

    const db = getDb();
    const conn = await db.getConnection();

    try {
      const [[{ cnt }]] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM doctor_staff WHERE doctor_id = ? AND is_active = 1',
        [doctorId]
      );

      if (cnt >= 5) {
        throw ApiError.badRequest('Maximum 5 staff allowed per doctor');
      }

      const [[doc]] = await conn.query('SELECT clinic_id FROM doctors WHERE id = ?', [doctorId]);
      if (!doc) {
        throw ApiError.notFound('Doctor');
      }

      const clinicId = doc.clinic_id;

      await conn.beginTransaction();

      let staffUserId;

      if (staff_user_id) {
        staffUserId = parseInt(staff_user_id, 10);
        const [user] = await conn.query('SELECT id FROM users WHERE id = ?', [staffUserId]);
        if (user.length === 0) {
          throw ApiError.notFound('Staff user');
        }
      } else if (name && phone) {
        const [existing] = await conn.query(
          'SELECT id FROM users WHERE phone = ? AND clinic_id = ? LIMIT 1',
          [phone, clinicId]
        );

        if (existing.length > 0) {
          staffUserId = existing[0].id;
          await conn.query(
            'UPDATE users SET name = COALESCE(?, name) WHERE id = ?',
            [name, staffUserId]
          );
        } else {
          const placeholderEmail = `staff_${phone}_${clinicId}@noemail.local`;
          const [insUser] = await conn.query(
            'INSERT INTO users (email, password, name, phone, role, clinic_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [placeholderEmail, '', name, phone, 'staff', clinicId]
          );
          staffUserId = insUser.insertId;
        }
      } else {
        throw ApiError.badRequest('Either staff_user_id or (name and phone) are required');
      }

      await conn.query(
        'INSERT IGNORE INTO clinic_staff (clinic_id, user_id, role, is_primary) VALUES (?, ?, ?, 0)',
        [clinicId, staffUserId, 'receptionist']
      );

      await conn.query(
        'INSERT INTO doctor_staff (doctor_id, staff_user_id, role, can_view_patients, can_create_appointments, can_view_prescriptions, can_create_prescriptions, can_view_billing, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [doctorId, staffUserId, 'assistant', 1, 1, 1, 0, 0, is_active ? 1 : 0]
      );

      await conn.commit();
      return { created: true };
    } catch (err) {
      try { await conn.rollback(); } catch { }

      if (err && err.code === 'ER_DUP_ENTRY') {
        throw ApiError.conflict('Staff already added for this doctor');
      }

      throw err;
    } finally {
      try { conn.release(); } catch { }
    }
  }

  static async updateDoctorStaff({ id, role, is_active, permissions }) {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw ApiError.badRequest('Invalid id');
    }

    const db = getDb();
    const conn = await db.getConnection();

    try {
      const [[row]] = await conn.query('SELECT doctor_id, is_active FROM doctor_staff WHERE id = ?', [parsedId]);
      if (!row) {
        throw ApiError.notFound('Mapping');
      }

      if (typeof is_active !== 'undefined' && row.is_active == 0 && Number(is_active) === 1) {
        const [[{ cnt }]] = await conn.query(
          'SELECT COUNT(*) AS cnt FROM doctor_staff WHERE doctor_id = ? AND is_active = 1',
          [row.doctor_id]
        );
        if (cnt >= 5) {
          throw ApiError.badRequest('Maximum 5 staff allowed per doctor');
        }
      }

      await conn.query(
        'UPDATE doctor_staff SET role = COALESCE(?, role), is_active = COALESCE(?, is_active) WHERE id = ?',
        [role || null, typeof is_active === 'undefined' ? null : is_active ? 1 : 0, parsedId]
      );

      if (permissions && typeof permissions === 'object') {
        const p = permissions;
        await conn.query(
          'UPDATE doctor_staff SET can_view_patients=COALESCE(?,can_view_patients), can_create_appointments=COALESCE(?,can_create_appointments), can_view_prescriptions=COALESCE(?,can_view_prescriptions), can_create_prescriptions=COALESCE(?,can_create_prescriptions), can_view_billing=COALESCE(?,can_view_billing) WHERE id=?',
          [p.can_view_patients, p.can_create_appointments, p.can_view_prescriptions, p.can_create_prescriptions, p.can_view_billing, parsedId]
        );
      }

      return { updated: true };
    } finally {
      try { conn.release(); } catch { }
    }
  }

  static async deleteDoctorStaff(id) {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw ApiError.badRequest('Invalid id');
    }

    const db = getDb();
    await db.execute('DELETE FROM doctor_staff WHERE id = ?', [parsedId]);
    return { deleted: true };
  }
}

module.exports = DoctorStaffService;
