const { getDb } = require('../config/db');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { generateUHID } = require('../utils/uhidHelper');
const { findExistingPatient } = require('../utils/patientMatcher');
const { getLocalDateString } = require('../utils/localDate');

/**
 * Generate QR code for doctor
 * POST /api/qr/generate/:doctorId
 */
const generateDoctorQR = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const db = getDb();

    // Get doctor details
    const [doctor] = await db.execute(
      'SELECT * FROM doctors WHERE id = ?',
      [doctorId]
    );

    if (doctor.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Generate QR code URL
    const qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/qr/${doctorId}`;
    
    // Generate QR code image
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Save QR code to database
    const qrId = uuidv4();
    await db.execute(
      `INSERT INTO doctor_qr_codes 
       (id, doctor_id, qr_url, qr_code_data, is_active, created_at, created_by)
       VALUES (?, ?, ?, ?, 1, NOW(), ?)
       ON DUPLICATE KEY UPDATE 
       qr_url = VALUES(qr_url),
       qr_code_data = VALUES(qr_code_data),
       is_active = VALUES(is_active),
       updated_at = NOW()`,
      [qrId, doctorId, qrUrl, qrCodeDataUrl, req.user?.id]
    );

    res.json({
      success: true,
      data: {
        doctorId,
        doctorName: doctor[0].name,
        specialization: doctor[0].specialization,
        qrUrl,
        qrCodeDataUrl,
        qrId
      }
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code'
    });
  }
};

/**
 * Get doctor QR code info
 * GET /api/qr/doctor/:doctorId
 */
const getDoctorQRInfo = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const db = getDb();

    const [doctor] = await db.execute(
      `SELECT d.*, qr.qr_url, qr.qr_code_data, qr.is_active, qr.created_at as qr_created_at
       FROM doctors d
       LEFT JOIN doctor_qr_codes qr ON d.id = qr.doctor_id
       WHERE d.id = ?`,
      [doctorId]
    );

    if (doctor.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: doctor[0]
    });

  } catch (error) {
    console.error('Error fetching QR info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch QR info'
    });
  }
};

/**
 * Get doctor availability for QR booking
 * GET /api/qr/availability/:doctorId
 */
const getDoctorAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;
    const db = getDb();

    // Get doctor details
    const [doctor] = await db.execute(
      'SELECT * FROM doctors WHERE id = ?',
      [doctorId]
    );

    if (doctor.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Get today's queue count
    const [queueCount] = await db.execute(
      `SELECT COUNT(*) as count FROM opd_queue 
       WHERE doctor_id = ? AND DATE(created_at) = CURDATE()`,
      [doctorId]
    );

    // Get doctor's time slots (if available)
    const [timeSlots] = await db.execute(
      `SELECT * FROM doctor_time_slots 
       WHERE doctor_id = ? AND is_active = 1
       ORDER BY start_time`,
      [doctorId]
    );

    // Calculate estimated wait time
    const estimatedWaitTime = queueCount[0].count * 15; // 15 minutes per patient

    res.json({
      success: true,
      data: {
        doctor: doctor[0],
        todayQueueCount: queueCount[0].count,
        estimatedWaitTime,
        timeSlots: timeSlots,
        isAvailable: doctor[0].is_active && queueCount[0].count < (doctor[0].max_daily_patients || 50)
      }
    });

  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability'
    });
  }
};

/**
 * Book appointment via QR code
 * POST /api/qr/book/:doctorId
 */
const bookViaQR = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { patientName, patientPhone, patientAge, patientGender, symptoms, preferredTime, appointmentDate, appointmentTime } = req.body;
    const db = getDb();

    // Check if doctor is available
    const [doctor] = await db.execute(
      'SELECT d.*, c.id as clinic_id FROM doctors d LEFT JOIN clinics c ON c.is_active = 1 WHERE d.id = ? AND d.is_active = 1 LIMIT 1',
      [doctorId]
    );

    if (doctor.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Doctor is not available'
      });
    }

    const clinicId = doctor[0].clinic_id || 2; // Default clinic

    let patientDbId;
    let patientUhid;

    // Smart patient lookup: phone + fuzzy name matching to prevent duplicates
    const existingMatch = await findExistingPatient(db, patientPhone, patientName);

    if (existingMatch) {
      patientDbId = existingMatch.patient.id;
      patientUhid = existingMatch.patient.patient_id;
    } else {
      // Create new patient with auto-generated UHID
      let uhid;
      try {
        uhid = await generateUHID(db, null);
      } catch { uhid = 'DRA' + Date.now(); }
      const genderCode = patientGender === 'male' ? 'M' : patientGender === 'female' ? 'F' : 'U';

      const [newPatient] = await db.execute(
        `INSERT INTO patients
         (patient_id, name, phone, age_years, gender, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [uhid, patientName, patientPhone, patientAge || null, genderCode]
      );
      patientDbId = newPatient.insertId;
      patientUhid = uhid;
    }

    // Determine appointment date and time
    const aptDate = appointmentDate || getLocalDateString();
    const aptTime = appointmentTime || preferredTime || new Date().toTimeString().split(' ')[0].substring(0, 5) + ':00';

    // Create appointment record
    const [appointmentResult] = await db.execute(
      `INSERT INTO appointments
       (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, status, payment_status, arrival_type, reason_for_visit, created_at)
       VALUES (?, ?, ?, ?, ?, 'scheduled', 'pending', 'walk-in', ?, NOW())`,
      [patientDbId, doctorId, clinicId, aptDate, aptTime, symptoms ? JSON.stringify(symptoms) : 'QR Booking']
    );

    const appointmentId = appointmentResult.insertId;

    // Get current queue count for token number
    const [queueCount] = await db.execute(
      `SELECT COUNT(*) as count FROM queue
       WHERE doctor_id = ? AND DATE(check_in_time) = CURDATE()`,
      [doctorId]
    );

    const tokenNumber = (queueCount[0]?.count || 0) + 1;

    // Add to queue
    await db.execute(
      `INSERT INTO queue
       (patient_id, doctor_id, clinic_id, appointment_id, token_number, status, check_in_time, check_in_date)
       VALUES (?, ?, ?, ?, ?, 'waiting', NOW(), CURDATE())`,
      [patientDbId, doctorId, clinicId, appointmentId, tokenNumber]
    );

    res.json({
      success: true,
      data: {
        appointmentId,
        tokenNumber,
        patientName,
        patientUhid,
        patientId: patientDbId,
        doctorName: doctor[0].name,
        specialization: doctor[0].specialization,
        appointmentDate: aptDate,
        appointmentTime: aptTime,
        estimatedWaitTime: (queueCount[0]?.count || 0) * 15,
        bookingTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error booking via QR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to book appointment: ' + error.message
    });
  }
};

