const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

/**
 * PrescriptionService - Encapsulates all prescription business logic
 * Handles prescription creation, updates, validation, and tracking
 */
class PrescriptionService {
  /**
   * Create a new prescription
   * @param {Object} prescriptionData - { appointment_id, patient_id, doctor_id, medicines, instructions, validity_days }
   * @returns {Promise<Object>} Created prescription
   */
  async create(prescriptionData) {
    const {
      appointment_id,
      patient_id,
      doctor_id,
      medicines = [],
      instructions,
      validity_days = 30,
      notes,
    } = prescriptionData;

    // Validation
    if (!appointment_id) throw ApiError.badRequest('Appointment ID required', 'appointment_id');
    if (!patient_id) throw ApiError.badRequest('Patient ID required', 'patient_id');
    if (!doctor_id) throw ApiError.badRequest('Doctor ID required', 'doctor_id');
    if (!Array.isArray(medicines) || medicines.length === 0) {
      throw ApiError.badRequest('At least one medicine required', 'medicines');
    }

    const db = getDb();

    try {
      // Verify appointment exists
      const [appointments] = await db.execute(
        'SELECT id FROM appointments WHERE id = ?',
        [appointment_id]
      );
      if (appointments.length === 0) {
        throw ApiError.notFound('Appointment not found', 'appointment_id');
      }

      // Verify patient exists
      const [patients] = await db.execute(
        'SELECT id FROM patients WHERE id = ?',
        [patient_id]
      );
      if (patients.length === 0) {
        throw ApiError.notFound('Patient not found', 'patient_id');
      }

      // Verify doctor exists
      const [doctors] = await db.execute(
        'SELECT id FROM doctors WHERE id = ?',
        [doctor_id]
      );
      if (doctors.length === 0) {
        throw ApiError.notFound('Doctor not found', 'doctor_id');
      }

      // Validate medicines
      this._validateMedicines(medicines);

      // Create prescription
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + validity_days);

      const [result] = await db.execute(`
        INSERT INTO prescriptions (
          appointment_id, patient_id, doctor_id, medicines,
          instructions, notes, validity_days, expiry_date,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
      `, [
        appointment_id, patient_id, doctor_id,
        JSON.stringify(medicines), instructions || null, notes || null,
        validity_days, expiryDate,
      ]);

      return this.getById(result.insertId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create prescription', error.message);
    }
  }

  /**
   * Get prescription by ID
   * @param {number} id - Prescription ID
   * @returns {Promise<Object>} Prescription with related data
   */
  async getById(id) {
    if (!id) throw ApiError.badRequest('Prescription ID required', 'id');

    const db = getDb();

    try {
      const [prescriptions] = await db.execute(`
        SELECT 
          p.*,
          pat.patient_id as patient_identifier,
          pat.name as patient_name,
          pat.phone as patient_phone,
          u.name as doctor_name,
          u.email as doctor_email,
          u.phone as doctor_phone,
          a.appointment_date,
          a.appointment_time
        FROM prescriptions p
        LEFT JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN doctors d ON p.doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN appointments a ON p.appointment_id = a.id
        WHERE p.id = ?
      `, [id]);

      if (prescriptions.length === 0) {
        throw ApiError.notFound('Prescription not found', 'id');
      }

      const prescription = prescriptions[0];
      if (prescription.medicines && typeof prescription.medicines === 'string') {
        prescription.medicines = JSON.parse(prescription.medicines);
      }

      return prescription;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to fetch prescription', error.message);
    }
  }

