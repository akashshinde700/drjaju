const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { generateUHID } = require('../utils/uhidHelper');
const QueueService = require('./QueueService');
const { findExistingPatient } = require('../utils/patientMatcher');
const { sanitizeReasonForVisit } = require('./AppointmentService');
const { getLocalDateString } = require('../utils/localDate');

class AppointmentIntentService {
  static async _generateExternalPatientId(db, doctorId) {
    try {
      return await generateUHID(db, doctorId);
    } catch {
      return `DRA${Date.now()}`;
    }
  }

  static _normalizeName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  static _normalizeArrivalType({ arrival_type, appointment_type }) {
    let finalArrivalType = arrival_type || appointment_type || 'walk-in';

    if (finalArrivalType === 'offline') {
      finalArrivalType = 'walk-in';
    } else if (finalArrivalType === 'online') {
      // ok
    } else if (!['walk-in', 'online', 'scheduled'].includes(finalArrivalType)) {
      finalArrivalType = 'walk-in';
    }

    return finalArrivalType;
  }

  static _normalizeAppointmentTime(appointmentTime) {
    if (!appointmentTime) return appointmentTime;
    if (!appointmentTime.includes(':00:00')) {
      return appointmentTime.length === 5 ? `${appointmentTime}:00` : appointmentTime;
    }
    return appointmentTime;
  }

