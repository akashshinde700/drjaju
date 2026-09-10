const { getDb } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getLocalDateString } = require('../utils/localDate');

// Default consultation fee (configurable via env)
const DEFAULT_CONSULTATION_FEE = parseInt(process.env.DEFAULT_CONSULTATION_FEE || '500', 10);

async function listAppointments(req, res) {
  let whereClause = '';
  let params = [];
  try {
    const { date, status, doctor_id, start_date, end_date, appointment_type, page = 1, limit = 50 } = req.query;

    const limitNum = Math.min(parseInt(limit, 10) || 50, 100); // Cap at 100
    const db = getDb();
    const offset = (parseInt(page, 10) - 1) * limitNum;

    // Build WHERE clause
    whereClause = 'WHERE 1=1';
    params = [];

    // Authorization-based filtering
    // Doctor and staff accounts should see only their assigned doctor's appointments.
    if (req.user && typeof req.user === 'object' && (req.user.role === 'doctor' || req.user.role === 'staff')) {
      let doctorId = req.user.doctor_id;
      if (!doctorId && req.user.role === 'doctor' && req.user.id) {
        const [doctors] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
        if (doctors.length > 0) doctorId = doctors[0].id;
      } else if (!doctorId && req.user.role === 'staff' && req.user.id) {
        const [ds] = await db.execute(
          'SELECT doctor_id FROM doctor_staff WHERE staff_user_id = ? AND is_active = 1 LIMIT 1',
          [req.user.id]
        );
        if (ds.length > 0) doctorId = ds[0].doctor_id;
      }
      if (doctorId) {
        whereClause += ' AND a.doctor_id = ?';
        params.push(doctorId);
      } else if (req.user.clinic_id) {
        whereClause += ' AND a.clinic_id = ?';
        params.push(req.user.clinic_id);
      }
    }

    // Add manual doctor_id filter if provided
    if (doctor_id) {
      whereClause += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }

    // Add single date filter
    // Include:
    // - appointments scheduled on that date
    // - visits completed on that date (visit_ended_at)
    // This avoids missing completed visits due to timezone shifts / rescheduled dates.
    if (date) {
      whereClause += " AND (DATE(a.appointment_date) = ? OR (a.status = 'completed' AND a.visit_ended_at IS NOT NULL AND DATE(a.visit_ended_at) = ?))";
      params.push(date, date);
    }

    // Add date range filters — mirrors the single-`date` filter's OR logic:
    // include appointments SCHEDULED in the range, but also visits COMPLETED
    // in the range even if they were scheduled on a different day (e.g. a
    // visit scheduled on the 9th but actually seen/completed on the 10th).
    // Filtering on appointment_date alone silently dropped those rows from
    // date-range views like "View completed patients on <date>".
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

    // Add status filter
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    // Appointment type filter (online/offline)
    if (appointment_type) {
      whereClause += ' AND a.appointment_type = ?';
      params.push(appointment_type);
    }

    // Main query - simplified to fix SQL parameter issues
    const safeLimit = Number(limitNum);
    const safeOffset = Number(offset);
    const [appointments] = await db.execute(`
      SELECT 
        a.id,
        a.patient_id,
        a.patient_id as patient_db_id,
        a.doctor_id,
        a.clinic_id,
        a.appointment_date,
        a.appointment_time,
        a.arrival_type,
        a.appointment_type,
        a.reason_for_visit,
        a.status,
        a.payment_status,
        a.notes,
        a.checked_in_at,
        a.visit_started_at,
        a.visit_ended_at,
        a.created_at,
        a.updated_at,
        (a.consultation_type = 'followup') AS is_follow_up,
        b.id as bill_id,
        b.total_amount as bill_total,
        b.amount_paid as amount_paid,
        b.balance_due as amount_due,
        b.payment_status as bill_payment_status,
        p.patient_id as uhid,
        p.name as patient_name, 
        p.phone as contact,
        p.gender as patient_gender,
        p.dob as patient_dob,
        p.age_years as patient_age,
        u.name as doctor_name,
        d.specialization as doctor_specialization,
        c.name as clinic_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON a.clinic_id = c.id
      LEFT JOIN bills b
        ON b.id = (
          SELECT b2.id
          FROM bills b2
          WHERE b2.appointment_id = a.id
          ORDER BY b2.id DESC
          LIMIT 1
        )
      ${whereClause}
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `, params);

    // Count query
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total FROM appointments a ${whereClause}
    `, params);
    const total = countResult[0]?.total || 0;
    
    return sendSuccess(res, {
      appointments: appointments,
      pagination: {
        page: parseInt(page, 10),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
    
  } catch (error) {
    console.error('listAppointments error:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql || 'N/A',
      params: error.params || 'N/A',
      whereClause: whereClause || 'N/A'
    });
    sendError(res, 'Failed to fetch appointments', 500, process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
}

async function getAppointment(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [appointments] = await db.execute(`
      SELECT 
        a.id,
        a.patient_id as patient_db_id,
        a.doctor_id,
        a.clinic_id,
        a.appointment_date,
        a.appointment_time,
        a.slot_time,
        a.arrival_type,
        a.appointment_type,
        a.reason_for_visit,
        a.status,
        a.notes,
        a.checked_in_at,
        a.visit_started_at,
        a.visit_ended_at,
        a.created_at,
        a.updated_at,
        (a.consultation_type = 'followup') AS is_follow_up,
        p.patient_id as uhid,
        p.name as patient_name,
        p.phone as contact,
        p.email as patient_email,
        p.gender as patient_gender,
        p.dob as patient_dob,
        p.abha_number,
        p.blood_group,
        p.address as patient_address,
        u.name as doctor_name,
        d.specialization as doctor_specialization,
        c.name as clinic_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON a.clinic_id = c.id
      WHERE a.id = ?
    `, [id]);

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const apt = appointments[0];
    apt.patient_id = apt.uhid; // For backward compatibility

    res.json({ appointment: apt });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
}

async function addAppointment(req, res) {
  try {
    const {
      patient_id,      // This should be the database ID (INT)
      doctor_id,       // Database ID of doctor
      clinic_id,
      appointment_date,
      appointment_time,
      arrival_type,
      appointment_type, // Consultation type from frontend (online/offline)
      reason_for_visit,
      notes
    } = req.body;

    // Validate required fields
    if (!patient_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ 
        error: 'patient_id, appointment_date, and appointment_time are required' 
      });
    }

    const db = getDb();
    
    // Verify patient exists
    const [patients] = await db.execute(
      'SELECT id, name, patient_id as uhid FROM patients WHERE id = ?',
      [patient_id]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Verify doctor exists (optional)
    let doctor = null;
    if (doctor_id) {
      const [doctors] = await db.execute(
        'SELECT d.id, u.name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = ?',
        [doctor_id]
      );
      
      if (doctors.length === 0) {
        return res.status(404).json({ error: 'Doctor not found' });
      }
      doctor = doctors[0];
    }

    // Map appointment_type to arrival_type if not provided
    let finalArrivalType = arrival_type;
    
    if (!finalArrivalType && appointment_type) {
      // Map frontend consultation types to backend arrival types
      if (appointment_type === 'offline') {
        finalArrivalType = 'walk-in'; // Offline appointments become walk-in
      } else if (appointment_type === 'online') {
        finalArrivalType = 'online'; // Online appointments stay online
      } else {
        finalArrivalType = 'walk-in'; // Default fallback
      }
    } else if (finalArrivalType) {
    } else {
      finalArrivalType = 'walk-in'; // Default fallback
    }
    
    // Check for duplicate appointment
    let duplicateQuery = `
      SELECT id FROM appointments 
      WHERE patient_id = ? AND appointment_date = ? AND appointment_time = ?
      AND status NOT IN ('cancelled', 'no-show')
    `;
    let duplicateParams = [patient_id, appointment_date, appointment_time];
    
    if (doctor_id) {
      duplicateQuery += ' AND doctor_id = ?';
      duplicateParams.push(doctor_id);
    }

    const [existing] = await db.execute(duplicateQuery, duplicateParams);

    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'An appointment already exists for this patient at the same date and time' 
      });
    }

    const finalAppointmentType = finalArrivalType === 'online' ? 'online' : 'offline';

    const [result] = await db.execute(`
      INSERT INTO appointments (
        patient_id, doctor_id, clinic_id, appointment_date,
        appointment_time, arrival_type, appointment_type, reason_for_visit, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        patient_id,
        doctor_id,
        clinic_id || null,
        appointment_date,
        appointment_time,
        finalArrivalType || 'walk-in',
        finalAppointmentType,
        reason_for_visit || null,
        notes || null
      ]
    );

    // Logging removed for production

    res.status(201).json({
      id: result.insertId,
      patient_id: patient_id,
      patient_name: patients[0].name,
      patient_uhid: patients[0].uhid,
      doctor_name: doctor?.name || null,
      doctor_id: doctor_id || null,
      arrival_type: finalArrivalType,
      message: 'Appointment created successfully'
    });
  } catch (error) {
    console.error('Appointment creation error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to create appointment', details: error.message });
  }
}

