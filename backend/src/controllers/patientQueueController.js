const { getDb } = require('../config/db');
const { generateUHID } = require('../utils/uhidHelper');
const { getLocalDateString } = require('../utils/localDate');

// Search patients for queue
exports.searchPatients = async (req, res) => {
  try {
    const db = getDb();
    const { query, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    if (!query || query.length < 2) {
      return res.json({ 
        success: true, 
        patients: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM patients p
      WHERE 
        p.name LIKE ? OR 
        p.phone LIKE ? OR 
        p.patient_id LIKE ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    
    const total = countResult[0].total;
    
    const [patients] = await db.execute(`
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
      LIMIT ? OFFSET ?
    `, [
      `%${query}%`, `%${query}%`, `%${query}%`,
      `${query}%`, `${query}%`,
      parseInt(limit), offset
    ]);
    
    res.json({ 
      success: true, 
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
};

// Register new patient and add to queue
exports.registerNewPatientAndQueue = async (req, res) => {
  try {
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
      doctor_id
    } = req.body;
    
    await db.beginTransaction();

    try {
      // Generate patient ID with doctor prefix
      let newPatientId;
      try {
        const dId = doctor_id || (req.user?.role === 'doctor' ? req.user.doctor_id : null);
        newPatientId = await generateUHID(db, dId);
      } catch {
        newPatientId = 'DRA' + Date.now();
      }

      // Get doctor_id from request body or logged-in user
      let finalDoctorId = doctor_id;
      if (!finalDoctorId && req.user?.role === 'doctor') {
        if (req.user.doctor_id) {
          finalDoctorId = req.user.doctor_id;
        } else if (req.user.id) {
          const [doctorLookup] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
          if (doctorLookup.length > 0) {
            finalDoctorId = doctorLookup[0].id;
          }
        }
      }
      const clinicId = req.user?.clinic_id || 2;

      // Register patient
      const [patientResult] = await db.execute(`
        INSERT INTO patients (
          patient_id, name, age_years, gender, phone, address, email, blood_group, primary_doctor_id, clinic_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [newPatientId, name, age, gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : gender === 'Other' ? 'O' : 'U', phone, address, email, blood_group, finalDoctorId, clinicId]);
      
      const patientId = patientResult.insertId;

      // Add to queue
      const queueResult = await addToQueue(db, {
        patient_id: patientId,
        queue_date: queue_date || getLocalDateString(),
        visit_type: visit_type || 'new_complaint',
        doctor_id: doctor_id,
        created_by: req.user.id
      });
      
      await db.commit();
      
      res.json({
        success: true,
        patient: {
          id: patientId,
          patient_id: newPatientId,
          name,
          age,
          gender,
          phone,
          address,
          email,
          blood_group
        },
        queue: queueResult
      });
      
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Register patient and queue error:', error);
    res.status(500).json({ error: 'Failed to register patient and add to queue' });
  }
};

// Add existing patient to queue
exports.addExistingPatientToQueue = async (req, res) => {
  try {
    const db = getDb();
    const {
      patient_id,
      queue_date,
      visit_type,
      doctor_id
    } = req.body;
    
    // Check if patient already in queue for selected date
    const [existingQueue] = await db.execute(`
      SELECT q.id FROM queue q
      WHERE q.patient_id = ? AND DATE(q.check_in_time) = ?
      AND q.status NOT IN ('completed', 'cancelled', 'no-show')
    `, [patient_id, queue_date || getLocalDateString()]);
    
    if (existingQueue.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Patient already in queue for selected date'
      });
    }
    
    const queueResult = await addToQueue(db, {
      patient_id,
      queue_date: queue_date || getLocalDateString(),
      visit_type: visit_type || 'follow_up',
      doctor_id: doctor_id,
      created_by: req.user.id
    });
    
    res.json({
      success: true,
      queue: queueResult
    });
    
  } catch (error) {
    console.error('Add existing patient to queue error:', error);
    res.status(500).json({ error: 'Failed to add patient to queue' });
  }
};

// Helper function to add patient to queue
async function addToQueue(db, { patient_id, queue_date, visit_type, doctor_id, created_by }) {
  // Use main queue contract/columns (check_in_date + queue_number) to avoid race conditions
  const qDate = queue_date || getLocalDateString();

  // Run as atomic unit when called inside an existing transaction
  // Lock existing active entry for this patient/day
  const [existing] = await db.execute(
    `SELECT id, token_number FROM queue
      WHERE patient_id = ?
        AND check_in_date = ?
        AND status NOT IN ('completed', 'cancelled', 'no-show')
      FOR UPDATE`,
    [patient_id, qDate]
  );
  if (existing.length > 0) {
    return {
      id: existing[0].id,
      token_number: existing[0].token_number,
      queue_date: qDate,
      visit_type,
      status: 'waiting'
    };
  }

  // Generate next queue number with lock held
  const [tokenRows] = await db.execute(
    `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_queue_number
       FROM queue
      WHERE check_in_date = ?
      FOR UPDATE`,
    [qDate]
  );
  const nextQueueNumber = tokenRows[0]?.next_queue_number || 1;
  const token = String(nextQueueNumber);
  const finalDoctorId = doctor_id || null;

  // Add to queue
  const [queueResult] = await db.execute(
    `INSERT INTO queue (
      patient_id,
      token_number,
      queue_number,
      check_in_time,
      check_in_date,
      status,
      visit_type,
      doctor_id,
      created_by
    ) VALUES (?, ?, ?, NOW(), ?, 'waiting', ?, ?, ?)`
  , [patient_id, token, nextQueueNumber, qDate, visit_type, finalDoctorId, created_by]);

  return {
    id: queueResult.insertId,
    token_number: token,
    queue_date: qDate,
    visit_type,
    status: 'waiting'
  };
}

// Get queue for selected date
exports.getQueueByDate = async (req, res) => {
  try {
    const db = getDb();
    const { date = getLocalDateString(), page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM queue q
      WHERE DATE(q.check_in_time) = ?
    `, [date]);
    
    const total = countResult[0].total;
    
    const [queue] = await db.execute(`
      SELECT 
        q.id,
        q.token_number,
        q.check_in_time,
        q.status,
        q.visit_type,
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
      LIMIT ? OFFSET ?
    `, [date, parseInt(limit), offset]);
    
    res.json({ 
      success: true, 
      queue,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get queue by date error:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
};

// Get available doctors for queue
exports.getAvailableDoctors = async (req, res) => {
  try {
    const db = getDb();
    
    const [doctors] = await db.execute(`
      SELECT 
        d.id,
        u.name,
        d.specialization,
        d.consultation_fee,
        d.is_active
      FROM doctors d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.is_active = 1
      ORDER BY u.name
    `);
    
    res.json({ success: true, doctors });
  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({ error: 'Failed to fetch available doctors' });
  }
};

module.exports = require('./patientQueueController_refactored');
