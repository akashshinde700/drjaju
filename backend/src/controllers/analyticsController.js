const { getDb } = require('../config/db');

async function diagnosis(req, res) {
  try {
    const { startDate, endDate, diagnosisName, status: statusFilter, doctor_id, clinic_id } = req.query;
    const db = getDb();
    let query = `SELECT DATE(a.appointment_date) as date, COUNT(*) as count
                 FROM appointments a
                 WHERE 1=1`;
    const params = [];

    if (statusFilter) {
      query += ' AND a.status = ?';
      params.push(statusFilter);
    } else {
      query += ' AND a.status = \'completed\'';
    }

    if (startDate) {
      query += ' AND a.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.appointment_date <= ?';
      params.push(endDate);
    }
    if (diagnosisName) {
      query += ' AND a.reason_for_visit LIKE ?';
      params.push(`%${diagnosisName}%`);
    }
    if (doctor_id) {
      query += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    if (clinic_id) {
      query += ' AND a.clinic_id = ?';
      params.push(clinic_id);
    }

    query += ' GROUP BY DATE(a.appointment_date) ORDER BY date DESC LIMIT 30';

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Diagnosis analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch diagnosis analytics' });
  }
}

async function diagnosisList(req, res) {
  try {
    const { search = '', limit = 20 } = req.query;
    const db = getDb();
    let query = `SELECT DISTINCT reason_for_visit as diagnosis, COUNT(*) as count
                 FROM appointments
                 WHERE reason_for_visit IS NOT NULL AND reason_for_visit != ''
                 AND status = 'completed'`;
    const params = [];

    if (search) {
      query += ' AND reason_for_visit LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' GROUP BY reason_for_visit ORDER BY count DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Diagnosis list error:', error);
    res.status(500).json({ error: 'Failed to fetch diagnosis list' });
  }
}

async function diagnosisPatients(req, res) {
  try {
    const { diagnosis, startDate, endDate, limit = 50 } = req.query;
    const db = getDb();
    let query = `SELECT
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
      query += ' AND a.reason_for_visit LIKE ?';
      params.push(`%${diagnosis}%`);
    }
    if (startDate) {
      query += ' AND a.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.appointment_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY a.appointment_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Diagnosis patients error:', error);
    res.status(500).json({ error: 'Failed to fetch diagnosis patients' });
  }
}

async function status(req, res) {
  try {
    const { startDate, endDate, status: statusFilter, doctor_id, clinic_id } = req.query;
    const db = getDb();
    let query = `SELECT status, COUNT(*) as count
                 FROM appointments
                 WHERE 1=1`;
    const params = [];

    if (startDate) {
      query += ' AND appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND appointment_date <= ?';
      params.push(endDate);
    }
    if (statusFilter) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }
    if (doctor_id) {
      query += ' AND doctor_id = ?';
      params.push(doctor_id);
    }
    if (clinic_id) {
      query += ' AND clinic_id = ?';
      params.push(clinic_id);
    }

    query += ' GROUP BY status ORDER BY count DESC';

    const [rows] = await db.execute(query, params);

    // Add color mapping for status
    const statusColors = {
      'completed': '#10B981', // green
      'scheduled': '#3B82F6', // blue
      'cancelled': '#EF4444', // red
      'no-show': '#F59E0B', // amber
      'pending': '#8B5CF6' // purple
    };

    const data = rows.map(row => ({
      ...row,
      color: statusColors[row.status] || '#6B7280'
    }));

    res.json({ data });
  } catch (error) {
    console.error('Status analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch status analytics' });
  }
}

async function medicationList(req, res) {
  try {
    const { search = '', limit = 20 } = req.query;
    const db = getDb();
    // Use prescription_items which has medicine_name, not the medications table
    let query = `SELECT DISTINCT pi.medicine_name as medication, COUNT(*) as count
                 FROM prescription_items pi
                 WHERE pi.medicine_name IS NOT NULL AND pi.medicine_name != ''`;
    const params = [];

    if (search) {
      query += ' AND pi.medicine_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' GROUP BY pi.medicine_name ORDER BY count DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Medication list error:', error);
    res.status(500).json({ error: 'Failed to fetch medication list' });
  }
}

async function medicationPatients(req, res) {
  try {
    const { medication, startDate, endDate, limit = 50 } = req.query;
    const db = getDb();
    // Use prescription_items joined to prescriptions + patients
    let query = `SELECT
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
      query += ' AND pi.medicine_name LIKE ?';
      params.push(`%${medication}%`);
    }
    if (startDate) {
      query += ' AND p.prescribed_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND p.prescribed_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY p.prescribed_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Medication patients error:', error);
    res.status(500).json({ error: 'Failed to fetch medication patients' });
  }
}

async function wow(req, res) {
  try {
    const { startDate, endDate, status } = req.query;
    const db = getDb();
    let query = `SELECT 
        DATE_FORMAT(appointment_date, '%Y-%u') as week,
        SUM(CASE WHEN notes LIKE '%online%' OR notes LIKE '%app%' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN notes NOT LIKE '%online%' AND notes NOT LIKE '%app%' THEN 1 ELSE 0 END) as walkin
       FROM appointments
       WHERE 1=1`;
    const params = [];

    if (startDate) {
      query += ' AND appointment_date >= ?';
      params.push(startDate);
    } else {
      query += ' AND appointment_date >= DATE_SUB(NOW(), INTERVAL 4 WEEK)';
    }

    if (endDate) {
      query += ' AND appointment_date <= ?';
      params.push(endDate);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' GROUP BY week ORDER BY week DESC';

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('WoW analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch WoW analytics' });
  }
}

async function topSymptoms(req, res) {
  try {
    const { limit = 10 } = req.query;
    const db = getDb();
    const [rows] = await db.execute(
      `SELECT reason_for_visit as symptom, COUNT(*) as count
       FROM appointments
       WHERE reason_for_visit IS NOT NULL AND reason_for_visit != ''
       GROUP BY reason_for_visit
       ORDER BY count DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Top symptoms error:', error);
    res.status(500).json({ error: 'Failed to fetch top symptoms' });
  }
}

async function topMedications(req, res) {
  try {
    const { limit = 10 } = req.query;
    const db = getDb();
    // prescriptions table has no medication_name; use prescription_items instead
    const [rows] = await db.execute(
      `SELECT medicine_name as medication, COUNT(*) as count
       FROM prescription_items
       WHERE medicine_name IS NOT NULL AND medicine_name != ''
       GROUP BY medicine_name
       ORDER BY count DESC
       LIMIT ?`,
      [parseInt(limit)]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Top medications error:', error);
    res.status(500).json({ error: 'Failed to fetch top medications' });
  }
}

async function appointmentBreakdown(req, res) {
  try {
    const { startDate, endDate, status: statusFilter, doctor_id, clinic_id } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Missing date range' });
    }
    const db = getDb();
    let query = `SELECT
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
      query += ' AND a.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.appointment_date <= ?';
      params.push(endDate);
    }
    if (statusFilter) {
      query += ' AND a.status = ?';
      params.push(statusFilter);
    }
    if (doctor_id) {
      query += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }
    if (clinic_id) {
      query += ' AND a.clinic_id = ?';
      params.push(clinic_id);
    }

    const [rows] = await db.execute(query, params);
    const data = rows[0] || {};

    // Add color mappings
    const genderData = [
      { name: 'Male', value: data.male || 0, color: '#3B82F6' },
      { name: 'Female', value: data.female || 0, color: '#EC4899' }
    ];

    const typeData = [
      { name: 'Consultation', value: data.consultation || 0, color: '#10B981' },
      { name: 'Follow-up', value: data.followup || 0, color: '#F59E0B' },
      { name: 'Emergency', value: data.emergency || 0, color: '#EF4444' }
    ];

    const channelData = [
      { name: 'Online', value: data.online || 0, color: '#8B5CF6' },
      { name: 'Walk-in', value: data.walkin || 0, color: '#6B7280' }
    ];

    res.json({
      data: {
        ...data,
        gender: genderData,
        type: typeData,
        channel: channelData
      }
    });
  } catch (error) {
    console.error('Appointment breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment breakdown' });
  }
}

