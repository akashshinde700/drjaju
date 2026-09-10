const { getDb } = require('../config/db');
const logger = require('../services/logger');

async function listDoctorStaff(req, res) {
  const db = getDb();
  try {
    const doctorId = parseInt(req.params.doctorId, 10);
    if (isNaN(doctorId)) return res.status(400).json({ error: 'Invalid doctorId' });

    const [staff] = await db.execute(
      `SELECT ds.id as id, ds.role as role, ds.is_active as is_active,
              u.id as user_id, u.name, u.phone, u.email, u.role as user_role
       FROM doctor_staff ds
       JOIN users u ON u.id = ds.staff_user_id
       WHERE ds.doctor_id = ?
       ORDER BY u.name ASC`,
      [doctorId]
    );

    return res.json({ success: true, staff });
  } catch (err) {
    console.error('listDoctorStaff error:', err);
    return res.status(500).json({ error: 'Failed to fetch staff' });
  }
}

async function createDoctorStaff(req, res) {
  const db = getDb();
  const conn = await db.getConnection();
  try {
    const { doctor_id, staff_user_id, name, phone, role = 'assistant', is_active = 1 } = req.body || {};
    const doctorId = parseInt(doctor_id, 10);
    
    // doctor_id is always required
    if (!doctorId) {
      return res.status(400).json({ error: 'doctor_id is required' });
    }

    // Either staff_user_id OR (name and phone) are required
    if (!staff_user_id && (!name || !phone)) {
      return res.status(400).json({ error: 'Either staff_user_id or (name and phone) are required' });
    }

    // Enforce max 5 active staff
    const [[{ cnt }]] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM doctor_staff WHERE doctor_id = ? AND is_active = 1',
      [doctorId]
    );
    if (cnt >= 5) {
      return res.status(400).json({ error: 'Maximum 5 staff allowed per doctor' });
    }

    // Get doctor clinic_id
    const [[doc]] = await conn.query('SELECT clinic_id FROM doctors WHERE id = ?', [doctorId]);
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    const clinicId = doc.clinic_id;

    await conn.beginTransaction();

    let staffUserId;
    
    // If staff_user_id provided, use it directly (preferred method)
    if (staff_user_id) {
      staffUserId = parseInt(staff_user_id, 10);
      // Verify user exists
      const [user] = await conn.query('SELECT id FROM users WHERE id = ?', [staffUserId]);
      if (user.length === 0) {
        return res.status(404).json({ error: 'Staff user not found' });
      }
    } else {
      // Fallback: search by phone and clinic_id
      const [existing] = await conn.query(
        'SELECT id, role FROM users WHERE phone = ? AND clinic_id = ? LIMIT 1',
        [phone, clinicId]
      );

      if (existing.length > 0) {
        staffUserId = existing[0].id;
        // Optionally update name/role if needed
        await conn.query('UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE id = ?', [name, role, staffUserId]);
      } else {
        // Create minimal user (no login) for staff
        const [insUser] = await conn.query(
          'INSERT INTO users (email, password, name, phone, role, clinic_id, is_active) VALUES (NULL, "", ?, ?, ?, ?, 1)',
          [name, phone, role, clinicId]
        );
        staffUserId = insUser.insertId;
      }
    }

    // Map to clinic_staff (ignore if exists)
    await conn.query(
      'INSERT IGNORE INTO clinic_staff (clinic_id, user_id, role, is_primary) VALUES (?,?,?,0)',
      [clinicId, staffUserId, role]
    );

    // Insert mapping into doctor_staff
    await conn.query(
      'INSERT INTO doctor_staff (doctor_id, staff_user_id, role, can_view_patients, can_create_appointments, can_view_prescriptions, can_create_prescriptions, can_view_billing, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      [doctorId, staffUserId, role, 1, 1, 1, 0, 0, is_active ? 1 : 0]
    );

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    try { await conn.rollback(); } catch(e) { logger.debug('createDoctorStaff rollback failed', { message: e.message }); }
    console.error('createDoctorStaff error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Staff already added for this doctor' });
    }
    return res.status(500).json({ error: 'Failed to add staff' });
  } finally {
    try { conn.release(); } catch(e) { logger.debug('doctorStaff connection release failed', { message: e.message }); }
  }
}

async function updateDoctorStaff(req, res) {
  const db = getDb();
  const conn = await db.getConnection();
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { role, is_active, permissions } = req.body || {};

    // Fetch existing mapping for doctor_id to validate cap on activation
    const [[row]] = await conn.query('SELECT doctor_id, is_active FROM doctor_staff WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Mapping not found' });

    if (typeof is_active !== 'undefined' && row.is_active == 0 && Number(is_active) === 1) {
      // About to activate -> check cap
      const [[{ cnt }]] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM doctor_staff WHERE doctor_id = ? AND is_active = 1',
        [row.doctor_id]
      );
      if (cnt >= 5) {
        return res.status(400).json({ error: 'Maximum 5 staff allowed per doctor' });
      }
    }

    // Update role/is_active
    await conn.query(
      'UPDATE doctor_staff SET role = COALESCE(?, role), is_active = COALESCE(?, is_active) WHERE id = ?',
      [role || null, typeof is_active === 'undefined' ? null : (is_active ? 1 : 0), id]
    );

    // Update permissions if provided
    if (permissions && typeof permissions === 'object') {
      const p = permissions;
      await conn.query(
        'UPDATE doctor_staff SET can_view_patients=COALESCE(?,can_view_patients), can_create_appointments=COALESCE(?,can_create_appointments), can_view_prescriptions=COALESCE(?,can_view_prescriptions), can_create_prescriptions=COALESCE(?,can_create_prescriptions), can_view_billing=COALESCE(?,can_view_billing) WHERE id=?',
        [p.can_view_patients, p.can_create_appointments, p.can_view_prescriptions, p.can_create_prescriptions, p.can_view_billing, id]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('updateDoctorStaff error:', err);
    return res.status(500).json({ error: 'Failed to update' });
  } finally {
    try { conn.release(); } catch(e) { logger.debug('doctorStaff connection release failed', { message: e.message }); }
  }
}

async function deleteDoctorStaff(req, res) {
  const db = getDb();
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    await db.execute('DELETE FROM doctor_staff WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteDoctorStaff error:', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
}

module.exports = require('./doctorStaffController_refactored');
