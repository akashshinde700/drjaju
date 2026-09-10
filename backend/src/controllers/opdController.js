const { getDb } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Register patient at reception and generate token
 * POST /api/opd/register
 */
const registerPatient = async (req, res) => {
  try {
    const { patientId, doctorId, appointmentType = 'OPD', priority = 'normal' } = req.body;
    const db = getDb();

    // Get current queue count for this doctor
    const [queueCount] = await db.execute(
      `SELECT COUNT(*) as count FROM opd_queue 
       WHERE doctor_id = ? AND status IN ('waiting', 'in_consultation') 
       AND DATE(created_at) = CURDATE()`,
      [doctorId]
    );

    const tokenNumber = queueCount[0].count + 1;

    // Create OPD visit record
    const [visitResult] = await db.execute(
      `INSERT INTO opd_visits 
       (id, patient_id, doctor_id, appointment_type, priority, status, token_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'waiting', ?, NOW(), ?)`,
      [uuidv4(), patientId, doctorId, appointmentType, priority, tokenNumber, req.user?.id]
    );

    const visitId = visitResult.insertId;

    // Add to queue
    await db.execute(
      `INSERT INTO opd_queue 
       (visit_id, patient_id, doctor_id, token_number, status, priority, created_at)
       VALUES (?, ?, ?, ?, 'waiting', ?, NOW())`,
      [visitId, patientId, doctorId, tokenNumber, priority]
    );

    // Get patient details
    const [patient] = await db.execute(
      'SELECT * FROM patients WHERE id = ?',
      [patientId]
    );

    // Get doctor details
    const [doctor] = await db.execute(
      'SELECT * FROM doctors WHERE id = ?',
      [doctorId]
    );

    res.json({
      success: true,
      data: {
        visitId,
        tokenNumber,
        patient: patient[0],
        doctor: doctor[0],
        estimatedWaitTime: queueCount[0].count * 15, // 15 minutes per patient
        status: 'waiting'
      }
    });

  } catch (error) {
    console.error('Error registering patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register patient'
    });
  }
};

/**
 * Get real-time queue for staff dashboard
 * GET /api/opd/queue
 */
const getQueue = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const db = getDb();

    let whereClause = 'WHERE DATE(q.check_in_time) = CURDATE()';
    let params = [];

    if (doctorId) {
      whereClause += ' AND q.doctor_id = ?';
      params.push(doctorId);
    }

    const [queue] = await db.execute(
      `SELECT 
        q.visit_id,
        q.token_number,
        q.status,
        q.priority,
        q.check_in_time,
        p.id as patient_id,
        p.name as patient_name,
        p.age,
        p.gender,
        p.phone,
        d.id as doctor_id,
        d.name as doctor_name,
        d.specialization,
        TIMESTAMPDIFF(MINUTE, q.check_in_time, NOW()) as waiting_time
       FROM opd_queue q
       JOIN patients p ON q.patient_id = p.id
       JOIN doctors d ON q.doctor_id = d.id
       ${whereClause}
       ORDER BY 
         CASE q.priority 
           WHEN 'urgent' THEN 1 
           WHEN 'senior_citizen' THEN 2 
           ELSE 3 
         END,
         q.token_number ASC`,
      params
    );

    // Calculate statistics
    const stats = {
      totalWaiting: queue.filter(q => q.status === 'waiting').length,
      inConsultation: queue.filter(q => q.status === 'in_consultation').length,
      completed: queue.filter(q => q.status === 'completed').length,
      averageWaitTime: queue.reduce((acc, q) => acc + (q.waiting_time || 0), 0) / (queue.length || 1)
    };

    res.json({
      success: true,
      data: {
        queue,
        stats,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching queue:', error);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        data: {
          queue: [],
          stats: { totalWaiting: 0, inConsultation: 0, completed: 0, averageWaitTime: 0 },
          lastUpdated: new Date().toISOString()
        }
      });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch queue' });
  }
};

/**
 * Start consultation - change status to in_consultation
 * PUT /api/opd/start-consultation/:visitId
 */
const startConsultation = async (req, res) => {
  try {
    const { visitId } = req.params;
    const db = getDb();

    // Update queue status
    await db.execute(
      `UPDATE opd_queue 
       SET status = 'in_consultation', started_at = NOW()
       WHERE visit_id = ?`,
      [visitId]
    );

    // Update visit status
    await db.execute(
      `UPDATE opd_visits 
       SET status = 'in_consultation', started_at = NOW()
       WHERE id = ?`,
      [visitId]
    );

    res.json({
      success: true,
      message: 'Consultation started'
    });

  } catch (error) {
    console.error('Error starting consultation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start consultation'
    });
  }
};

/**
 * Complete consultation and create prescription
 * PUT /api/opd/complete-consultation/:visitId
 */
