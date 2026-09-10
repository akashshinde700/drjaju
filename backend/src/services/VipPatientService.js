const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

async function query(sql, params = []) {
  const db = getDb();
  const [rows] = await db.query(sql, params);
  return rows;
}

async function logVIPActivity(patientId, actionType, description, userId) {
  try {
    const vipPatient = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patientId]);
    if (vipPatient.length === 0) return;

    const logData = {
      vip_patient_id: vipPatient[0].id,
      patient_id: patientId,
      action_type: actionType,
      action_description: description,
      accessed_by_user_id: userId || null,
      accessed_by_role: 'staff',
      status: 'success',
    };

    await query('INSERT INTO vip_activity_logs SET ?', logData);
  } catch (_err) {
    // best-effort
  }
}

async function generateActivitySummary(patientId) {
  const logs = await query(
    `SELECT action_type, COUNT(*) as count FROM vip_activity_logs
     WHERE patient_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY action_type`,
    [patientId]
  );

  const totalAccess = await query(
    `SELECT COUNT(*) as total FROM vip_activity_logs
     WHERE patient_id = ? AND action_type = 'record_access'`,
    [patientId]
  );

  return {
    period: 'Last 30 days',
    activity_breakdown: logs,
    total_record_accesses: totalAccess[0]?.total || 0,
    generated_at: new Date(),
  };
}

async function generateAccessLog(patientId) {
  const accessLogs = await query(
    `SELECT * FROM vip_activity_logs
     WHERE patient_id = ? AND action_type = 'record_access'
     ORDER BY created_at DESC
     LIMIT 100`,
    [patientId]
  );

  return {
    access_logs: accessLogs,
    total_accesses: accessLogs.length,
    generated_at: new Date(),
  };
}

async function generateComplianceReport(patientId) {
  const vipPatient = await query('SELECT * FROM vip_patients WHERE patient_id = ?', [patientId]);
  if (vipPatient.length === 0) {
    throw ApiError.notFound('VIP patient');
  }

  const accessControls = await query(
    'SELECT COUNT(*) as total FROM vip_record_access_control WHERE vip_patient_id = ?',
    [vipPatient[0].id]
  );

  const activityLogs = await query('SELECT COUNT(*) as total FROM vip_activity_logs WHERE patient_id = ?', [patientId]);

  return {
    vip_tier: vipPatient[0].vip_tier,
    restricted_access: vipPatient[0].restricted_access === 1,
    access_controls_count: accessControls[0]?.total || 0,
    activity_logs_count: activityLogs[0]?.total || 0,
    anonymous_queue_display: vipPatient[0].anonymous_queue_display === 1,
    compliance_status: 'compliant',
    generated_at: new Date(),
  };
}