  static async addAppointmentIntent(body) {
    const {
      full_name,
      phone,
      email,
      speciality,
      preferred_date,
      preferred_time,
      message,
      auto_create,
      arrival_type,
      appointment_type,
      doctor_id: reqDoctorId,
    } = body;

    if (!full_name || !phone) {
      throw ApiError.badRequest('Full name and phone are required');
    }

    const normalizedPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const normalizedName = full_name ? String(full_name).trim() : '';

    const db = getDb();

    const finalArrivalType = AppointmentIntentService._normalizeArrivalType({ arrival_type, appointment_type });
    const finalAppointmentType = (arrival_type === 'online' || appointment_type === 'online') ? 'online' : 'offline';

    if (auto_create) {
      let doctorId;
      let clinicId;

      if (reqDoctorId) {
        doctorId = reqDoctorId;
        const [docRow] = await db.execute('SELECT clinic_id FROM doctors WHERE id = ?', [doctorId]);
        clinicId = docRow.length > 0 ? docRow[0].clinic_id : 2;
      } else {
        // Landing page must always book for doctor_id=2 by default.
        // New doctors should be booked via their QR/link which passes doctor_id.
        const [doctor2] = await db.execute("SELECT id, clinic_id FROM doctors WHERE id = 2 LIMIT 1");
        if (doctor2.length > 0) {
          doctorId = doctor2[0].id;
          clinicId = doctor2[0].clinic_id;
        } else {
          const [doctors] = await db.execute("SELECT id, clinic_id FROM doctors WHERE status = 'active' LIMIT 1");
          doctorId = doctors.length > 0 ? doctors[0].id : 1;
          clinicId = doctors.length > 0 ? doctors[0].clinic_id : 2;
        }
      }

      // Resolve patient by exact/fuzzy first+last name matching (handles spelling mistakes):
      // - If name matches (exact or >=80% similarity) => reuse existing patient
      // - If same phone but name differs (phone_only) => create a new patient (family members sharing phone)
      const existingMatch = await findExistingPatient(db, normalizedPhone, normalizedName, {
        clinicId,
        threshold: 80,
      });
      const isRealMatch =
        existingMatch &&
        (existingMatch.matchType === 'phone_and_name' || existingMatch.matchType === 'name_only');

      let patientId;
      if (isRealMatch) {
        patientId = existingMatch.patient.id;
      }

      if (!patientId) {
        const externalPatientId = await AppointmentIntentService._generateExternalPatientId(db, doctorId);

        const [patientResult] = await db.execute(
          `INSERT INTO patients (patient_id, name, phone, email, gender, clinic_id, primary_doctor_id, created_at)
           VALUES (?, ?, ?, ?, 'O', ?, ?, NOW())`,
          [externalPatientId, normalizedName, normalizedPhone, email || null, clinicId, doctorId]
        );
        patientId = patientResult.insertId;
      }

      const appointmentDate = preferred_date || getLocalDateString();
      const appointmentTime = AppointmentIntentService._normalizeAppointmentTime(preferred_time || '10:00');

      // If patient already has an active appointment with this doctor on the same date,
      // reuse it instead of creating duplicates (common when user clicks multiple times).
      const [existingPatientAppt] = await db.execute(
        `SELECT id FROM appointments
         WHERE patient_id = ?
           AND doctor_id = ?
           AND appointment_date = ?
           AND appointment_type = ?
           AND arrival_type = ?
           AND status NOT IN ('cancelled', 'no-show')
         ORDER BY created_at DESC
         LIMIT 1`,
        [patientId, doctorId, appointmentDate, finalAppointmentType, finalArrivalType]
      );

      if (existingPatientAppt.length > 0) {
        const existingId = existingPatientAppt[0].id;

        if (finalArrivalType === 'walk-in') {
          const [existingQueue] = await db.execute(
            "SELECT id, status FROM queue WHERE appointment_id = ? ORDER BY check_in_time DESC LIMIT 1",
            [existingId]
          );

          // If a queue row exists but is cancelled/completed/no-show, revive it.
          if (existingQueue.length > 0) {
            const q = existingQueue[0];
            const qStatus = String(q.status || '').toLowerCase();
            if (['cancelled', 'completed', 'no-show'].includes(qStatus)) {
              await db.execute(
                `UPDATE queue
                 SET status = 'waiting',
                     notes = CONCAT(IFNULL(notes,''), ' | Revived from landing booking'),
                     check_in_time = NOW(),
                     check_in_date = CURDATE(),
                     called_at = NULL,
                     completed_at = NULL
                 WHERE id = ?`,
                [q.id]
              ).catch(() => {});
            }
          } else {
            try {
              await QueueService.addToQueue({
                patient_id: patientId,
                doctor_id: doctorId,
                clinic_id: clinicId,
                appointment_id: existingId,
                priority: 0,
                notes: 'Auto queued from landing booking',
              });
            } catch (_e) {
              // best-effort
            }
          }
        }

        return { id: existingId, patient_id: patientId };
      }

      const [existingBooking] = await db.execute(
        `SELECT id FROM appointments
         WHERE doctor_id = ?
           AND appointment_date = ?
           AND appointment_time = ?
           AND status NOT IN ('cancelled', 'no-show')`,
        [doctorId, appointmentDate, appointmentTime]
      );

      if (existingBooking.length > 0) {
        throw ApiError.conflict('This time slot is already booked. Please select another time.');
      }

      const [appointmentResult] = await db.execute(
        `INSERT INTO appointments (
           patient_id, doctor_id, clinic_id, appointment_date, appointment_time,
           arrival_type, appointment_type, reason_for_visit, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NOW())`,
        [
          patientId,
          doctorId,
          clinicId,
          appointmentDate,
          appointmentTime,
          finalArrivalType,
          finalAppointmentType,
          sanitizeReasonForVisit(speciality) || 'General consultation'
        ]
      );

      // Auto-add today's offline (walk-in) appointments to queue so they show on Queue dashboard
      if (finalArrivalType === 'walk-in') {
        try {
          await QueueService.addToQueue({
            patient_id: patientId,
            doctor_id: doctorId,
            clinic_id: clinicId,
            appointment_id: appointmentResult.insertId,
            priority: 0,
            notes: 'Auto queued from landing booking',
          });
        } catch (_e) {
          // best-effort; appointment is still created even if queue fails
        }
      }

      return { id: appointmentResult.insertId, patient_id: patientId };
    }

    const [result] = await db.execute(
      `INSERT INTO appointment_intents (full_name, phone, speciality, preferred_date, message, status)
       VALUES (?, ?, ?, ?, ?, 'new')`,
      [full_name, phone, speciality || null, preferred_date || null, message || null]
    );

    return { id: result.insertId };
  }

  static async listAppointmentIntents({ status, limit = 50, offset = 0 }) {
    const db = getDb();

    let query = 'SELECT * FROM appointment_intents WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    } else {
      query += ' AND status != ?';
      params.push('completed');
    }

    const intentLimit = parseInt(limit, 10) || 20;
    const intentOffset = parseInt(offset, 10) || 0;
    query += ` ORDER BY created_at DESC LIMIT ${intentLimit} OFFSET ${intentOffset}`;

