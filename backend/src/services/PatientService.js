const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { generateUHID } = require('../utils/uhidHelper');

/**
 * PatientService - Encapsulates all patient business logic
 * Handles CRUD operations, filtering, pagination, and patient-specific validations
 */
class PatientService {
  /**
   * Create a new patient
   * @param {Object} patientData - { name, email, phone, gender, dob, age_years, blood_group, address, city, state, pincode, primary_doctor_id, clinic_id }
   * @returns {Promise<Object>} Created patient
   */
  async create(patientData) {
    const {
      name,
      email,
      phone,
      gender,
      dob,
      age_years,
      blood_group,
      address,
      city,
      state,
      pincode,
      primary_doctor_id,
      clinic_id,
      created_by,
    } = patientData;

    // Validation
    if (!name) throw ApiError.badRequest('Patient name required', 'name');
    if (!clinic_id) throw ApiError.badRequest('Clinic ID required', 'clinic_id');

    // Age can be entered directly when a patient does not know their DOB.
    // Treat zero as a valid age (newborn) instead of dropping it as falsy.
    const providedAgeYears = age_years === '' || age_years === undefined || age_years === null
      ? null
      : Number(age_years);
    if (providedAgeYears !== null && (!Number.isInteger(providedAgeYears) || providedAgeYears < 0 || providedAgeYears > 150)) {
      throw ApiError.badRequest('Age must be a whole number between 0 and 150', 'age_years');
    }

    // Phone validation (basic, only if provided)
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '') : '';
    if (normalizedPhone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(normalizedPhone)) {
        throw ApiError.badRequest('Invalid phone number (10 digits required)', 'phone');
      }
    }

    // Normalize gender to DB enum codes (M/F/O/U)
    const genderMap = {
      male: 'M',
      m: 'M',
      '1': 'M',
      female: 'F',
      f: 'F',
      '2': 'F',
      other: 'O',
      o: 'O',
      unknown: 'U',
      u: 'U'
    };
    const safeGender = gender ? (genderMap[String(gender).trim().toLowerCase()] || 'U') : 'U';

    // Email validation if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw ApiError.badRequest('Invalid email format', 'email');
      }
    }

    const db = getDb();

    try {
      // Check if clinic exists
      const [clinics] = await db.execute('SELECT id FROM clinics WHERE id = ?', [clinic_id]);
      if (clinics.length === 0) {
        throw ApiError.notFound('Clinic not found', 'clinic_id');
      }

      // Generate UHID
      let patient_id;
      try {
        patient_id = await generateUHID(db, primary_doctor_id || null);
      } catch (_e) {
        patient_id = `DRA${Date.now()}`;
      }

      // A DOB is the source of truth when one is provided; otherwise preserve
      // the explicitly entered age so age-only registrations are not lost.
      const calculatedAgeYears = dob ? this._calculateAge(dob) : null;
      const savedAgeYears = calculatedAgeYears ?? providedAgeYears;

      // Create patient
      const [result] = await db.execute(`
        INSERT INTO patients (
          patient_id, name, email, phone, dob, age_years, gender, blood_group,
          address, city, state, pincode,
          clinic_id, primary_doctor_id, created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        patient_id,
        name,
        email || null,
        normalizedPhone || null,
        dob || null,
        savedAgeYears,
        safeGender,
        blood_group || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
        clinic_id,
        primary_doctor_id || null,
        created_by || null,
      ]);

      return this.getById(result.insertId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error?.code === 'ER_DUP_ENTRY') {
        // Most likely a DB UNIQUE index on phone (or clinic_id+phone)
        throw ApiError.conflict('Duplicate entry. A patient with this phone already exists (DB constraint).', 'phone');
      }
      throw ApiError.internal('Failed to create patient', error.message);
    }
  }

  /**
   * Get patient by ID
   * @param {number} id - Patient ID
   * @returns {Promise<Object>} Patient with related data
   */
  async getById(id) {
    if (!id) throw ApiError.badRequest('Patient ID required', 'id');

    const db = getDb();

    try {
      const [patients] = await db.execute(`
        SELECT 
          p.*,
          d.specialization as primary_doctor_specialization,
          u.name as primary_doctor_name,
          u.phone as primary_doctor_phone,
          c.name as clinic_name
        FROM patients p
        LEFT JOIN doctors d ON p.primary_doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON p.clinic_id = c.id
        WHERE p.id = ?
      `, [id]);

      if (patients.length === 0) {
        throw ApiError.notFound('Patient not found', 'id');
      }

      return patients[0];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to fetch patient', error.message);
    }
  }

  /**
   * Get patient by patient_id (identifier)
   * @param {string} patientId - Patient identifier
   * @returns {Promise<Object>} Patient with related data
   */
  async getByPatientId(patientId) {
    if (!patientId) throw ApiError.badRequest('Patient ID required', 'patientId');

    const db = getDb();

    try {
      const [patients] = await db.execute(`
        SELECT 
          p.*,
          d.specialization as primary_doctor_specialization,
          u.name as primary_doctor_name,
          c.name as clinic_name
        FROM patients p
        LEFT JOIN doctors d ON p.primary_doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON p.clinic_id = c.id
        WHERE p.patient_id = ?
      `, [patientId]);

      if (patients.length === 0) {
        throw ApiError.notFound('Patient not found', 'patientId');
      }

      return patients[0];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to fetch patient', error.message);
    }
  }

  /**
   * Get all patients with pagination and filtering
   * @param {Object} options - { page, limit, search, gender, blood_group, city, state, sortBy, userRole, userId, doctorId, clinicId }
   * @returns {Promise<Object>} { data, pagination }
   */
  async getAll(options = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      blood_group,
      city,
      state,
      sortBy = 'created_at',
      context,
      userRole,
      userId,
      doctorId,
      clinicId,
    } = options;

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 10, 500);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Some deployments don't have `patients.is_active`; use soft-delete column instead.
      let whereClause = 'WHERE p.deleted_at IS NULL';
      const params = [];

      let effectiveDoctorId = doctorId;
      if (userRole === 'doctor' && !effectiveDoctorId && userId) {
        const [rows] = await db.execute('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
        if (rows && rows.length) {
          effectiveDoctorId = rows[0].id;
        }
      }

      // Authorization-based filtering
      // For receipt context, allow broader search across all clinic patients
      const isReceiptContext = context === 'receipt';
      if (!isReceiptContext && userRole === 'doctor' && effectiveDoctorId) {
        whereClause += ' AND p.primary_doctor_id = ?';
        params.push(effectiveDoctorId);
      } else if (clinicId) {
        whereClause += ' AND p.clinic_id = ?';
        params.push(clinicId);
      }

      // Search filter
      if (search) {
        whereClause += ' AND (p.name LIKE ? OR p.patient_id LIKE ? OR p.phone LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Other filters
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

      if (state) {
        whereClause += ' AND p.state LIKE ?';
        params.push(`%${state}%`);
      }

      // Get total count
      const [[{ total }]] = await db.execute(`
        SELECT COUNT(*) as total FROM patients p
        ${whereClause}
      `, params);

      // Get paginated data
      const sortClause = this._buildSortClause(sortBy);
      const [patients] = await db.execute(`
        SELECT 
          p.id,
          p.patient_id,
          p.name,
          p.gender,
          p.dob,
          p.age_years,
          p.phone,
          p.email,
          p.blood_group,
          p.city,
          p.state,
          p.created_at,
          p.updated_at,
          u.name as primary_doctor_name,
          c.name as clinic_name
        FROM patients p
        LEFT JOIN doctors d ON p.primary_doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON p.clinic_id = c.id
        ${whereClause}
        ORDER BY ${sortClause}
        LIMIT ${limitNum} OFFSET ${offset}
      `, params);

      const totalPages = Math.ceil(total / limitNum);

      return {
        data: patients,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to fetch patients', error.message);
    }
  }

  /**
   * Update patient
   * @param {number} id - Patient ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated patient
   */
  async update(id, updateData) {
    if (!id) throw ApiError.badRequest('Patient ID required', 'id');

    const db = getDb();

    try {
      // Verify patient exists
      await this.getById(id);

      // Build update query dynamically
      // FIX (2026-07-11): this whitelist previously referenced columns that do
      // not exist on `patients` (postal_code, aadhaar_number, insurance_provider,
      // insurance_policy_number, chronic_conditions) and omitted fields the edit
      // form actually sends (pincode, medical_conditions, current_medications) —
      // so those edits were silently dropped, and a phantom column would have
      // thrown a SQL error. Now matched to the real schema + edit form.
      const allowedFields = [
        'name', 'email', 'phone', 'alternate_phone', 'gender', 'dob', 'age_years',
        'blood_group', 'address', 'landmark', 'city', 'district', 'state',
        'pincode', 'country', 'occupation', 'marital_status', 'education',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        'medical_conditions', 'allergies', 'current_medications',
        'aadhaar_number_masked', 'is_vip', 'vip_tier',
        'primary_doctor_id', 'abha_account_id',
      ];

      // These columns are MySQL ENUMs — '' is not a valid enum member (only a
      // real value or NULL), so an empty string here throws "Data truncated
      // for column" and the whole update 500s. The edit form sends '' when a
      // dropdown is cleared, so normalize that to NULL before it hits SQL.
      const enumFields = ['gender', 'marital_status', 'blood_group', 'vip_tier'];

      const updates = {};
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key) || updateData[key] === undefined) return;

        if (key === 'age_years') {
          if (updateData[key] === '' || updateData[key] === null) {
            updates.age_years = null;
            return;
          }
          const age = Number(updateData[key]);
          if (!Number.isInteger(age) || age < 0 || age > 150) {
            throw ApiError.badRequest('Age must be a whole number between 0 and 150', 'age_years');
          }
          updates.age_years = age;
          return;
        }

        if (key === 'dob' && updateData[key] === '') {
          updates.dob = null;
          return;
        }

        updates[key] = enumFields.includes(key) && updateData[key] === '' ? null : updateData[key];
      });

      // Re-validate phone if changed
      if (updates.phone) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(updates.phone?.replace(/\D/g, ''))) {
          throw ApiError.badRequest('Invalid phone number (10 digits required)', 'phone');
        }
      }

      // Re-validate email if changed
      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
          throw ApiError.badRequest('Invalid email format', 'email');
        }
      }

      // Keep age in sync when DOB changes. Clearing DOB also clears a stale age
      // unless the caller deliberately supplied a replacement age.
      if (Object.prototype.hasOwnProperty.call(updates, 'dob')) {
        if (updates.dob) {
          updates.age_years = this._calculateAge(updates.dob);
        } else if (!Object.prototype.hasOwnProperty.call(updates, 'age_years')) {
          updates.age_years = null;
        }
      }

      if (Object.keys(updates).length === 0) {
        throw ApiError.badRequest('No valid fields to update', 'updateData');
      }

      updates.updated_at = new Date();

      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      await db.execute(`
        UPDATE patients SET ${setClause} WHERE id = ?
      `, [...values, id]);

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to update patient', error.message);
    }
  }

  /**
   * Delete patient and purge linked records everywhere
   * @param {number} id - Patient ID
   * @returns {Promise<Object>} Deleted patient
   */
  async delete(id) {
    if (!id) throw ApiError.badRequest('Patient ID required', 'id');

    const db = getDb();
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // Lock target patient row to avoid concurrent updates/deletes.
      const [patients] = await conn.query('SELECT * FROM patients WHERE id = ? FOR UPDATE', [id]);
      if (!patients || patients.length === 0) {
        throw ApiError.notFound('Patient not found', 'id');
      }
      const patient = patients[0];

      // Dynamically discover all tables that reference patient_id in current DB
      // and clear those rows first. This keeps behavior consistent across deployments
      // even if FK constraints differ.
      const [[dbInfo]] = await conn.query('SELECT DATABASE() AS dbName');
      const dbName = dbInfo?.dbName;
      if (!dbName) {
        throw ApiError.internal('Unable to resolve database name');
      }

      const [tables] = await conn.query(
        `SELECT DISTINCT TABLE_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'patient_id'`,
        [dbName]
      );

      for (const row of tables || []) {
        const tableName = row?.TABLE_NAME;
        if (!tableName || tableName === 'patients') continue;
        await conn.query(`DELETE FROM \`${tableName}\` WHERE patient_id = ?`, [id]);
      }

      // Finally remove the patient record itself.
      await conn.query('DELETE FROM patients WHERE id = ?', [id]);
      await conn.commit();

      return patient;
    } catch (error) {
      try { await conn.rollback(); } catch { }
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to delete patient', error.message);
    } finally {
      try { conn.release(); } catch { }
    }
  }

  /**
   * Get patient statistics
   * @returns {Promise<Object>} Stats including total, by gender, by blood group
   */
  async getStats() {
    const db = getDb();

    try {
      const [[stats]] = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as male,
          SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as female,
          SUM(CASE WHEN gender = 'Other' THEN 1 ELSE 0 END) as other,
          SUM(CASE WHEN blood_group = 'O+' THEN 1 ELSE 0 END) as o_positive,
          SUM(CASE WHEN blood_group = 'A+' THEN 1 ELSE 0 END) as a_positive,
          SUM(CASE WHEN blood_group = 'B+' THEN 1 ELSE 0 END) as b_positive,
          SUM(CASE WHEN blood_group = 'AB+' THEN 1 ELSE 0 END) as ab_positive
        FROM patients
        WHERE is_active = 1
      `);

      return stats;
    } catch (error) {
      throw ApiError.internal('Failed to fetch patient statistics', error.message);
    }
  }

  // ============ PRIVATE METHODS ============

  /**
   * Calculate age from date of birth
   * @private
   */
  _calculateAge(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return Math.max(0, age);
  }

  /**
   * Build sort clause for SQL query
   * @private
   */
  _buildSortClause(sortBy) {
    const sortMap = {
      name: 'p.name ASC',
      '-name': 'p.name DESC',
      created_at: 'p.created_at DESC',
      '-created_at': 'p.created_at ASC',
      age_years: 'p.age_years ASC',
      '-age_years': 'p.age_years DESC',
      phone: 'p.phone ASC',
      patient_id: 'p.patient_id ASC',
    };

    return sortMap[sortBy] || 'p.created_at DESC';
  }
}

module.exports = new PatientService();