async function updateAppointmentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status against your ENUM
    const allowedStatuses = ['scheduled', 'completed', 'cancelled', 'no-show'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` 
      });
    }

    const db = getDb();
    
    // Get current status for history
    const [current] = await db.execute(
      'SELECT status FROM appointments WHERE id = ?',
      [id]
    );
    
    if (current.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const oldStatus = current[0].status;

    // Update appointment
    let updateQuery = 'UPDATE appointments SET status = ?, updated_at = NOW()';
    const params = [status];

    // Handle special status updates
    if (status === 'completed') {
      updateQuery += ', visit_ended_at = NOW()';
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await db.execute(updateQuery, params);

    // Update patient statistics and sync queue status if appointment is completed
    if (status === 'completed') {
      try {
        const [appt] = await db.execute('SELECT patient_id, clinic_id FROM appointments WHERE id = ?', [id]);
        if (appt.length > 0) {
          await db.execute('CALL sp_update_patient_stats(?, ?)', [appt[0].patient_id, appt[0].clinic_id]).catch(() => {});
        }
      } catch (statsErr) {
        console.error('Error updating patient stats:', statsErr.message);
      }
      // Sync queue entry status to completed
      try {
        await db.execute(
          'UPDATE queue SET status = ?, visit_status = ?, completed_at = NOW() WHERE appointment_id = ? AND status != ?',
          ['completed', 'completed', id, 'completed']
        );
      } catch (queueErr) {
        console.error('Error syncing queue status to completed:', queueErr.message);
      }
    }

    // Log status change in history table
    try {
      await db.execute(`
        INSERT INTO appointment_status_history (appointment_id, old_status, new_status, notes)
        VALUES (?, ?, ?, ?)
      `, [id, oldStatus, status, notes || null]);
    } catch (historyErr) {
      // Warning logged silently
    }

    // Logging removed for production

    // Track subscription session usage if appointment completed
    if (status === 'completed' && oldStatus !== 'completed') {
      try {
        // Get patient_id from appointment
        const [apts] = await db.execute('SELECT patient_id FROM appointments WHERE id = ?', [id]);
        if (apts.length > 0) {
          const patientId = apts[0].patient_id;
          
          // Find active subscription for this patient
          const [subscriptions] = await db.execute(`
            SELECT id FROM patient_subscriptions 
            WHERE patient_id = ? AND status = 'active' AND end_date >= CURDATE()
            LIMIT 1
          `, [patientId]);

          // If subscription exists, track session usage
          if (subscriptions.length > 0) {
            const subscriptionId = subscriptions[0].id;
            await db.execute(`
              UPDATE patient_subscriptions
              SET sessions_used = sessions_used + 1, last_session_date = NOW()
              WHERE id = ?
            `, [subscriptionId]);
            // Logging removed for production
          }
        }
      } catch (subErr) {
        // Warning logged silently
        // Continue even if subscription tracking fails
      }
    }

    res.json({ 
      message: `Appointment status updated to ${status}`,
      id: parseInt(id),
      status,
      previous_status: oldStatus
    });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
}

async function updateAppointment(req, res) {
  try {
    const { id } = req.params;
    const {
      appointment_date,
      appointment_time,
      slot_time,
      reason_for_visit,
      notes,
      doctor_id,
      clinic_id,
      arrival_type
    } = req.body;

    // Logging removed for production

    const db = getDb();

    const [result] = await db.execute(`
      UPDATE appointments SET
        appointment_date = COALESCE(?, appointment_date),
        appointment_time = COALESCE(?, appointment_time),
        slot_time = COALESCE(?, slot_time),
        reason_for_visit = COALESCE(?, reason_for_visit),
        notes = COALESCE(?, notes),
        doctor_id = COALESCE(?, doctor_id),
        clinic_id = COALESCE(?, clinic_id),
        arrival_type = COALESCE(?, arrival_type),
        updated_at = NOW()
      WHERE id = ?
    `, [
      appointment_date || null,
      appointment_time || null,
      slot_time || null,
      reason_for_visit || null,
      notes || null,
      doctor_id || null,
      clinic_id || null,
      arrival_type || null,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Logging removed for production

    res.json({
      message: 'Appointment updated successfully',
      id: parseInt(id)
    });
  } catch (error) {
    // Error handled by global handler
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to update appointment', message: error.message });
  }
}

async function deleteAppointment(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const [result] = await db.execute(
      'DELETE FROM appointments WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
}

async function checkInAppointment(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute(`
      UPDATE appointments 
      SET checked_in_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [id]);

    res.json({ message: 'Patient checked in successfully' });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to check in patient' });
  }
}