/**
 * Get all QR codes for admin
 * GET /api/qr/all
 */
const getAllQRCodes = async (req, res) => {
  try {
    const db = getDb();

    const [qrCodes] = await db.execute(
      `SELECT d.id as doctor_id, d.name as doctor_name, d.specialization, 
              qr.qr_url, qr.qr_code_data, qr.is_active, qr.created_at as qr_created_at,
              COUNT(q.visit_id) as total_bookings
       FROM doctors d
       LEFT JOIN doctor_qr_codes qr ON d.id = qr.doctor_id
       LEFT JOIN opd_queue q ON d.id = q.doctor_id AND DATE(q.check_in_time) = CURDATE()
       GROUP BY d.id, qr.id
       ORDER BY d.name`
    );

    res.json({
      success: true,
      data: qrCodes
    });

  } catch (error) {
    // doctor_qr_codes / opd_queue aren't provisioned in this DB and nothing in
    // the app writes to them yet — degrade to an empty list instead of a 500.
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, data: [] });
    }
    console.error('Error fetching QR codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch QR codes'
    });
  }
};

/**
 * Toggle QR code active status
 * PUT /api/qr/toggle/:doctorId
 */
const toggleQRStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { isActive } = req.body;
    const db = getDb();

    await db.execute(
      `UPDATE doctor_qr_codes 
       SET is_active = ?, updated_at = NOW()
       WHERE doctor_id = ?`,
      [isActive, doctorId]
    );

    res.json({
      success: true,
      message: `QR code ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error toggling QR status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle QR status'
    });
  }
};

/**
 * Check if patient already exists - used by frontend before booking
 * GET /api/qr/check-patient?phone=xxx&name=xxx
 */
const checkPatientExists = async (req, res) => {
  try {
    const { phone, name } = req.query;

    if (!phone && !name) {
      return res.json({ success: true, data: { found: false } });
    }

    const db = getDb();
    const match = await findExistingPatient(db, phone, name);

    // Only treat as "existing patient" when BOTH phone AND name are similar.
    // phone_only = family members sharing a number — should create a new patient.
    if (match && match.matchType === 'phone_and_name') {
      return res.json({
        success: true,
        data: {
          found: true,
          matchType: match.matchType,
          patient: {
            id: match.patient.id,
            patient_id: match.patient.patient_id,
            name: match.patient.name,
            phone: match.patient.phone
          }
        }
      });
    }

    res.json({ success: true, data: { found: false } });
  } catch (error) {
    console.error('Error checking patient:', error);
    res.status(500).json({ success: false, error: 'Failed to check patient' });
  }
};

module.exports = {
  generateDoctorQR,
  getDoctorQRInfo,
  getDoctorAvailability,
  bookViaQR,
  checkPatientExists,
  getAllQRCodes,
  toggleQRStatus
};
