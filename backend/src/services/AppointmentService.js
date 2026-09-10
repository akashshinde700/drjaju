const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

// A reason-for-visit picker somewhere in the app saves its selected options
// (e.g. [{label:"URI",code:"CUSTOM"}]) as a JSON string instead of extracting
// plain text, and re-editing an appointment that already has one of these
// re-wraps it in another layer of JSON.stringify — so live data has entries
// nested up to 4 deep. Unwrap defensively at the point of writing so it can
// never reach the DB as raw JSON, regardless of which UI sent it.
function sanitizeReasonForVisit(value, depth = 0) {
  if (value == null || depth > 10) return value;
  if (typeof value !== 'string') {
    if (Array.isArray(value)) {
      return value
        .map((item) => (item && typeof item === 'object' && item.label ? String(item.label) : sanitizeReasonForVisit(item, depth + 1)))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof value === 'object' && value.label) return String(value.label);
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '[' && trimmed[0] !== '"')) return trimmed;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return trimmed;
  }
  return sanitizeReasonForVisit(parsed, depth + 1);
}

/**
 * AppointmentService - Encapsulates all appointment business logic
 * Handles CRUD operations, filtering, pagination, and appointment-specific validations
 */
class AppointmentService {
  /**
   * Create a new appointment
   * @param {Object} appointmentData - { patient_id, doctor_id, clinic_id, appointment_date, appointment_time, reason_for_visit, notes }
   * @returns {Promise<Object>} Created appointment
   */
  async create(appointmentData) {
    const {
      patient_id,
      doctor_id,
      clinic_id,
      appointment_date,
      appointment_time,
      reason_for_visit,
      notes,
      appointment_type,
      arrival_type,
    } = appointmentData;

    // DB enums:
    // - appointments.appointment_type: 'offline' | 'online'
    // - appointments.arrival_type: 'online' | 'walk-in' | 'referral' | 'emergency' | 'phone' | 'app'
    const normalizedAppointmentType = (appointment_type === 'online' || appointment_type === 'offline')
      ? appointment_type
      : 'offline';

    const normalizedArrivalType = (() => {
      const v = String(arrival_type || '').trim();
      if (!v) return 'walk-in';
      if (v === 'walk_in' || v === 'walkin') return 'walk-in';
      if (v === 'offline') return 'walk-in';
      if (v === 'scheduled') return 'walk-in';
      if (['online', 'walk-in', 'referral', 'emergency', 'phone', 'app'].includes(v)) return v;
      return 'walk-in';
    })();

    // Validation
    if (!patient_id) throw ApiError.badRequest('Patient ID required', 'patient_id');
    if (!appointment_date) throw ApiError.badRequest('Appointment date required', 'appointment_date');
    if (!appointment_time) throw ApiError.badRequest('Appointment time required', 'appointment_time');

    const db = getDb();

    try {
      // Check patient exists
      const [patients] = await db.execute('SELECT id FROM patients WHERE id = ?', [patient_id]);
      if (patients.length === 0) {
        throw ApiError.notFound('Patient not found', 'patient_id');
      }

      // Check doctor exists (if provided)
      if (doctor_id) {
        const [doctors] = await db.execute('SELECT id FROM doctors WHERE id = ?', [doctor_id]);
        if (doctors.length === 0) {
          throw ApiError.notFound('Doctor not found', 'doctor_id');
        }
      }

      // Check for scheduling conflicts (only if doctor_id provided)
      const conflicts = [];
      if (doctor_id) {
        const [rows] = await db.execute(`
          SELECT id FROM appointments 
          WHERE doctor_id = ? AND clinic_id = ? 
          AND DATE(appointment_date) = ? 
          AND appointment_time = ? 
          AND status NOT IN ('cancelled', 'no-show')
          LIMIT 1
        `, [doctor_id, clinic_id, appointment_date, appointment_time]);
        conflicts.push(...rows);
      }

      if (conflicts.length > 0) {
        throw ApiError.conflict('Time slot already booked for this doctor', 'appointment_time');
      }

      // Create appointment
      const [result] = await db.execute(`
        INSERT INTO appointments (
          patient_id, doctor_id, clinic_id, appointment_date, appointment_time,
          reason_for_visit, notes, appointment_type, arrival_type, status, 
          payment_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 'pending', NOW())
      `, [
        patient_id, doctor_id, clinic_id, appointment_date, appointment_time,
        sanitizeReasonForVisit(reason_for_visit) || null, notes || null, normalizedAppointmentType, normalizedArrivalType,
      ]);

      return this.getById(result.insertId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create appointment', error.message);
    }
  }

  /**
   * Get appointment by ID with all related data
   * @param {number} id - Appointment ID
   * @returns {Promise<Object>} Appointment with related patient, doctor, clinic info
   */
  async getById(id) {
    if (!id) throw ApiError.badRequest('Appointment ID required', 'id');

    const db = getDb();

    try {
      const [appointments] = await db.execute(`
        SELECT 
          a.*,
          (a.consultation_type = 'followup') AS is_follow_up,
          p.patient_id as patient_identifier,
          p.name as patient_name,
          p.phone as patient_phone,
          p.age_years as patient_age,
          p.dob as patient_dob,
          p.gender as patient_gender,
          d.specialization as doctor_specialization,
          u.name as doctor_name,
          u.phone as doctor_phone,
          c.name as clinic_name,
          c.city as clinic_city,
          (SELECT b.id FROM bills b WHERE b.appointment_id = a.id ORDER BY b.created_at DESC LIMIT 1) as bill_id
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON a.clinic_id = c.id
        WHERE a.id = ?
      `, [id]);

      if (appointments.length === 0) {
        throw ApiError.notFound('Appointment not found', 'id');
      }

      return appointments[0];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to fetch appointment', error.message);
    }
  }

  /**
   * Get all appointments with pagination and filtering
   * @param {Object} options - { page, limit, search, status, doctor_id, patient_id, clinic_id, sortBy, userRole, userId, doctorId, clinicId }
   * @returns {Promise<Object>} { data, pagination }
   */
  async getAll(options = {}) {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      date,
      start_date,
      end_date,
      doctor_id,
      patient_id,
      clinic_id,
      sortBy = 'appointment_date',
      userRole,
      userId,
      doctorId: authDoctorId,
      clinicId: authClinicId,
    } = options;

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    try {
      let whereClause = 'WHERE 1=1';
      const params = [];

      // Authorization-based filtering
      if (userRole === 'doctor' && authDoctorId) {
        whereClause += ' AND a.doctor_id = ?';
        params.push(authDoctorId);
      } else if (userRole === 'doctor' && authClinicId) {
        whereClause += ' AND a.clinic_id = ?';
        params.push(authClinicId);
      }

      // Manual filters
      if (doctor_id) {
        whereClause += ' AND a.doctor_id = ?';
        params.push(doctor_id);
      }

      if (patient_id) {
        whereClause += ' AND a.patient_id = ?';
        params.push(patient_id);
      }

      if (clinic_id) {
        whereClause += ' AND a.clinic_id = ?';
        params.push(clinic_id);
      }

      if (status) {
        whereClause += ' AND a.status = ?';
        params.push(status);
      }

      // Date filters also match on visit_ended_at (completed date) for
      // 'completed' rows, not just the originally scheduled appointment_date.
      // A visit scheduled on one day but actually seen/completed on another
      // (e.g. carried over, or a walk-in logged against an older slot)
      // otherwise silently disappears from "on <date>" views for the day it
      // was actually completed — the historical bug behind "previous day's
      // completed patient doesn't show in the filter".
      if (date) {
        whereClause += " AND (DATE(a.appointment_date) = ? OR (a.status = 'completed' AND a.visit_ended_at IS NOT NULL AND DATE(a.visit_ended_at) = ?))";
        params.push(date, date);
      }

      if (start_date && end_date) {
        whereClause += " AND (DATE(a.appointment_date) BETWEEN ? AND ? OR (a.status = 'completed' AND a.visit_ended_at IS NOT NULL AND DATE(a.visit_ended_at) BETWEEN ? AND ?))";
        params.push(start_date, end_date, start_date, end_date);
      } else if (start_date) {
        whereClause += " AND (DATE(a.appointment_date) >= ? OR (a.status = 'completed' AND a.visit_ended_at IS NOT NULL AND DATE(a.visit_ended_at) >= ?))";
        params.push(start_date, start_date);
      } else if (end_date) {
        whereClause += " AND (DATE(a.appointment_date) <= ? OR (a.status = 'completed' AND a.visit_ended_at IS NOT NULL AND DATE(a.visit_ended_at) <= ?))";
        params.push(end_date, end_date);
      }

      if (search) {
        whereClause += ' AND (p.name LIKE ? OR p.patient_id LIKE ? OR p.phone LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Get total count
      const [[{ total }]] = await db.execute(`
        SELECT COUNT(*) as total FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        ${whereClause}
      `, params);

      // Get paginated data
      const sortClause = this._buildSortClause(sortBy);
      const [appointments] = await db.query(`
        SELECT
          a.*,
          (a.consultation_type = 'followup') AS is_follow_up,
          p.patient_id as patient_identifier,
          p.name as patient_name,
          p.phone as patient_phone,
          -- Age/DOB/gender were never selected here, so an appointment-sourced
          -- queue card had no age to show no matter what the patient record
          -- held. (The dead appointmentController.js aliased these as
          -- patient_age/patient_dob and the phone as contact, which is why the
          -- UI looked for field names this query never sent.)
          p.age_years as patient_age,
          p.dob as patient_dob,
          p.gender as patient_gender,
          d.specialization as doctor_specialization,
          u.name as doctor_name,
          c.name as clinic_name,
          COALESCE(
            (SELECT b.id FROM bills b WHERE b.appointment_id = a.id ORDER BY b.created_at DESC LIMIT 1),
            (SELECT b.id FROM bills b WHERE b.appointment_id IS NULL AND b.patient_id = a.patient_id AND DATE(b.bill_date) = DATE(a.appointment_date) ORDER BY b.created_at DESC LIMIT 1)
          ) as bill_id,
          COALESCE(
            (SELECT b.total_amount FROM bills b WHERE b.appointment_id = a.id ORDER BY b.created_at DESC LIMIT 1),
            (SELECT b.total_amount FROM bills b WHERE b.appointment_id IS NULL AND b.patient_id = a.patient_id AND DATE(b.bill_date) = DATE(a.appointment_date) ORDER BY b.created_at DESC LIMIT 1)
          ) as bill_total,
          COALESCE(
            (SELECT b.payment_status FROM bills b WHERE b.appointment_id = a.id ORDER BY b.created_at DESC LIMIT 1),
            (SELECT b.payment_status FROM bills b WHERE b.appointment_id IS NULL AND b.patient_id = a.patient_id AND DATE(b.bill_date) = DATE(a.appointment_date) ORDER BY b.created_at DESC LIMIT 1)
          ) as bill_payment_status,
          COALESCE(
            (SELECT b.amount_paid FROM bills b WHERE b.appointment_id = a.id ORDER BY b.created_at DESC LIMIT 1),
            (SELECT b.amount_paid FROM bills b WHERE b.appointment_id IS NULL AND b.patient_id = a.patient_id AND DATE(b.bill_date) = DATE(a.appointment_date) ORDER BY b.created_at DESC LIMIT 1)
          ) as bill_amount_paid
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON a.clinic_id = c.id
        ${whereClause}
        ORDER BY ${sortClause}
        LIMIT ${limitNum} OFFSET ${offset}
      `, params);

      const totalPages = Math.ceil(total / limitNum);

      return {
        data: appointments,
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
      throw ApiError.internal('Failed to fetch appointments', error.message);
    }
  }

  /**
   * Update appointment
   * @param {number} id - Appointment ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated appointment
   */
  async update(id, updateData) {
    if (!id) throw ApiError.badRequest('Appointment ID required', 'id');

    const db = getDb();

    try {
      // Verify appointment exists
      const existing = await this.getById(id);

      // If status is being updated, validate transition
      if (updateData.status && updateData.status !== existing.status) {
        this._validateStatusTransition(existing.status, updateData.status);
      }

      // Build update query dynamically
      const allowedFields = [
        'appointment_date', 'appointment_time', 'reason_for_visit', 'notes',
        'status', 'payment_status', 'appointment_type', 'arrival_type',
        'checked_in_at', 'visit_started_at', 'visit_ended_at',
      ];

      const updates = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          updates[key] = key === 'reason_for_visit' ? sanitizeReasonForVisit(updateData[key]) : updateData[key];
        }
      });

      if (Object.keys(updates).length === 0) {
        throw ApiError.badRequest('No valid fields to update', 'updateData');
      }

      // visit_ended_at was never being set by any real completion path —
      // date-range "completed on <date>" filters fall back to it when the
      // visit was scheduled on a different day than it was actually
      // completed, so it needs a real value going forward.
      if (updates.status === 'completed' && !updates.visit_ended_at) {
        updates.visit_ended_at = new Date();
      }

      updates.updated_at = new Date();

      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      await db.execute(`
        UPDATE appointments SET ${setClause} WHERE id = ?
      `, [...values, id]);

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to update appointment', error.message);
    }
  }

  /**
   * Delete (cancel) appointment
   * @param {number} id - Appointment ID
   * @returns {Promise<Object>} Deleted appointment
   */
  async delete(id) {
    if (!id) throw ApiError.badRequest('Appointment ID required', 'id');

    const db = getDb();

    try {
      await this.getById(id); // 404s if it doesn't exist

      // Deleting an already-completed/no-show visit is allowed — "Delete" is
      // expected to remove it from the dashboards entirely, not just cancel
      // pending ones. This is a soft-cancel (status='cancelled'); the bill and
      // prescription rows already tied to this appointment are untouched.
      await db.execute(
        'UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?',
        ['cancelled', id]
      );

      // Keep any linked queue entries in sync so a cancelled appointment never
      // leaves an active/completed queue row behind.
      await db.execute(
        "UPDATE queue SET status = 'cancelled' WHERE appointment_id = ?",
        [id]
      );

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to cancel appointment', error.message);
    }
  }

  /**
   * Check in appointment
   * @param {number} id - Appointment ID
   * @returns {Promise<Object>} Updated appointment
   */
  async checkIn(id) {
    if (!id) throw ApiError.badRequest('Appointment ID required', 'id');

    const db = getDb();

    try {
      const appointment = await this.getById(id);

      if (appointment.status !== 'scheduled') {
        throw ApiError.conflict('Only scheduled appointments can be checked in', 'status');
      }

      await db.execute(
        'UPDATE appointments SET status = ?, checked_in_at = NOW(), updated_at = NOW() WHERE id = ?',
        ['checked_in', id]
      );

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to check in appointment', error.message);
    }
  }

  /**
   * Get appointment statistics
   * @returns {Promise<Object>} Stats including total, by status, by doctor
   */
  async getStats() {
    const db = getDb();

    try {
      const [[stats]] = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as checked_in,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show
        FROM appointments
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      return stats;
    } catch (error) {
      throw ApiError.internal('Failed to fetch appointment statistics', error.message);
    }
  }

  // ============ PRIVATE METHODS ============

  /**
   * Validate status transition
   * @private
   */
  _validateStatusTransition(currentStatus, newStatus) {
    // 'checked_in' is never actually written as a real appointments.status
    // value anywhere in this app — live consultation state lives in the
    // separate `queue` table instead, and a visit goes straight from
    // 'scheduled' to 'completed' (the queue row tracks waiting/in_progress
    // in between). Requiring scheduled -> checked_in -> completed here meant
    // every real "complete visit" PATCH 409'd and silently never updated the
    // appointment — it only ever worked by accident when a second, separate
    // queue-status update also happened to cascade into this table. Allow
    // the transition that actually occurs.
    const validTransitions = {
      scheduled: ['checked_in', 'completed', 'cancelled', 'no-show'],
      checked_in: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      'no-show': [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw ApiError.conflict(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        'status'
      );
    }
  }

  /**
   * Build sort clause for SQL query
   * @private
   */
  _buildSortClause(sortBy) {
    const sortMap = {
      appointment_date: 'a.appointment_date ASC',
      '-appointment_date': 'a.appointment_date DESC',
      status: 'a.status ASC',
      '-status': 'a.status DESC',
      created_at: 'a.created_at DESC',
      doctor_name: 'u.name ASC',
      patient_name: 'p.name ASC',
    };

    return sortMap[sortBy] || 'a.appointment_date DESC';
  }
}

module.exports = new AppointmentService();
module.exports.sanitizeReasonForVisit = sanitizeReasonForVisit;