async function startVisit(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Calculate waiting time if checked in
    const [apt] = await db.execute(
      'SELECT checked_in_at FROM appointments WHERE id = ?',
      [id]
    );

    let waitingTime = null;
    if (apt.length > 0 && apt[0].checked_in_at) {
      const checkedIn = new Date(apt[0].checked_in_at);
      const now = new Date();
      waitingTime = Math.round((now - checkedIn) / 60000); // minutes
    }

    await db.execute(`
      UPDATE appointments 
      SET visit_started_at = NOW(), 
          waiting_time_minutes = ?,
          status = 'in-progress',
          updated_at = NOW()
      WHERE id = ?
    `, [waitingTime, id]);

    res.json({ 
      message: 'Visit started',
      waiting_time_minutes: waitingTime
    });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to start visit' });
  }
}

async function endVisit(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Calculate actual duration
    const [apt] = await db.execute(
      'SELECT visit_started_at FROM appointments WHERE id = ?',
      [id]
    );

    let duration = null;
    if (apt.length > 0 && apt[0].visit_started_at) {
      const started = new Date(apt[0].visit_started_at);
      const now = new Date();
      duration = Math.round((now - started) / 60000); // minutes
    }

    await db.execute(`
      UPDATE appointments 
      SET visit_ended_at = NOW(), 
          actual_duration_minutes = ?,
          status = 'completed',
          updated_at = NOW()
      WHERE id = ?
    `, [duration, id]);

    res.json({ 
      message: 'Visit completed',
      actual_duration_minutes: duration
    });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to end visit' });
  }
}

