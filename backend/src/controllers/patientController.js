const { getDb } = require('../config/db');
const { clearCache } = require('../middleware/cache');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateUHID } = require('../utils/uhidHelper');

async function listPatients(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      blood_group,
      city,
      state,
      tab = 0,
      doctor_id,
      context
    } = req.query;
    const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 10, 100));
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limitNum;
    const db = getDb();

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filter patients: doctor sees own patients, staff sees their assigned doctor's patients.
    // For certain contexts (like billing/receipts search), we may want a broader search.
    const isReceiptContext = context === 'receipt';

    if (!isReceiptContext && req.user && (req.user.role === 'doctor' || req.user.role === 'staff')) {
      let doctorId = req.user.doctor_id;

      if (!doctorId && req.user.role === 'doctor' && req.user.id) {
        const [doctors] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
        if (doctors.length > 0) doctorId = doctors[0].id;
      } else if (!doctorId && req.user.role === 'staff' && req.user.id) {
        // Staff: look up assigned doctor from doctor_staff table
        const [ds] = await db.execute(
          'SELECT doctor_id FROM doctor_staff WHERE staff_user_id = ? AND is_active = 1 LIMIT 1',
          [req.user.id]
        );
        if (ds.length > 0) doctorId = ds[0].doctor_id;
      }

      if (doctorId) {
        whereClause += ' AND p.primary_doctor_id = ?';
        params.push(doctorId);
      } else if (req.user.clinic_id) {
        whereClause += ' AND p.clinic_id = ?';
        params.push(req.user.clinic_id);
      }
    }

    // Add manual doctor_id filter if provided
    if (doctor_id) {
      whereClause += ' AND p.primary_doctor_id = ?';
      params.push(doctor_id);
    }

    // Add search filter
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.patient_id LIKE ? OR p.phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Add other filters
    if (gender) {
      whereClause += ' AND p.gender = ?';
      params.push(gender);
    }

    if (blood_group) {
      whereClause += ' AND p.blood_group = ?';
      params.push(blood_group);
    }

    if (city) {
      whereClause += ' AND p.city LIKE ?';
      params.push(`%${city}%`);
    }

    const executePatientsQuery = async (selectFields) => {
      const sql = `
        SELECT
          ${selectFields.join(',\n          ')}
        FROM patients p
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      const [rows] = await db.execute(sql, params);
      return rows;
    };

    // Main query - schema-resilient fields for list view.
    // Some deployments may not have newer columns (e.g. abha_account_id, age_years).
    const fieldSets = [
      [
        'p.id',
        'p.patient_id',
        'p.name',
        'p.gender',
        'p.dob',
        'p.age_years',
        'p.phone',
        'p.email',
        'p.blood_group',
        'p.city',
        'p.state',
        'p.abha_account_id',
        'p.created_at',
        'p.updated_at',
      ],
      [
        'p.id',
        'p.patient_id',
        'p.name',
        'p.gender',
        'p.dob',
        'p.phone',
        'p.email',
        'p.blood_group',
        'p.city',
        'p.state',
        'p.created_at',
        'p.updated_at',
      ],
      [
        'p.id',
        'p.patient_id',
        'p.name',
        'p.phone',
        'p.created_at',
        'p.updated_at',
      ],
    ];

    let patients = [];
    let lastError = null;
    for (const fields of fieldSets) {
      try {
        patients = await executePatientsQuery(fields);
        lastError = null;
        break;
      } catch (err) {
        // Retry if DB schema is missing a selected column.
        if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    if (lastError) {
      throw lastError;
    }

    // Count query - simplified without JOIN
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total FROM patients p ${whereClause}
    `, params);
    const total = countResult[0]?.total || 0;

    return sendSuccess(res, {
      patients: patients,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('listPatients error:', error);
    sendError(res, 'Failed to fetch patients', 500, process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
}

async function getPatient(req, res) {
  try {
    const { id } = req.params;

    
    // Validate ID parameter
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Valid Patient ID is required' });
    }

    const rawId = String(id).trim();
    const normalizedId = rawId.split(':')[0].split('/')[0].trim();

    if (!normalizedId) {
      return res.status(400).json({ error: 'Valid Patient ID is required' });
    }

    const db = getDb();
    let rows = [];

    // Try numeric ID first (database id)
    if (/^\d+$/.test(normalizedId)) {
      [rows] = await db.execute('SELECT * FROM patients WHERE id = ?', [parseInt(normalizedId, 10)]);
    }

    // If not found, try patient_id by raw or normalized values
    if (!rows.length) {
      [rows] = await db.execute(
        'SELECT * FROM patients WHERE patient_id = ? OR patient_id = ? LIMIT 1',
        [rawId, normalizedId]
      );
    }
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Patient not found', searchedId: id });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get patient', details: error.message });
  }
}