    const [intents] = await db.execute(query, params);
    return { intents };
  }

  static async getAppointmentIntent(id) {
    const db = getDb();
    const [intents] = await db.execute('SELECT * FROM appointment_intents WHERE id = ?', [id]);

    if (intents.length === 0) {
      throw ApiError.notFound('Appointment intent');
    }

    return { intent: intents[0] };
  }

  static async updateAppointmentIntentStatus({ id, status, notes, userId }) {
    const validStatuses = ['new', 'contacted', 'scheduled', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }

    const db = getDb();

    await db.execute('UPDATE appointment_intents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      status,
      id,
    ]);

    if (userId) {
      await db.execute(
        'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, 'UPDATE_STATUS', 'appointment_intent', id, JSON.stringify({ old_status: 'unknown', new_status: status, notes })]
      );
    }

    return { updated: true };
  }

  static async convertToAppointment({ id, body, userId }) {
    const { patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit, create_patient } = body;

    const db = getDb();

    const [intents] = await db.execute('SELECT * FROM appointment_intents WHERE id = ?', [id]);
    if (intents.length === 0) {
      throw ApiError.notFound('Appointment intent');
    }

    const intent = intents[0];
    let finalPatientId = patient_id;

    if (create_patient && !patient_id) {
      // First try to reuse an existing patient by phone
      if (intent.phone) {
        const [byPhone] = await db.execute(
          'SELECT id, name FROM patients WHERE phone = ? ORDER BY created_at DESC LIMIT 5',
          [intent.phone]
        );
        if (byPhone.length > 0) {
          const target = AppointmentIntentService._normalizeName(intent.full_name);
          const exact = target
            ? byPhone.find(p => AppointmentIntentService._normalizeName(p.name) === target)
            : null;
          if (exact) {
            finalPatientId = exact.id;
          }
        }
      }

      if (!finalPatientId) {
        const [existingPatients] = await db.execute('SELECT COUNT(*) as count FROM patients');
        const generatedPatientId = `PAT${String(existingPatients[0].count + 1).padStart(6, '0')}`;

        let clinicId = 2;
        if (doctor_id) {
          const [docRow] = await db.execute('SELECT clinic_id FROM doctors WHERE id = ?', [doctor_id]);
          clinicId = docRow.length > 0 && docRow[0].clinic_id ? docRow[0].clinic_id : 2;
        }

        // Try to reuse an existing patient by exact/fuzzy first+last name in this clinic (preferred)
        const existingMatch = await findExistingPatient(db, intent.phone, intent.full_name, {
          clinicId,
          threshold: 80,
        });
        const isRealMatch =
          existingMatch &&
          (existingMatch.matchType === 'phone_and_name' || existingMatch.matchType === 'name_only');

        if (isRealMatch) {
          finalPatientId = existingMatch.patient.id;
        }

        const [patientResult] = finalPatientId
          ? [null]
          : await db.execute(
          `INSERT INTO patients (patient_id, name, phone, email, gender, clinic_id, primary_doctor_id, created_at)
           VALUES (?, ?, ?, ?, 'U', ?, ?, CURRENT_TIMESTAMP)`,
          [generatedPatientId, intent.full_name, intent.phone, null, clinicId, doctor_id]
        );

        if (!finalPatientId) {
          finalPatientId = patientResult.insertId;
        }

        if (userId) {
          await db.execute(
            'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
            [userId, 'CREATE', 'patient', finalPatientId, JSON.stringify({ source: 'appointment_intent', intent_id: id })]
          );
        }
      }
    }

    if (!finalPatientId || !doctor_id || !appointment_date || !appointment_time) {
      throw ApiError.badRequest('Patient ID, Doctor ID, Date, and Time are required');
    }

    const [result] = await db.execute(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit, status, notes)
       VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`,
      [
        finalPatientId,
        doctor_id,
        appointment_date,
        appointment_time,
        sanitizeReasonForVisit(reason_for_visit) || intent.message,
        `Converted from intent: ${intent.full_name} (${intent.phone})`,
      ]
    );

    await db.execute('UPDATE appointment_intents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      'scheduled',
      id,
    ]);

    if (userId) {
      await db.execute(
        'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [
          userId,
          'CONVERT_TO_APPOINTMENT',
          'appointment_intent',
          id,
          JSON.stringify({ appointment_id: result.insertId, patient_id: finalPatientId, doctor_id }),
        ]
      );
    }

    return { appointment_id: result.insertId, patient_id: finalPatientId };
  }

  static async deleteAppointmentIntent({ id, userId }) {
    const db = getDb();

    await db.execute('DELETE FROM appointment_intents WHERE id = ?', [id]);

    if (userId) {
      await db.execute(
        'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, 'DELETE', 'appointment_intent', id, 'Appointment intent deleted']
      );
    }

    return { deleted: true };
  }
}

module.exports = AppointmentIntentService;
