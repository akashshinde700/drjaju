const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class AnalyticsService {
  static async diagnosis(query) {
    const { startDate, endDate, diagnosisName, status: statusFilter, doctor_id, clinic_id } = query;
    const db = getDb();

    let sql = `SELECT DATE(a.appointment_date) as date, COUNT(*) as count
                 FROM appointments a
                 WHERE 1=1`;
    const params = [];

    if (statusFilter) {
      sql += ' AND a.status = ?';
      params.push(statusFilter);
    } else {
      sql += " AND a.status = 'completed'";
    }

    if (startDate) {
      sql += ' AND a.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND a.appointment_date <= ?';
      params.push(endDate);
    }
    if (diagnosisName) {
      sql += ' AND a.reason_for_visit LIKE ?';
      params.push(`%${diagnosisName}%`);
    }
    if (doctor_id) {
      sql += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    if (clinic_id) {
      sql += ' AND a.clinic_id = ?';
      params.push(clinic_id);
    }

    sql += ' GROUP BY DATE(a.appointment_date) ORDER BY date DESC LIMIT 30';

    const [rows] = await db.execute(sql, params);
    return { data: rows };
  }

  static async diagnosisList(query) {
    const { search = '', limit = 20 } = query;
    const db = getDb();

    let sql = `SELECT DISTINCT reason_for_visit as diagnosis, COUNT(*) as count
                 FROM appointments
                 WHERE reason_for_visit IS NOT NULL AND reason_for_visit != ''
                 AND status = 'completed'`;
    const params = [];

    if (search) {
      sql += ' AND reason_for_visit LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' GROUP BY reason_for_visit ORDER BY count DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    // db.query (not .execute) — mysql2's prepared-statement protocol rejects a
    // bound LIMIT placeholder with ER_WRONG_ARGUMENTS.
    const [rows] = await db.query(sql, params);
    return { data: rows };
  }

  static async diagnosisPatients(query) {
    const { diagnosis, startDate, endDate, limit = 50 } = query;
    const db = getDb();

    let sql = `SELECT
                  p.name as patient_name,
                  p.patient_id,
                  p.phone,
                  a.appointment_date,
                  a.appointment_time,
                  a.reason_for_visit as diagnosis
                 FROM appointments a
                 JOIN patients p ON a.patient_id = p.id
                 WHERE a.status = 'completed'
                 AND a.reason_for_visit IS NOT NULL AND a.reason_for_visit != ''`;
    const params = [];

    if (diagnosis) {
      sql += ' AND a.reason_for_visit LIKE ?';
      params.push(`%${diagnosis}%`);
    }
    if (startDate) {
      sql += ' AND a.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND a.appointment_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY a.appointment_date DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    return { data: rows };
  }

  static async status(query) {
    const { startDate, endDate, status: statusFilter, doctor_id, clinic_id } = query;
    const db = getDb();

    let sql = `SELECT status, COUNT(*) as count
                 FROM appointments
                 WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND appointment_date <= ?';
      params.push(endDate);
    }
    if (statusFilter) {
      sql += ' AND status = ?';
      params.push(statusFilter);
    }
    if (doctor_id) {
      sql += ' AND doctor_id = ?';
      params.push(doctor_id);
    }
    if (clinic_id) {
      sql += ' AND clinic_id = ?';
      params.push(clinic_id);
    }

    sql += ' GROUP BY status ORDER BY count DESC';

    const [rows] = await db.execute(sql, params);

    const statusColors = {
      completed: '#10B981',
      scheduled: '#3B82F6',
      cancelled: '#EF4444',
      'no-show': '#F59E0B',
      pending: '#8B5CF6',
    };

    const data = rows.map((row) => ({
      ...row,
      color: statusColors[row.status] || '#6B7280',
    }));

    return { data };
  }

  static async medicationList(query) {
    const { search = '', limit = 20 } = query;
    const db = getDb();

    let sql = `SELECT DISTINCT pi.medicine_name as medication, COUNT(*) as count
                 FROM prescription_items pi
                 WHERE pi.medicine_name IS NOT NULL AND pi.medicine_name != ''`;
    const params = [];

    if (search) {
      sql += ' AND pi.medicine_name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' GROUP BY pi.medicine_name ORDER BY count DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    return { data: rows };
  }

  static async medicationPatients(query) {
    const { medication, startDate, endDate, limit = 50 } = query;
    const db = getDb();

    let sql = `SELECT
                  pt.name as patient_name,
                  pt.patient_id,
                  pt.phone,
                  p.prescribed_date as prescription_date,
                  pi.medicine_name as medication_name,
                  pi.dosage,
                  pi.frequency
                 FROM prescription_items pi
                 JOIN prescriptions p ON pi.prescription_id = p.id
                 JOIN patients pt ON p.patient_id = pt.id
                 WHERE 1=1`;
    const params = [];

    if (medication) {
      sql += ' AND pi.medicine_name LIKE ?';
      params.push(`%${medication}%`);
    }
    if (startDate) {
      sql += ' AND p.prescribed_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND p.prescribed_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY p.prescribed_date DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    return { data: rows };
  }

  static async wow(query) {
    const { startDate, endDate, status } = query;
    const db = getDb();

    let sql = `SELECT 
        DATE_FORMAT(appointment_date, '%Y-%u') as week,
        SUM(CASE WHEN notes LIKE '%online%' OR notes LIKE '%app%' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN notes NOT LIKE '%online%' AND notes NOT LIKE '%app%' THEN 1 ELSE 0 END) as walkin
       FROM appointments
       WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND appointment_date >= ?';
      params.push(startDate);
    } else {
      sql += ' AND appointment_date >= DATE_SUB(NOW(), INTERVAL 4 WEEK)';
    }

    if (endDate) {
      sql += ' AND appointment_date <= ?';
      params.push(endDate);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' GROUP BY week ORDER BY week DESC';

    const [rows] = await db.execute(sql, params);
    return { data: rows };
  }

  static async topSymptoms(query) {
    const { limit = 10 } = query;
    const db = getDb();

    const [rows] = await db.query(
      `SELECT reason_for_visit as symptom, COUNT(*) as count
       FROM appointments
       WHERE reason_for_visit IS NOT NULL AND reason_for_visit != ''
       GROUP BY reason_for_visit
       ORDER BY count DESC
       LIMIT ?`,
      [parseInt(limit, 10)]
    );

    return { data: rows };
  }

  static async topMedications(query) {
    const { limit = 10 } = query;
    const db = getDb();

    const [rows] = await db.query(
      `SELECT medicine_name as medication, COUNT(*) as count
       FROM prescription_items
       WHERE medicine_name IS NOT NULL AND medicine_name != ''
       GROUP BY medicine_name
       ORDER BY count DESC
       LIMIT ?`,
      [parseInt(limit, 10)]
    );

    return { data: rows };
  }

  static async appointmentBreakdown(query) {
    const { startDate, endDate, status: statusFilter, doctor_id, clinic_id } = query;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('Missing date range');
    }

    const db = getDb();

    let sql = `SELECT
                  COUNT(*) as total,
                  SUM(CASE WHEN p.gender = 'M' THEN 1 ELSE 0 END) as male,
                  SUM(CASE WHEN p.gender = 'F' THEN 1 ELSE 0 END) as female,
                  SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
                  SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                  SUM(CASE WHEN a.status = 'no-show' THEN 1 ELSE 0 END) as noShow,
                  SUM(CASE WHEN a.appointment_type = 'consultation' THEN 1 ELSE 0 END) as consultation,
                  SUM(CASE WHEN a.appointment_type = 'follow-up' THEN 1 ELSE 0 END) as followup,
                  SUM(CASE WHEN a.appointment_type = 'emergency' THEN 1 ELSE 0 END) as emergency,
                  SUM(CASE WHEN a.channel = 'online' OR a.notes LIKE '%online%' OR a.notes LIKE '%app%' THEN 1 ELSE 0 END) as online,
                  SUM(CASE WHEN a.channel = 'walk-in' OR (a.channel != 'online' AND a.notes NOT LIKE '%online%' AND a.notes NOT LIKE '%app%') THEN 1 ELSE 0 END) as walkin
                 FROM appointments a
                 JOIN patients p ON a.patient_id = p.id
                 WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND a.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND a.appointment_date <= ?';
      params.push(endDate);
    }
    if (statusFilter) {
      sql += ' AND a.status = ?';
      params.push(statusFilter);
    }
    if (doctor_id) {
      sql += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    if (clinic_id) {
      sql += ' AND a.clinic_id = ?';
      params.push(clinic_id);
    }

    const [rows] = await db.execute(sql, params);
    const data = rows[0] || {};

    const genderData = [
      { name: 'Male', value: data.male || 0, color: '#3B82F6' },
      { name: 'Female', value: data.female || 0, color: '#EC4899' },
    ];

    const typeData = [
      { name: 'Consultation', value: data.consultation || 0, color: '#10B981' },
      { name: 'Follow-up', value: data.followup || 0, color: '#F59E0B' },
      { name: 'Emergency', value: data.emergency || 0, color: '#EF4444' },
    ];

    const channelData = [
      { name: 'Online', value: data.online || 0, color: '#8B5CF6' },
      { name: 'Walk-in', value: data.walkin || 0, color: '#6B7280' },
    ];

    return {
      data: {
        ...data,
        gender: genderData,
        type: typeData,
        channel: channelData,
      },
    };
  }

  static async labTestList(query) {
    const { search = '', limit = 20 } = query;
    const db = getDb();

    let sql = `SELECT DISTINCT test_name as test, COUNT(*) as count
                 FROM lab_investigations lt
                 JOIN appointments a ON lt.appointment_id = a.id
                 WHERE lt.test_name IS NOT NULL AND lt.test_name != ''
                 AND a.status = 'completed'`;
    const params = [];

    if (search) {
      sql += ' AND lt.test_name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' GROUP BY lt.test_name ORDER BY count DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    return { data: rows };
  }

  static async labTestPatients(query) {
    const { test, startDate, endDate, limit = 50 } = query;
    const db = getDb();

    let sql = `SELECT
                  p.name as patient_name,
                  p.patient_id,
                  p.phone,
                  a.appointment_date,
                  lt.test_name,
                  lt.result_value as result,
                  lt.result_date as test_date
                 FROM lab_investigations lt
                 JOIN appointments a ON lt.appointment_id = a.id
                 JOIN patients p ON a.patient_id = p.id
                 WHERE a.status = 'completed'
                 AND lt.test_name IS NOT NULL AND lt.test_name != ''`;
    const params = [];

    if (test) {
      sql += ' AND lt.test_name LIKE ?';
      params.push(`%${test}%`);
    }
    if (startDate) {
      sql += ' AND lt.result_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND lt.result_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY lt.result_date DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    return { data: rows };
  }

  static async overview(user) {
    const db = getDb();
    const clinicId = user?.clinic_id || null;

    const clinicWhere = clinicId ? 'AND clinic_id = ?' : '';
    const clinicParams = clinicId ? [clinicId] : [];

    const [[patientRows], [appointmentRows], [revenueRows], [prescriptionRows]] = await Promise.all([
      db.execute(`SELECT COUNT(*) as total FROM patients WHERE deleted_at IS NULL ${clinicWhere}`, clinicParams),
      db.execute(`SELECT COUNT(*) as total FROM appointments WHERE 1=1 ${clinicWhere}`, clinicParams),
      db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM bills WHERE payment_status != 'cancelled' ${clinicWhere}`,
        clinicParams
      ),
      db.execute(`SELECT COUNT(*) as total FROM prescriptions WHERE 1=1 ${clinicWhere}`, clinicParams),
    ]);

    return {
      patients: parseInt(patientRows[0]?.total || 0, 10),
      appointments: parseInt(appointmentRows[0]?.total || 0, 10),
      revenue: parseFloat(revenueRows[0]?.total || 0),
      prescriptions: parseInt(prescriptionRows[0]?.total || 0, 10),
    };
  }

  static async summary(query) {
    const { startDate, endDate } = query;
    if (!startDate || !endDate) {
      throw ApiError.badRequest('Missing date range');
    }

    const db = getDb();
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND appointment_date <= ?';
      params.push(endDate);
    }

    const [totalResult] = await db.execute(`SELECT COUNT(*) as total FROM appointments ${whereClause}`, params);
    const totalAppointments = totalResult[0]?.total || 0;

    const [patientsResult] = await db.execute(
      `SELECT COUNT(DISTINCT patient_id) as total FROM appointments ${whereClause}`,
      params
    );
    const totalPatients = patientsResult[0]?.total || 0;

    const [symptomResult] = await db.execute(
      `
      SELECT reason_for_visit as symptom, COUNT(*) as count
      FROM appointments
      ${whereClause} AND reason_for_visit IS NOT NULL AND reason_for_visit != ''
      GROUP BY reason_for_visit ORDER BY count DESC LIMIT 1
    `,
      params
    );
    const topSymptom = symptomResult[0]?.symptom || 'N/A';

    const [medicationResult] = await db.execute(
      `
      SELECT pi.medicine_name as medication, COUNT(*) as count
      FROM prescription_items pi
      WHERE pi.medicine_name IS NOT NULL AND pi.medicine_name != ''
      GROUP BY pi.medicine_name ORDER BY count DESC LIMIT 1
    `
    );
    const topMedication = medicationResult[0]?.medication || 'N/A';

    return {
      data: {
        totalAppointments,
        totalPatients,
        topSymptom,
        topMedication,
      },
    };
  }
}

module.exports = AnalyticsService;
