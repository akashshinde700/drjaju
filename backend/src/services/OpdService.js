const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { getLocalDateString } = require('../utils/localDate');

class OpdService {
  static async registerPatient({ patientId, doctorId, appointmentType = 'OPD', priority = 'normal', userId }) {
    const db = getDb();

    const [doctorRows] = await db.execute('SELECT clinic_id FROM doctors WHERE id = ?', [doctorId]);
    const clinicId = doctorRows[0]?.clinic_id || null;

    const [queueCount] = await db.execute(
      `SELECT COUNT(*) as count FROM opd_queue
       WHERE doctor_id = ? AND status IN ('waiting', 'in_consultation')
       AND DATE(created_at) = CURDATE()`,
      [doctorId]
    );

    const tokenNumber = queueCount[0].count + 1;

    // opd_visits.id is an auto-increment int like every other table in this
    // schema (patients, appointments, bills, prescriptions) — no UUID here.
    const [visitResult] = await db.execute(
      `INSERT INTO opd_visits
       (patient_id, doctor_id, clinic_id, appointment_type, priority, status, token_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'waiting', ?, NOW(), ?)`,
      [patientId, doctorId, clinicId, appointmentType, priority, tokenNumber, userId]
    );

    const visitId = visitResult.insertId;

    await db.execute(
      `INSERT INTO opd_queue
       (visit_id, patient_id, doctor_id, token_number, status, priority, check_in_time)
       VALUES (?, ?, ?, ?, 'waiting', ?, NOW())`,
      [visitId, patientId, doctorId, tokenNumber, priority]
    );

    const [patient] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
    const [doctor] = await db.execute(
      `SELECT d.*, u.name FROM doctors d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ?`,
      [doctorId]
    );

    return {
      visitId,
      tokenNumber,
      patient: patient[0],
      doctor: doctor[0],
      estimatedWaitTime: queueCount[0].count * 15,
      status: 'waiting'
    };
  }

  static async getQueue({ doctorId }) {
    const db = getDb();

    let whereClause = 'WHERE DATE(q.check_in_time) = CURDATE()';
    let params = [];

    if (doctorId) {
      whereClause += ' AND q.doctor_id = ?';
      params.push(doctorId);
    }

    try {
      const [queue] = await db.execute(
        `SELECT 
          q.visit_id,
          q.token_number,
          q.status,
          q.priority,
          q.check_in_time,
          p.id as patient_id,
          p.name as patient_name,
          p.age_years as age,
          p.gender,
          p.phone,
          d.id as doctor_id,
          u.name as doctor_name,
          d.specialization,
          TIMESTAMPDIFF(MINUTE, q.check_in_time, NOW()) as waiting_time
         FROM opd_queue q
         JOIN patients p ON q.patient_id = p.id
         JOIN doctors d ON q.doctor_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
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

      const stats = {
        totalWaiting: queue.filter(q => q.status === 'waiting').length,
        inConsultation: queue.filter(q => q.status === 'in_consultation').length,
        completed: queue.filter(q => q.status === 'completed').length,
        averageWaitTime: queue.reduce((acc, q) => acc + (q.waiting_time || 0), 0) / (queue.length || 1)
      };

      return { queue, stats, lastUpdated: new Date().toISOString() };
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return {
          queue: [],
          stats: { totalWaiting: 0, inConsultation: 0, completed: 0, averageWaitTime: 0 },
          lastUpdated: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  static async startConsultation({ visitId }) {
    const db = getDb();

    await db.execute(
      `UPDATE opd_queue 
       SET status = 'in_consultation', started_at = NOW()
       WHERE visit_id = ?`,
      [visitId]
    );

    await db.execute(
      `UPDATE opd_visits 
       SET status = 'in_consultation', started_at = NOW()
       WHERE id = ?`,
      [visitId]
    );

    return { started: true };
  }

  static async completeConsultation({ visitId, body, userId }) {
    const { symptoms, diagnoses, medicines, advice, consultationFee = 500, procedures = [] } = body;
    const db = getDb();

    // db.query, not .execute — START TRANSACTION/COMMIT/ROLLBACK aren't valid
    // in mysql2's prepared-statement protocol.
    await db.query('START TRANSACTION');

    try {
      const [visit] = await db.execute('SELECT * FROM opd_visits WHERE id = ?', [visitId]);

      if (visit.length === 0) {
        throw ApiError.notFound('Visit');
      }

      const patientId = visit[0].patient_id;
      const doctorId = visit[0].doctor_id;
      const clinicId = visit[0].clinic_id;

      // Writes into the app's real prescriptions/prescription_items/
      // prescription_diagnoses/bills tables (same ones PrescriptionPad and
      // Billing use) — not a separate OPD-only shape. diagnosis/diagnosis_icd_code
      // are the flat summary columns those tables already use; per-item detail
      // goes in prescription_items / prescription_diagnoses.
      const diagnosisText = (diagnoses || [])
        .map((d) => d.diagnosis_name || d.name)
        .filter(Boolean)
        .join(', ');
      const primaryIcd = diagnoses && diagnoses[0] ? diagnoses[0].icd_code || null : null;

      const [prescResult] = await db.execute(
        `INSERT INTO prescriptions
         (patient_id, doctor_id, clinic_id, visit_id, symptoms, diagnosis, diagnosis_icd_code, advice, prescribed_date, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'active', ?, NOW())`,
        [
          patientId,
          doctorId,
          clinicId,
          visitId,
          JSON.stringify(symptoms || []),
          diagnosisText || null,
          primaryIcd,
          advice || '',
          userId
        ]
      );
      const prescriptionId = prescResult.insertId;

      let medicineTotal = 0;
      if (medicines && medicines.length > 0) {
        let sortOrder = 0;
        for (const med of medicines) {
          const [medRows] = await db.execute(
            'SELECT mrp FROM medicines WHERE name = ? OR brand = ? LIMIT 1',
            [med.name || null, med.brand || null]
          );
          const unitPrice = medRows.length > 0 ? Number(medRows[0].mrp || 0) : 0;
          medicineTotal += unitPrice * (med.qty || 1);

          await db.execute(
            `INSERT INTO prescription_items
             (prescription_id, medicine_name, dosage, frequency, duration, notes, quantity, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              prescriptionId,
              med.name || med.brand || 'Unknown',
              med.dosage || null,
              med.frequency || null,
              med.duration || null,
              med.notes || null,
              med.qty || 1,
              sortOrder++
            ]
          );
        }
      }