  /**
   * Get all prescriptions with pagination and filtering
   * @param {Object} options - { page, limit, search, patient_id, doctor_id, status, sortBy }
   * @returns {Promise<Object>} { data, pagination }
   */
  async getAll(options = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      patient_id,
      doctor_id,
      status = 'active',
      start_date,
      end_date,
      sortBy = 'created_at',
    } = options;

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 10, 500);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    try {
      let whereClause = 'WHERE 1=1';
      const params = [];

      // Status filter
      if (status) {
        whereClause += ' AND p.status = ?';
        params.push(status);
      }

      // Manual filters
      if (patient_id) {
        whereClause += ' AND p.patient_id = ?';
        params.push(patient_id);
      }

      if (doctor_id) {
        whereClause += ' AND p.doctor_id = ?';
        params.push(doctor_id);
      }

      if (start_date) {
        whereClause += ' AND p.created_at >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND p.created_at <= ?';
        params.push(end_date);
      }

      if (search) {
        whereClause += ' AND (pat.name LIKE ? OR pat.patient_id LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Get total count
      const [[{ total }]] = await db.execute(`
        SELECT COUNT(*) as total FROM prescriptions p
        LEFT JOIN patients pat ON p.patient_id = pat.id
        ${whereClause}
      `, params);

      // Get paginated data
      const sortClause = this._buildSortClause(sortBy);
      const [prescriptions] = await db.execute(`
        SELECT
          p.id,
          p.appointment_id,
          p.patient_id,
          p.doctor_id,
          p.chief_complaint,
          p.diagnosis,
          p.advice,
          p.follow_up_date,
          p.follow_up_days,
          p.patient_notes,
          p.prescribed_date,
          p.status,
          p.created_at,
          p.updated_at,
          pat.patient_id as patient_identifier,
          pat.name as patient_name,
          u.name as doctor_name,
          a.appointment_date
        FROM prescriptions p
        LEFT JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN doctors d ON p.doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN appointments a ON p.appointment_id = a.id
        ${whereClause}
        ORDER BY ${sortClause}
        LIMIT ${limitNum} OFFSET ${offset}
      `, params);

      const totalPages = Math.ceil(total / limitNum);

      return {
        data: prescriptions,
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
      throw ApiError.internal('Failed to fetch prescriptions', error.message);
    }
  }

  /**
   * Update prescription
   * @param {number} id - Prescription ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated prescription
   */
  async update(id, updateData) {
    if (!id) throw ApiError.badRequest('Prescription ID required', 'id');

    const db = getDb();

    try {
      // Verify prescription exists
      const prescription = await this.getById(id);

      // Prevent updating inactive prescriptions
      if (prescription.status !== 'active') {
        throw ApiError.conflict('Cannot modify inactive prescriptions', 'status');
      }

      // Build update query dynamically
      const allowedFields = [
        'medicines', 'instructions', 'notes', 'status',
      ];

      const updates = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          updates[key] = updateData[key];
        }
      });

      // Validate medicines if provided
      if (updates.medicines) {
        if (!Array.isArray(updates.medicines) || updates.medicines.length === 0) {
          throw ApiError.badRequest('At least one medicine required', 'medicines');
        }
        this._validateMedicines(updates.medicines);
        updates.medicines = JSON.stringify(updates.medicines);
      }

      if (Object.keys(updates).length === 0) {
        throw ApiError.badRequest('No valid fields to update', 'updateData');
      }

      updates.updated_at = new Date();

      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      await db.execute(`
        UPDATE prescriptions SET ${setClause} WHERE id = ?
      `, [...values, id]);

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to update prescription', error.message);
    }
  }

  /**
   * Mark prescription as completed/fulfilled
   * @param {number} id - Prescription ID
   * @returns {Promise<Object>} Updated prescription
   */
  async markCompletd(id) {
    if (!id) throw ApiError.badRequest('Prescription ID required', 'id');

    const db = getDb();

    try {
      const prescription = await this.getById(id);

      if (prescription.status !== 'active') {
        throw ApiError.conflict('Only active prescriptions can be marked completed', 'status');
      }

      await db.execute(
        'UPDATE prescriptions SET status = ?, updated_at = NOW() WHERE id = ?',
        ['completed', id]
      );

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to mark prescription completed', error.message);
    }
  }

  /**
   * Delete prescription (soft delete)
   * @param {number} id - Prescription ID
   * @returns {Promise<Object>} Deleted prescription
   */
  async delete(id) {
    if (!id) throw ApiError.badRequest('Prescription ID required', 'id');

    const db = getDb();

    try {
      const prescription = await this.getById(id);

      if (prescription.status === 'completed') {
        throw ApiError.conflict('Cannot delete completed prescriptions', 'status');
      }

      await db.execute(
        'UPDATE prescriptions SET status = ?, updated_at = NOW() WHERE id = ?',
        ['cancelled', id]
      );

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to delete prescription', error.message);
    }
  }

  /**
   * Get prescription statistics
   * @returns {Promise<Object>} Stats including total, by status, medicine usage
   */
  async getStats() {
    const db = getDb();

    try {
      const [[stats]] = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN CURDATE() > expiry_date AND status = 'active' THEN 1 ELSE 0 END) as expired
        FROM prescriptions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      return stats;
    } catch (error) {
      throw ApiError.internal('Failed to fetch prescription statistics', error.message);
    }
  }

  // ============ PRIVATE METHODS ============

  /**
   * Validate medicines array
   * @private
   */
  _validateMedicines(medicines) {
    if (!Array.isArray(medicines)) {
      throw ApiError.badRequest('Medicines must be an array', 'medicines');
    }

    medicines.forEach((medicine, index) => {
      if (!medicine.name) {
        throw ApiError.badRequest(`Medicine ${index + 1}: name required`, 'medicines');
      }
      if (!medicine.dosage) {
        throw ApiError.badRequest(`Medicine ${index + 1}: dosage required`, 'medicines');
      }
      if (!medicine.frequency) {
        throw ApiError.badRequest(`Medicine ${index + 1}: frequency required`, 'medicines');
      }
      if (!medicine.duration) {
        throw ApiError.badRequest(`Medicine ${index + 1}: duration required`, 'medicines');
      }
    });
  }

  /**
   * Build sort clause for SQL query
   * @private
   */
  _buildSortClause(sortBy) {
    const sortMap = {
      created_at: 'p.created_at DESC',
      '-created_at': 'p.created_at ASC',
      patient_name: 'pat.name ASC',
      status: 'p.status ASC',
      expiry_date: 'p.expiry_date DESC',
      doctor_name: 'u.name ASC',
    };

    return sortMap[sortBy] || 'p.created_at DESC';
  }
}

module.exports = new PrescriptionService();