const completeConsultation = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { 
      symptoms, 
      diagnoses, 
      medicines, 
      advice, 
      followUp, 
      vitals,
      consultationFee = 500,
      procedures = []
    } = req.body;
    
    const db = getDb();

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Get visit details
      const [visit] = await db.execute(
        'SELECT * FROM opd_visits WHERE id = ?',
        [visitId]
      );

      if (visit.length === 0) {
        throw new Error('Visit not found');
      }

      // Create prescription
      const prescriptionId = uuidv4();
      await db.execute(
        `INSERT INTO prescriptions 
         (id, patient_id, doctor_id, visit_id, symptoms, diagnoses, medicines, advice, follow_up, vitals, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          prescriptionId,
          visit[0].patient_id,
          visit[0].doctor_id,
          visitId,
          JSON.stringify(symptoms || []),
          JSON.stringify(diagnoses || []),
          JSON.stringify(medicines || []),
          advice || '',
          JSON.stringify(followUp || {}),
          JSON.stringify(vitals || {}),
          req.user?.id
        ]
      );

      // Calculate total amount
      let medicineTotal = 0;
      if (medicines && medicines.length > 0) {
        for (const med of medicines) {
          const [medPrice] = await db.execute(
            'SELECT price FROM medicines WHERE name = ? OR brand = ? LIMIT 1',
            [med.name, med.brand]
          );
          if (medPrice.length > 0) {
            medicineTotal += (medPrice[0].price || 0) * (med.qty || 1);
          }
        }
      }

      let procedureTotal = 0;
      if (procedures && procedures.length > 0) {
        for (const proc of procedures) {
          const [procPrice] = await db.execute(
            'SELECT price FROM procedures WHERE name = ? LIMIT 1',
            [proc.name]
          );
          if (procPrice.length > 0) {
            procedureTotal += procPrice[0].price || 0;
          }
        }
      }

      const totalAmount = consultationFee + medicineTotal + procedureTotal;

      // Create bill
      const billId = uuidv4();
      await db.execute(
        `INSERT INTO bills 
         (id, patient_id, doctor_id, visit_id, prescription_id, consultation_fee, medicine_total, procedure_total, total_amount, status, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?)`,
        [
          billId,
          visit[0].patient_id,
          visit[0].doctor_id,
          visitId,
          prescriptionId,
          consultationFee,
          medicineTotal,
          procedureTotal,
          totalAmount,
          req.user?.id
        ]
      );

      // Update queue status
      await db.execute(
        `UPDATE opd_queue 
         SET status = 'completed', completed_at = NOW()
         WHERE visit_id = ?`,
        [visitId]
      );

      // Update visit status
      await db.execute(
        `UPDATE opd_visits 
         SET status = 'completed', completed_at = NOW(), prescription_id = ?
         WHERE id = ?`,
        [prescriptionId, visitId]
      );

      await db.execute('COMMIT');

      res.json({
        success: true,
        data: {
          prescriptionId,
          billId,
          totalAmount,
          consultationFee,
          medicineTotal,
          procedureTotal,
          status: 'pending_payment'
        }
      });

    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error completing consultation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete consultation'
    });
  }
};

/**
 * Update payment status
 * PUT /api/opd/update-payment/:billId
 */
const updatePayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentMethod, paymentStatus, amountPaid } = req.body;
    const db = getDb();

    // Update bill
    await db.execute(
      `UPDATE bills 
       SET payment_status = ?, payment_method = ?, amount_paid = ?, paid_at = NOW()
       WHERE id = ?`,
      [paymentStatus, paymentMethod, amountPaid, billId]
    );

    res.json({
      success: true,
      message: 'Payment updated successfully'
    });

  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment'
    });
  }
};

/**
 * Get patient visit history
 * GET /api/opd/patient-history/:patientId
 */
const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;
    const db = getDb();

    const [visits] = await db.execute(
      `SELECT 
        ov.id,
        ov.token_number,
        ov.status,
        ov.created_at,
        ov.completed_at,
        d.name as doctor_name,
        d.specialization,
        p.id as prescription_id,
        b.id as bill_id,
        b.total_amount,
        b.payment_status
       FROM opd_visits ov
       LEFT JOIN doctors d ON ov.doctor_id = d.id
       LEFT JOIN prescriptions p ON ov.id = p.visit_id
       LEFT JOIN bills b ON ov.id = b.visit_id
       WHERE ov.patient_id = ?
       ORDER BY ov.created_at DESC
       LIMIT ?`,
      [patientId, parseInt(limit)]
    );

    res.json({
      success: true,
      data: visits
    });

  } catch (error) {
    console.error('Error fetching patient history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient history'
    });
  }
};

/**
 * Get today's statistics for dashboard
 * GET /api/opd/today-stats
 */
const getTodayStats = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const db = getDb();

    let whereClause = 'WHERE DATE(created_at) = CURDATE()';
    let params = [];

    if (doctorId) {
      whereClause += ' AND doctor_id = ?';
      params.push(doctorId);
    }

    const [stats] = await db.execute(
      `SELECT 
        COUNT(*) as total_patients,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_consultation' THEN 1 ELSE 0 END) as in_consultation,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent_cases
       FROM opd_visits
       ${whereClause}`,
      params
    );

    // Get revenue stats
    const [revenueStats] = await db.execute(
      `SELECT 
        SUM(total_amount) as total_revenue,
        SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END) as collected_revenue,
        SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue
       FROM bills
       WHERE DATE(created_at) = CURDATE()`,
      params
    );

    res.json({
      success: true,
      data: {
        ...stats[0],
        ...revenueStats[0]
      }
    });

  } catch (error) {
    console.error('Error fetching today stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today stats'
    });
  }
};

module.exports = {
  registerPatient,
  getQueue,
  startConsultation,
  completeConsultation,
  updatePayment,
  getPatientHistory,
  getTodayStats
};

module.exports = require('./opdController_refactored');