const VipPatientService = {
  async createVIPPatient(payload, userId) {
    const {
      patient_id,
      vip_tier = 'gold',
      preferred_doctor_id,
      room_preference,
      special_notes,
      allergies_special,
      communication_preference = 'WhatsApp',
      dedicated_contact_person,
      dedicated_contact_phone,
      dedicated_contact_email,
      priority_level = 1,
      anonymous_queue_display = false,
      restricted_access = false,
    } = payload;

    if (!patient_id) {
      throw ApiError.badRequest('Patient ID is required');
    }

    const patientCheck = await query('SELECT id FROM patients WHERE id = ?', [patient_id]);
    if (patientCheck.length === 0) {
      throw ApiError.notFound('Patient');
    }

    const vipCheck = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patient_id]);
    if (vipCheck.length > 0) {
      throw ApiError.badRequest('Patient is already marked as VIP');
    }

    const vipData = {
      patient_id,
      is_vip: 1,
      vip_tier,
      preferred_doctor_id: preferred_doctor_id || null,
      room_preference: room_preference || null,
      special_notes: special_notes || null,
      allergies_special: allergies_special || null,
      communication_preference,
      dedicated_contact_person: dedicated_contact_person || null,
      dedicated_contact_phone: dedicated_contact_phone || null,
      dedicated_contact_email: dedicated_contact_email || null,
      priority_level,
      anonymous_queue_display: anonymous_queue_display ? 1 : 0,
      restricted_access: restricted_access ? 1 : 0,
      access_control_list: JSON.stringify([]),
    };

    await query('INSERT INTO vip_patients SET ?', vipData);
    await logVIPActivity(patient_id, 'vip_created', `Patient marked as VIP (${vip_tier})`, userId);

    return vipData;
  },

  async getVIPPatient(patientId) {
    const vipPatient = await query(
      `SELECT vp.*, p.name, p.phone, p.email, d.user_id as doctor_user_id
       FROM vip_patients vp
       LEFT JOIN patients p ON vp.patient_id = p.id
       LEFT JOIN doctors d ON vp.preferred_doctor_id = d.id
       WHERE vp.patient_id = ?`,
      [patientId]
    );

    if (vipPatient.length === 0) {
      throw ApiError.notFound('VIP patient');
    }

    const vip = vipPatient[0];
    vip.access_control_list = JSON.parse(vip.access_control_list || '[]');
    return vip;
  },

  async updateVIPPatient(patientId, updates, userId) {
    const vipCheck = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patientId]);
    if (vipCheck.length === 0) {
      throw ApiError.notFound('VIP patient');
    }

    const nextUpdates = { ...(updates || {}) };
    if (nextUpdates.access_control_list) {
      nextUpdates.access_control_list = JSON.stringify(nextUpdates.access_control_list);
    }

    await query('UPDATE vip_patients SET ? WHERE patient_id = ?', [nextUpdates, patientId]);
    await logVIPActivity(patientId, 'vip_updated', 'VIP preferences updated', userId);

    return true;
  },

  async removeVIPStatus(patientId, userId) {
    const vipCheck = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patientId]);
    if (vipCheck.length === 0) {
      throw ApiError.notFound('VIP patient');
    }

    await query('DELETE FROM vip_patients WHERE patient_id = ?', [patientId]);
    await logVIPActivity(patientId, 'vip_removed', 'VIP status removed', userId);

    return true;
  },

  async getAllVIPPatients({ vip_tier, priority_level, limit = 50, offset = 0 }) {
    let sql = `SELECT vp.*, p.name, p.phone, p.email, p.patient_id as uhid
               FROM vip_patients vp
               LEFT JOIN patients p ON vp.patient_id = p.id
               WHERE 1=1`;
    const params = [];

    if (vip_tier) {
      sql += ' AND vp.vip_tier = ?';
      params.push(vip_tier);
    }

    if (priority_level) {
      sql += ' AND vp.priority_level = ?';
      params.push(priority_level);
    }

    sql += ' ORDER BY vp.priority_level ASC, vp.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    let vipPatients = [];
    try {
      vipPatients = await query(sql, params);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'ER_NO_SUCH_TABLE' || /vip_patients/i.test(err?.message || '') || /doesn't exist/i.test(err?.message || '')) {
        vipPatients = [];
      } else {
        throw err;
      }
    }

    vipPatients.forEach((vip) => {
      vip.access_control_list = JSON.parse(vip.access_control_list || '[]');
    });

    let countSql = 'SELECT COUNT(*) as total FROM vip_patients WHERE 1=1';
    const countParams = [];
    if (vip_tier) {
      countSql += ' AND vip_tier = ?';
      countParams.push(vip_tier);
    }
    if (priority_level) {
      countSql += ' AND priority_level = ?';
      countParams.push(priority_level);
    }

    const countResult = vipPatients.length === 0 ? [{ total: 0 }] : await query(countSql, countParams);
    const total = countResult[0]?.total || 0;

    return {
      vip_patients: vipPatients,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        pages: limit ? Math.ceil(total / limit) : 0,
      },
    };
  },

  async grantRecordAccess(patientId, payload, userId) {
    const { authorized_user_id, access_level = 'view_only', record_types = [], expires_at } = payload;

    if (!authorized_user_id) {
      throw ApiError.badRequest('Authorized user ID is required');
    }

    const vipCheck = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patientId]);
    if (vipCheck.length === 0) {
      throw ApiError.notFound('VIP patient');
    }

    const accessData = {
      vip_patient_id: vipCheck[0].id,
      authorized_user_id,
      access_level,
      record_types: JSON.stringify(record_types),
      granted_by_user_id: userId || null,
      expires_at: expires_at || null,
      is_active: 1,
    };

    await query('INSERT INTO vip_record_access_control SET ?', accessData);
    await logVIPActivity(patientId, 'access_granted', `Record access granted to user ${authorized_user_id}`, userId);

    return accessData;
  },

  async revokeRecordAccess(patientId, accessId, userId) {
    const accessCheck = await query(
      'SELECT id FROM vip_record_access_control WHERE id = ? AND vip_patient_id IN (SELECT id FROM vip_patients WHERE patient_id = ?)',
      [accessId, patientId]
    );

    if (accessCheck.length === 0) {
      throw ApiError.notFound('Access control record');
    }

    await query('UPDATE vip_record_access_control SET is_active = 0, deleted_at = NOW() WHERE id = ?', [accessId]);
    await logVIPActivity(patientId, 'access_revoked', 'Record access revoked', userId);

    return true;
  },

  async getVIPActivityLogs(patientId, { limit = 100, offset = 0 }) {
    const logs = await query(
      `SELECT * FROM vip_activity_logs
       WHERE patient_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [patientId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    const countResult = await query('SELECT COUNT(*) as total FROM vip_activity_logs WHERE patient_id = ?', [patientId]);

    return {
      activity_logs: logs,
      pagination: {
        total: countResult[0]?.total || 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    };
  },

  async generateVIPReport(patientId, reportType = 'activity_summary', userId) {
    const vipCheck = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patientId]);
    if (vipCheck.length === 0) {
      throw ApiError.notFound('VIP patient');
    }

    let reportData = {};
    if (reportType === 'activity_summary') {
      reportData = await generateActivitySummary(patientId);
    } else if (reportType === 'access_log') {
      reportData = await generateAccessLog(patientId);
    } else if (reportType === 'compliance') {
      reportData = await generateComplianceReport(patientId);
    } else {
      throw ApiError.badRequest('Invalid report type');
    }

    const reportRecord = {
      vip_patient_id: vipCheck[0].id,
      report_type: reportType,
      report_data: JSON.stringify(reportData),
      generated_by_user_id: userId || null,
      generated_at: new Date(),
    };

    await query('INSERT INTO vip_reports SET ?', reportRecord);

    return {
      report_type: reportType,
      report_data: reportData,
      generated_at: reportRecord.generated_at,
    };
  },

  async checkRecordAccess(patientId, { user_id, record_type }) {
    if (!user_id) {
      throw ApiError.badRequest('User ID is required');
    }

    const vipCheck = await query('SELECT id FROM vip_patients WHERE patient_id = ?', [patientId]);
    if (vipCheck.length === 0) {
      return { has_access: true, reason: 'Not a VIP patient' };
    }

    const accessCheck = await query(
      `SELECT * FROM vip_record_access_control
       WHERE vip_patient_id = ? AND authorized_user_id = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [vipCheck[0].id, user_id]
    );

    if (accessCheck.length === 0) {
      return { has_access: false, reason: 'No access granted' };
    }

    const access = accessCheck[0];
    const recordTypes = JSON.parse(access.record_types || '[]');

    if (record_type && recordTypes.length > 0 && !recordTypes.includes(record_type)) {
      return { has_access: false, reason: 'Record type not allowed' };
    }

    return {
      has_access: true,
      access_level: access.access_level,
      allowed_record_types: recordTypes,
    };
  },

  async getVIPQueuePriority() {
    try {
      const vipQueue = await query(
        `SELECT vqp.*, p.name, p.patient_id as uhid, a.appointment_date, a.appointment_time
         FROM vip_queue_priority vqp
         LEFT JOIN vip_patients vp ON vqp.vip_patient_id = vp.id
         LEFT JOIN patients p ON vp.patient_id = p.id
         LEFT JOIN appointments a ON vqp.appointment_id = a.id
         WHERE a.appointment_date = CURDATE()
         ORDER BY vqp.priority_position ASC`
      );

      return { vip_queue: vipQueue, total: vipQueue.length };
    } catch (error) {
      // vip_queue_priority has no write path anywhere in the app yet — return an
      // empty queue instead of a 500 until the feature actually populates it.
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return { vip_queue: [], total: 0 };
      }
      throw error;
    }
  },
};

module.exports = VipPatientService;