async function addPatient(req, res) {
  try {
    const {
      patient_id,
      name,
      email,
      phone,
      dob,
      gender,
      blood_group,
      address,
      city,
      state,
      pincode,
      emergency_contact_name,
      emergency_contact_phone,
      medical_conditions,
      allergies,
      current_medications,
      clinic_id,
      is_vip,
      vip_tier,
      priority,
      age_years
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Patient name is required' });
    }

    // Map gender to database ENUM values
    const genderMap = {
      'Male': 'M',
      'male': 'M',
      'M': 'M',
      '1': 'M',
      'Female': 'F',
      'female': 'F',
      'F': 'F',
      '2': 'F',
      'Other': 'O',
      'other': 'O',
      'O': 'O',
      'Unknown': 'U',
      'unknown': 'U',
      'U': 'U'
    };
    const mappedGender = gender ? (genderMap[gender] || 'U') : 'U';

    const db = getDb();

    // Get clinic_id from request body, user context, or default to 2
    const patientClinicId = clinic_id || req.user?.clinic_id || 2;

    // Set primary_doctor_id from logged-in doctor
    // If user is a doctor, look up their doctor_id from doctors table using user_id
    let primaryDoctorId = req.user?.doctor_id || null;

    if (!primaryDoctorId && req.user?.role === 'doctor' && req.user?.id) {
      const [doctors] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
      if (doctors.length > 0) {
        primaryDoctorId = doctors[0].id;
      }
    }

    // Fallback to request body if still not set
    if (!primaryDoctorId) {
      primaryDoctorId = req.body.doctor_id || req.body.primary_doctor_id || null;
    }

    // Generate patient_id with doctor-based prefix: DRA1, DRB1, DRC1, etc.
    let generatedPatientId = patient_id;
    if (!generatedPatientId) {
      try {
        generatedPatientId = await generateUHID(db, primaryDoctorId);
      } catch (uhidErr) {
        console.error('UHID generation error, falling back:', uhidErr.message);
        generatedPatientId = `DRA${Date.now()}`;
      }
    }
    const [result] = await db.execute(
      `INSERT INTO patients (
          patient_id, name, email, phone, dob, age_years, gender, blood_group,
          address, city, state, pincode, emergency_contact_name, emergency_contact_phone,
          medical_conditions, allergies, current_medications, clinic_id,
          primary_doctor_id, is_vip, vip_tier, priority, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedPatientId,
        name || null,
        email || null,
        phone || null,
        dob || null,
        age_years ? parseInt(age_years, 10) : null,
        mappedGender,
        blood_group || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        medical_conditions || null,
        allergies || null,
        current_medications || null,
        patientClinicId,
        primaryDoctorId,
        is_vip || 0,
        vip_tier || null,
        priority || 0,
        req.user?.id || 2 // Default user ID = 2 (first available user) if not logged in
      ]
    );

    // Update patient statistics
    await db.execute('CALL sp_update_patient_stats(?)', [result.insertId]);

    // Clear cache to ensure fresh data on next fetch
    clearCache('/api/patients');

    // Return the full created patient record so frontend callers immediately
    // have access to fields like `age_years` and `dob` without an extra fetch.
    const [createdRows] = await db.execute('SELECT * FROM patients WHERE id = ?', [result.insertId]);
    const createdPatient = (createdRows && createdRows[0]) ? createdRows[0] : { id: result.insertId, patient_id: generatedPatientId };

    res.status(201).json({
      patient: createdPatient,
      message: 'Patient added successfully'
    });
  } catch (error) {
    // Handle duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Patient ID already exists' });
    }
    
    res.status(500).json({ error: 'Failed to add patient', details: error.message });
  }
}

async function updatePatient(req, res) {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined') {
      return res.status(400).json({ error: 'Valid Patient ID is required' });
    }

    const {
      patient_id,
      name,
      email,
      phone,
      dob,
      age_years,
      gender,
      blood_group,
      address,
      city,
      state,
      pincode,
      emergency_contact_name,
      emergency_contact_phone,
      medical_conditions,
      allergies,
      current_medications
    } = req.body;

    // Map gender to DB ENUM values (M, F, O, U)
    const genderMap = { 'Male': 'M', 'Female': 'F', 'Other': 'O', 'M': 'M', 'F': 'F', 'O': 'O', 'U': 'U' };
    const mappedGender = gender ? (genderMap[gender] || null) : null;

    const db = getDb();
    
    // Determine if we're updating by numeric ID or patient_id
    const isNumericId = /^\d+$/.test(id);
    let whereClause = isNumericId ? 'id = ?' : 'patient_id = ?';
    let whereValue = isNumericId ? parseInt(id, 10) : id;

    // NOT NULL column: never clear UHID when client sends empty/null (Edit Patient modal)
    let finalPatientId = patient_id;
    if (finalPatientId == null || String(finalPatientId).trim() === '') {
      const [existingPid] = await db.execute(
        `SELECT patient_id FROM patients WHERE ${whereClause}`,
        [whereValue]
      );
      if (existingPid.length) {
        finalPatientId = existingPid[0].patient_id;
      }
    }

    const query = `UPDATE patients SET
        patient_id = ?, name = ?, email = ?, phone = ?, dob = ?, age_years = ?, gender = ?,
        blood_group = ?, address = ?, city = ?, state = ?, pincode = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?, medical_conditions = ?,
        allergies = ?, current_medications = ?, updated_at = CURRENT_TIMESTAMP
       WHERE ${whereClause}`;

    const queryParams = [
        finalPatientId,
        name || null,
        email || null,
        phone || null,
        dob || null,
        age_years != null ? parseInt(age_years, 10) : null,
        mappedGender,
        blood_group || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        medical_conditions || null,
        allergies || null,
        current_medications || null,
        whereValue
    ];

    const [result] = await db.execute(query, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Clear cache to ensure fresh data on next fetch
    clearCache('/api/patients');

    res.json({ message: 'Patient updated successfully' });
  } catch (error) {
    console.error('🔍 Update patient error:', error);
    console.error('🔍 Error details:', error.message);
    console.error('🔍 Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update patient', details: error.message });
  }
}

async function deletePatient(req, res) {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined') {
      return res.status(400).json({ error: 'Valid Patient ID is required' });
    }

    const db = getDb();

    // Determine if we're deleting by numeric ID or patient_id
    const isNumericId = /^\d+$/.test(id);
    let whereClause = isNumericId ? 'id = ?' : 'patient_id = ?';
    let value = isNumericId ? parseInt(id, 10) : id;

    // First, check if patient exists
    const [existingPatient] = await db.execute(
      `SELECT id FROM patients WHERE ${whereClause}`,
      [value]
    );

    if (existingPatient.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patientId = existingPatient[0].id;

    // Database has ON DELETE CASCADE, so related records will be automatically deleted
    // Just proceed with deletion
    const [result] = await db.execute(
      `DELETE FROM patients WHERE ${whereClause}`,
      [value]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Clear cache to ensure fresh data on next fetch
    clearCache('/api/patients');

    res.json({
      message: 'Patient deleted successfully',
      note: 'Related appointments, bills, and medical records were also removed due to cascade delete.'
    });
  } catch (error) {

    // Handle foreign key constraint errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({
        error: 'Cannot delete patient due to existing related records. Please contact administrator.'
      });
    }

    res.status(500).json({ error: 'Failed to delete patient', details: error.message });
  }
}

async function mergePatients(req, res) {
  const { primaryPatientId, patientIdsToMerge } = req.body;

  if (!primaryPatientId || !patientIdsToMerge || !Array.isArray(patientIdsToMerge) || patientIdsToMerge.length < 1) {
    return res.status(400).json({ error: 'Primary patient ID and patients to merge array are required' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get primary patient data
    const [primaryPatient] = await connection.execute('SELECT * FROM patients WHERE id = ?', [primaryPatientId]);
    if (!primaryPatient.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Primary patient not found' });
    }

    // Build placeholders for IN clause
    const placeholders = patientIdsToMerge.map(() => '?').join(',');
    
    // Get patients to merge
    const [patientsToMerge] = await connection.execute(
      `SELECT * FROM patients WHERE id IN (${placeholders})`, 
      patientIdsToMerge
    );

    // Merge logic: Update primary patient with any missing information from other patients
    const primary = primaryPatient[0];
    let updatedData = { ...primary };

    // Simple merge logic - prioritize non-null values
    patientsToMerge.forEach(patient => {
      if (!updatedData.email && patient.email) updatedData.email = patient.email;
      if (!updatedData.phone && patient.phone) updatedData.phone = patient.phone;
      if (!updatedData.address && patient.address) updatedData.address = patient.address;
      if (!updatedData.city && patient.city) updatedData.city = patient.city;
      if (!updatedData.state && patient.state) updatedData.state = patient.state;
      if (!updatedData.pincode && patient.pincode) updatedData.pincode = patient.pincode;
      if (!updatedData.emergency_contact && patient.emergency_contact) updatedData.emergency_contact = patient.emergency_contact;
      if (!updatedData.emergency_phone && patient.emergency_phone) updatedData.emergency_phone = patient.emergency_phone;
      if (!updatedData.medical_conditions && patient.medical_conditions) updatedData.medical_conditions = patient.medical_conditions;
      if (!updatedData.allergies && patient.allergies) updatedData.allergies = patient.allergies;
      if (!updatedData.current_medications && patient.current_medications) updatedData.current_medications = patient.current_medications;
    });

    // Update primary patient with merged data
    await connection.execute(
      `UPDATE patients SET
        email = ?, phone = ?, address = ?, city = ?, state = ?, pincode = ?,
        emergency_contact = ?, emergency_phone = ?, medical_conditions = ?,
        allergies = ?, current_medications = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updatedData.email, updatedData.phone, updatedData.address, updatedData.city,
        updatedData.state, updatedData.pincode, updatedData.emergency_contact,
        updatedData.emergency_phone, updatedData.medical_conditions, updatedData.allergies,
        updatedData.current_medications, primaryPatientId
      ]
    );

    // Update related records to point to primary patient
    const relatedTables = [
      'appointments',
      'medical_records', 
      'prescriptions',
      'bills',
      'lab_investigations',
      'patient_vitals',
      'family_history',
      'insurance_policies',
      'abha_records',
      'patient_tags',
      'queue',
      'test_reports'
    ];

    for (const table of relatedTables) {
      try {
        await connection.execute(
          `UPDATE ${table} SET patient_id = ? WHERE patient_id IN (${placeholders})`,
          [primaryPatientId, ...patientIdsToMerge]
        );
      } catch (err) {
        // Table might not have patient_id or records, continue
        // Skipping table if it doesnt exist
      }
    }

    // Delete merged patients (excluding primary)
    const idsToDelete = patientIdsToMerge.filter(id => id !== primaryPatientId);
    if (idsToDelete.length > 0) {
      const deletePlaceholders = idsToDelete.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM patients WHERE id IN (${deletePlaceholders})`, 
        idsToDelete
      );
    }

    await connection.commit();
    connection.release();

    // Clear cache to ensure fresh data on next fetch
    clearCache('/api/patients');

    res.json({
      message: 'Patients merged successfully',
      primaryPatientId,
      mergedCount: idsToDelete.length
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: 'Failed to merge patients', details: error.message });
  }
}

// Get patient by patient_id (string ID like P882724640)
async function getPatientByPatientId(req, res) {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const db = getDb();
    const [rows] = await db.execute('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get patient', details: error.message });
  }
}

// Dashboard helper: count patients assigned to logged-in doctor
async function getMyPatientsCount(req, res) {
  try {
    const db = getDb();

    // Resolve doctor_id
    let doctorId = req.user?.doctor_id || null;
    if (!doctorId && req.user?.id) {
      const [rows] = await db.execute('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (rows.length > 0) doctorId = rows[0].id;
    }
    if (!doctorId) {
      return res.json({ count: 0 });
    }

    const [rows] = await db.execute(
      'SELECT COUNT(*) AS count FROM patients WHERE primary_doctor_id = ?',
      [doctorId]
    );

    return res.json({ count: parseInt(rows[0]?.count || 0, 10) });
  } catch (error) {
    console.error('getMyPatientsCount error:', error);
    return res.status(500).json({ error: 'Failed to fetch patients count' });
  }
}

// Dashboard helper: count new patients registered today
async function getTodayNewPatientsCount(req, res) {
  try {
    const db = getDb();
    const clinicId = req.user?.clinic_id || null;

    const where = ['DATE(created_at) = CURDATE()'];
    const params = [];
    if (clinicId) {
      where.push('clinic_id = ?');
      params.push(clinicId);
    }

    const [rows] = await db.execute(
      `SELECT COUNT(*) AS count FROM patients WHERE ${where.join(' AND ')}`,
      params
    );

    return res.json({ count: parseInt(rows[0]?.count || 0, 10) });
  } catch (error) {
    console.error('getTodayNewPatientsCount error:', error);
    return res.status(500).json({ error: 'Failed to fetch today patients' });
  }
}

module.exports = require('./patientController_refactored');