async function labTestList(req, res) {
  try {
    const { search = '', limit = 20 } = req.query;
    const db = getDb();
    let query = `SELECT DISTINCT test_name as test, COUNT(*) as count
                 FROM lab_investigations lt
                 JOIN appointments a ON lt.appointment_id = a.id
                 WHERE lt.test_name IS NOT NULL AND lt.test_name != ''
                 AND a.status = 'completed'`;
    const params = [];

    if (search) {
      query += ' AND lt.test_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' GROUP BY lt.test_name ORDER BY count DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Lab test list error:', error);
    res.status(500).json({ error: 'Failed to fetch lab test list' });
  }
}

async function labTestPatients(req, res) {
  try {
    const { test, startDate, endDate, limit = 50 } = req.query;
    const db = getDb();
    let query = `SELECT
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
      query += ' AND lt.test_name LIKE ?';
      params.push(`%${test}%`);
    }
    if (startDate) {
      query += ' AND lt.result_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND lt.result_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY lt.result_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Lab test patients error:', error);
    res.status(500).json({ error: 'Failed to fetch lab test patients' });
  }
}
const overview = async (req, res) => {
  try {
    const db = getDb();
    const clinicId = req.user?.clinic_id || null;

    const clinicWhere = clinicId ? 'AND clinic_id = ?' : '';
    const clinicParams = clinicId ? [clinicId] : [];

    const [
      [patientRows],
      [appointmentRows],
      [revenueRows],
      [prescriptionRows]
    ] = await Promise.all([
      db.execute(
        `SELECT COUNT(*) as total FROM patients WHERE deleted_at IS NULL ${clinicWhere}`,
        clinicParams
      ),
      db.execute(
        `SELECT COUNT(*) as total FROM appointments WHERE 1=1 ${clinicWhere}`,
        clinicParams
      ),
      db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM bills WHERE payment_status != 'cancelled' ${clinicWhere}`,
        clinicParams
      ),
      db.execute(
        `SELECT COUNT(*) as total FROM prescriptions WHERE 1=1 ${clinicWhere}`,
        clinicParams
      )
    ]);

    res.json({
      patients: parseInt(patientRows[0]?.total || 0, 10),
      appointments: parseInt(appointmentRows[0]?.total || 0, 10),
      revenue: parseFloat(revenueRows[0]?.total || 0),
      prescriptions: parseInt(prescriptionRows[0]?.total || 0, 10)
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
};

const summary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Missing date range' });
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

    // Total appointments
    const [totalResult] = await db.execute(`SELECT COUNT(*) as total FROM appointments ${whereClause}`, params);
    const totalAppointments = totalResult[0]?.total || 0;

    // Total patients
    const [patientsResult] = await db.execute(`SELECT COUNT(DISTINCT patient_id) as total FROM appointments ${whereClause}`, params);
    const totalPatients = patientsResult[0]?.total || 0;

    // Top symptom
    const [symptomResult] = await db.execute(`
      SELECT reason_for_visit as symptom, COUNT(*) as count
      FROM appointments
      ${whereClause} AND reason_for_visit IS NOT NULL AND reason_for_visit != ''
      GROUP BY reason_for_visit ORDER BY count DESC LIMIT 1
    `, params);
    const topSymptom = symptomResult[0]?.symptom || 'N/A';

    // Top medication from prescription_items
    const [medicationResult] = await db.execute(`
      SELECT pi.medicine_name as medication, COUNT(*) as count
      FROM prescription_items pi
      WHERE pi.medicine_name IS NOT NULL AND pi.medicine_name != ''
      GROUP BY pi.medicine_name ORDER BY count DESC LIMIT 1
    `);
    const topMedication = medicationResult[0]?.medication || 'N/A';

    res.json({
      data: {
        totalAppointments,
        totalPatients,
        topSymptom,
        topMedication
      }
    });
  } catch (error) {
    console.error('Summary analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch summary analytics' });
  }
}

module.exports = {
  diagnosis,
  diagnosisList,
  diagnosisPatients,
  status,
  medicationList,
  medicationPatients,
  labTestList,
  labTestPatients,
  wow,
  topSymptoms,
  topMedications,
  appointmentBreakdown,
  summary,
  overview
};

module.exports = require('./analyticsController_refactored');
