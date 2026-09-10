const { getDb } = require('../config/db');
const { generateUHID } = require('../utils/uhidHelper');
const { getLocalDateString } = require('../utils/localDate');

class PatientQueueService {
  static async searchPatients({ query, page = 1, limit = 20 }) {
    const db = getDb();
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    if (!query || String(query).length < 2) {
      return {
        patients: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0,
        },
      };
    }

    const q = String(query);

    const [countResult] = await db.execute(
      `
      SELECT COUNT(*) as total
      FROM patients p
      WHERE 
        p.name LIKE ? OR 
        p.phone LIKE ? OR 
        p.patient_id LIKE ?
    `,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );

    const total = countResult?.[0]?.total || 0;

    const [patients] = await db.execute(
      `
      SELECT 
        p.id,
        p.patient_id as uhid,
        p.name,
        p.phone,
        p.age_years as age,
        p.gender,
        p.address,
        p.email,
        p.blood_group,
        p.created_at
      FROM patients p
      WHERE 
        p.name LIKE ? OR 
        p.phone LIKE ? OR 
        p.patient_id LIKE ?
      ORDER BY 
        CASE 
          WHEN p.patient_id LIKE ? THEN 1
          WHEN p.name LIKE ? THEN 2
          ELSE 3
        END,
        p.name
      LIMIT ${limitNum} OFFSET ${offset}
    `,
      [`%${q}%`, `%${q}%`, `%${q}%`, `${q}%`, `${q}%`]
    );

    return {
      patients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  static async registerNewPatientAndQueue({ payload, user }) {
    const db = getDb();

    const {
      name,
      age,
      gender,
      phone,
      address,
      email,
      blood_group,
      queue_date,
      visit_type,
      doctor_id,
    } = payload;

    await db.beginTransaction();

    try {
      let newPatientId;
      try {
        const dId = doctor_id || (user?.role === 'doctor' ? user.doctor_id : null);
        newPatientId = await generateUHID(db, dId);
      } catch {
        newPatientId = 'DRA' + Date.now();
      }

      let finalDoctorId = doctor_id;
      if (!finalDoctorId && user?.role === 'doctor') {
        if (user.doctor_id) {
          finalDoctorId = user.doctor_id;
        } else if (user.id) {
          const [doctorLookup] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
          if (doctorLookup.length > 0) {
            finalDoctorId = doctorLookup[0].id;
          }
        }
      }

      const clinicId = user?.clinic_id || 2;

      const [patientResult] = await db.execute(
        `
        INSERT INTO patients (
          patient_id, name, age_years, gender, phone, address, email, blood_group, primary_doctor_id, clinic_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
        [
          newPatientId,
          name,
          age,
          gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : gender === 'Other' ? 'O' : 'U',
          phone,
          address,
          email,
          blood_group,
          finalDoctorId,
          clinicId,
        ]
      );

      const patientId = patientResult.insertId;

      const queueResult = await PatientQueueService._addToQueue(db, {
        patient_id: patientId,
        queue_date: queue_date || getLocalDateString(),
        visit_type: visit_type || 'new_complaint',
        doctor_id,
        created_by: user.id,
      });

      await db.commit();

      return {
        patient: {
          id: patientId,
          patient_id: newPatientId,
          name,
          age,
          gender,
          phone,
          address,
          email,
          blood_group,
        },
        queue: queueResult,
      };
    } catch (err) {
      await db.rollback();
      throw err;
    }
  }

  static async addExistingPatientToQueue({ payload, user }) {
    const db = getDb();
    const { patient_id, queue_date, visit_type, doctor_id } = payload;

    const qDate = queue_date || getLocalDateString();

    const [existingQueue] = await db.execute(
      `
      SELECT q.id FROM queue q
      WHERE q.patient_id = ? AND DATE(q.check_in_time) = ?
      AND q.status NOT IN ('completed', 'cancelled', 'no-show')
    `,
      [patient_id, qDate]
    );

    if (existingQueue.length > 0) {
      const err = new Error('Patient already in queue for selected date');
      err.statusCode = 409;
      throw err;
    }

    const queueResult = await PatientQueueService._addToQueue(db, {
      patient_id,
      queue_date: qDate,
      visit_type: visit_type || 'follow_up',
      doctor_id,
      created_by: user.id,
    });

    return { queue: queueResult };
  }

  static async getQueueByDate({ date, page = 1, limit = 50 }) {
    const db = getDb();
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offset = (pageNum - 1) * limitNum;

    const qDate = date || getLocalDateString();

    const [countResult] = await db.execute(
      `
      SELECT COUNT(*) as total
      FROM queue q
      WHERE DATE(q.check_in_time) = ?
    `,
      [qDate]
    );

    const total = countResult?.[0]?.total || 0;

    const [queue] = await db.execute(
      `
      SELECT 
        q.id,
        q.token_number,
        q.check_in_time,
        q.status,
        q.visit_status,
        q.called_at,
        q.completed_at,
        p.patient_id as uhid,
        p.name as patient_name,
        p.phone,
        p.age_years as age,
        p.gender,
        u.name as doctor_name,
        TIMESTAMPDIFF(MINUTE, q.check_in_time, NOW()) as wait_time
      FROM queue q
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN doctors d ON q.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE DATE(q.check_in_time) = ?
      ORDER BY 
        CASE q.status 
          WHEN 'waiting' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'completed' THEN 3
          ELSE 4
        END,
        q.token_number
      LIMIT ${limitNum} OFFSET ${offset}
    `,
      [qDate]
    );

    return {
      queue,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  static async getAvailableDoctors() {
    const db = getDb();
    const [doctors] = await db.execute(
      `
      SELECT 
        d.id,
        u.name,
        d.specialization,
        d.consultation_fee,
        d.status
      FROM doctors d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
      ORDER BY u.name
    `
    );

    return { doctors };
  }

  static async _addToQueue(db, { patient_id, queue_date, visit_type, doctor_id, created_by }) {
    const qDate = queue_date || getLocalDateString();

    const [existing] = await db.execute(
      `
      SELECT id, token_number FROM queue
       WHERE patient_id = ?
         AND check_in_date = ?
         AND status NOT IN ('completed', 'cancelled', 'no-show')
       FOR UPDATE
    `,
      [patient_id, qDate]
    );

    if (existing.length > 0) {
      return {
        id: existing[0].id,
        token_number: existing[0].token_number,
        queue_date: qDate,
        visit_type,
        status: 'waiting',
      };
    }

    const [tokenRows] = await db.execute(
      `
      SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_queue_number
        FROM queue
       WHERE check_in_date = ?
       FOR UPDATE
    `,
      [qDate]
    );

    const nextQueueNumber = tokenRows[0]?.next_queue_number || 1;
    const token = String(nextQueueNumber);
    const finalDoctorId = doctor_id || null;

    const [queueResult] = await db.execute(
      `
      INSERT INTO queue (
        patient_id,
        token_number,
        queue_number,
        check_in_time,
        check_in_date,
        status,
        visit_type,
        doctor_id,
        created_by
      ) VALUES (?, ?, ?, NOW(), ?, 'waiting', ?, ?, ?)
    `,
      [patient_id, token, nextQueueNumber, qDate, visit_type, finalDoctorId, created_by]
    );

    return {
      id: queueResult.insertId,
      token_number: token,
      queue_date: qDate,
      visit_type,
      status: 'waiting',
    };
  }
}

module.exports = PatientQueueService;