// Get today's appointments summary
async function getTodaysSummary(req, res) {
  try {
    const db = getDb();
    const today = getLocalDateString();

    const [summary] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show,
        SUM(CASE WHEN checked_in_at IS NOT NULL AND visit_started_at IS NULL THEN 1 ELSE 0 END) as waiting
      FROM appointments
      WHERE appointment_date = ?
    `, [today]);

    res.json({ 
      date: today,
      summary: summary[0] 
    });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to get summary' });
  }
}

// Dashboard helper: count today's appointments + pending (scheduled/waiting)
async function getTodayAppointmentsCount(req, res) {
  try {
    const db = getDb();
    const today = getLocalDateString();

    const doctorId = req.user?.role === 'doctor' ? (req.user?.doctor_id || null) : null;
    const clinicId = req.user?.clinic_id || null;

    const where = ['a.appointment_date = ?'];
    const params = [today];

    if (doctorId) {
      where.push('a.doctor_id = ?');
      params.push(doctorId);
    } else if (clinicId) {
      where.push('a.clinic_id = ?');
      params.push(clinicId);
    }

    const [rows] = await db.execute(
      `SELECT
         COUNT(*) AS count,
         SUM(CASE WHEN a.status = 'scheduled' THEN 1 ELSE 0 END) AS pending
       FROM appointments a
       WHERE ${where.join(' AND ')}`,
      params
    );

    const r = rows[0] || {};
    return res.json({
      date: today,
      count: parseInt(r.count || 0, 10),
      pending: parseInt(r.pending || 0, 10)
    });
  } catch (error) {
    console.error('getTodayAppointmentsCount error:', error);
    return res.status(500).json({ error: 'Failed to fetch today appointments' });
  }
}

// Dashboard helper: overall appointment stats (admin)
async function getAppointmentStatsSummary(req, res) {
  try {
    const db = getDb();
    const clinicId = req.user?.clinic_id || null;

    const where = [];
    const params = [];

    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (clinicId) {
      where.push('clinic_id = ?');
      params.push(clinicId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) AS no_show
       FROM appointments
       ${whereSql}`,
      params
    );

    return res.json(rows[0] || { total: 0 });
  } catch (error) {
    console.error('getAppointmentStatsSummary error:', error);
    return res.status(500).json({ error: 'Failed to fetch appointment stats' });
  }
}

async function getBookedSlots(req, res) {
  try {
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      return res.status(400).json({ error: 'doctor_id and date are required' });
    }

    const db = getDb();

    // Get all booked slots for the doctor on the specified date
    const [bookedSlots] = await db.execute(`
      SELECT
        appointment_time,
        status
      FROM appointments
      WHERE doctor_id = ?
        AND appointment_date = ?
        AND status NOT IN ('cancelled', 'no-show')
      ORDER BY appointment_time
    `, [doctor_id, date]);

    // Extract time slots from results and format as HH:MM (removing seconds)
    const slots = bookedSlots.map(slot => {
      const time = slot.appointment_time;
      // Convert "HH:MM:SS" to "HH:MM"
      return typeof time === 'string' ? time.substring(0, 5) : time;
    });

    res.json({ bookedSlots: slots, count: slots.length });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch booked slots' });
  }
}

module.exports = require('./appointmentController_refactored');