      if (diagnoses && diagnoses.length > 0) {
        let sortOrder = 0;
        for (const diag of diagnoses) {
          await db.execute(
            `INSERT INTO prescription_diagnoses
             (prescription_id, icd_code, diagnosis_text, sort_order, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [prescriptionId, diag.icd_code || null, diag.diagnosis_name || diag.name || null, sortOrder++]
          );
        }
      }

      let procedureTotal = 0;
      if (procedures && procedures.length > 0) {
        for (const proc of procedures) {
          const [procRows] = await db.execute(
            'SELECT cost FROM procedures WHERE name = ? LIMIT 1',
            [proc.name || null]
          );
          if (procRows.length > 0) {
            procedureTotal += Number(procRows[0].cost || 0);
          }
        }
      }

      const totalAmount = Number(consultationFee) + medicineTotal + procedureTotal;
      const billNumber = `OPD${getLocalDateString().replace(/-/g, '')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const [billResult] = await db.execute(
        `INSERT INTO bills
         (patient_id, doctor_id, clinic_id, visit_id, bill_number, subtotal, total_amount, balance_due, payment_status, bill_date, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURDATE(), ?, NOW())`,
        [patientId, doctorId, clinicId, visitId, billNumber, totalAmount, totalAmount, totalAmount, userId]
      );
      const billId = billResult.insertId;

      await db.execute(
        `UPDATE opd_queue
         SET status = 'completed', completed_at = NOW()
         WHERE visit_id = ?`,
        [visitId]
      );

      await db.execute(
        `UPDATE opd_visits
         SET status = 'completed', completed_at = NOW(), prescription_id = ?, bill_id = ?
         WHERE id = ?`,
        [prescriptionId, billId, visitId]
      );

      await db.query('COMMIT');

      return {
        prescriptionId,
        billId,
        totalAmount,
        consultationFee,
        medicineTotal,
        procedureTotal,
        status: 'pending_payment'
      };
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  static async updatePayment({ billId, paymentMethod, paymentStatus, amountPaid }) {
    const db = getDb();

    // bills has no paid_at column — updated_at already tracks this via its own
    // ON UPDATE CURRENT_TIMESTAMP. balance_due is recomputed from the bill's
    // own total_amount so it stays consistent with what was actually billed.
    await db.execute(
      `UPDATE bills
       SET payment_status = ?, payment_method = ?, amount_paid = ?,
           balance_due = GREATEST(total_amount - ?, 0)
       WHERE id = ?`,
      [paymentStatus, paymentMethod, amountPaid, amountPaid, billId]
    );

    return { updated: true };
  }

  static async getPatientHistory({ patientId, limit = 10 }) {
    const db = getDb();

    // db.query (not .execute) — LIMIT ? as a bound param breaks mysql2's
    // prepared-statement protocol (ER_WRONG_ARGUMENTS).
    const [visits] = await db.query(
      `SELECT
        ov.id,
        ov.token_number,
        ov.status,
        ov.created_at,
        ov.completed_at,
        u.name as doctor_name,
        d.specialization,
        p.id as prescription_id,
        b.id as bill_id,
        b.total_amount,
        b.payment_status
       FROM opd_visits ov
       LEFT JOIN doctors d ON ov.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN prescriptions p ON ov.id = p.visit_id
       LEFT JOIN bills b ON ov.id = b.visit_id
       WHERE ov.patient_id = ?
       ORDER BY ov.created_at DESC
       LIMIT ?`,
      [patientId, parseInt(limit, 10)]
    );

    return { visits };
  }

  // Added 2026-07-11: DoctorConsultation page calls GET /api/opd/visit/:id but no
  // handler existed, so the page never loaded visit details. Mirrors the proven
  // "SELECT * FROM opd_visits WHERE id = ?" pattern used in completeConsultation.
  static async getVisit({ visitId }) {
    const db = getDb();
    const [visits] = await db.execute('SELECT * FROM opd_visits WHERE id = ?', [visitId]);
    if (!visits.length) throw ApiError.notFound('Visit not found');
    const visit = visits[0];
    let patient = null;
    if (visit.patient_id) {
      const [patients] = await db.execute('SELECT * FROM patients WHERE id = ?', [visit.patient_id]);
      patient = patients[0] || null;
    }
    return { visit, patient };
  }

  static async getTodayStats({ doctorId }) {
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

    let billsWhere = 'WHERE DATE(created_at) = CURDATE()';
    const billsParams = [];
    if (doctorId) {
      billsWhere += ' AND doctor_id = ?';
      billsParams.push(doctorId);
    }

    const [revenueStats] = await db.execute(
      `SELECT
        SUM(total_amount) as total_revenue,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as collected_revenue,
        SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue
       FROM bills
       ${billsWhere}`,
      billsParams
    );

    return { ...stats[0], ...revenueStats[0] };
  }
}

module.exports = OpdService;
