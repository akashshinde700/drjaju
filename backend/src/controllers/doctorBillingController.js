const { getDb, transaction } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const PDFDocument = require('pdfkit');
const { getLocalDateString } = require('../utils/localDate');

// Generate bill number based on service name
function generateBillNumber(serviceName) {
  const dateStr = getLocalDateString().replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${serviceName || 'CONSULT'}${dateStr}${random}`;
}

// Get doctor's billing dashboard
exports.getDoctorBillingDashboard = async (req, res) => {
  try {
    const db = getDb();
    const doctorId = req.user.id;
    
    // Get unbilled visits (both skipped and regular)
    const [unbilledVisits] = await db.execute(`
      SELECT 
        q.id as queue_id,
        q.appointment_id,
        q.patient_id,
        q.completed_at,
        q.visit_status,
        p.patient_id as uhid,
        p.name as patient_name,
        p.phone,
        a.appointment_date,
        a.appointment_time,
        d.consultation_fee,
        CASE 
          WHEN q.visit_status = 'with_staff' THEN 'Pending with Staff'
          WHEN q.visit_status = 'unbilled' THEN 'Available for Billing'
          ELSE 'Ready for Billing'
        END as billing_status,
        TIMESTAMPDIFF(MINUTE, q.completed_at, NOW()) as wait_time_minutes
      FROM queue q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN bills b ON b.appointment_id = q.appointment_id
      WHERE q.status = 'completed' 
        AND a.doctor_id = ?
        AND DATE(q.completed_at) = CURDATE()
        AND b.id IS NULL
      ORDER BY q.completed_at DESC
    `, [doctorId]);
    
    // Get billed payments (fully paid)
    const [billedPayments] = await db.execute(`
      SELECT 
        b.id,
        b.bill_number,
        b.bill_date,
        b.total_amount,
        b.amount_paid,
        b.payment_status,
        b.payment_method,
        p.patient_id as uhid,
        p.name as patient_name,
        p.phone,
        a.appointment_date,
        a.appointment_time
      FROM bills b
      LEFT JOIN appointments a ON b.appointment_id = a.id
      LEFT JOIN patients p ON b.patient_id = p.id
      WHERE a.doctor_id = ?
        AND b.payment_status = 'paid'
        AND DATE(b.bill_date) = CURDATE()
      ORDER BY b.bill_date DESC
    `, [doctorId]);
    
    // Get pending payments (partial or unpaid)
    const [pendingPayments] = await db.execute(`
      SELECT 
        b.id,
        b.bill_number,
        b.bill_date,
        b.total_amount,
        b.amount_paid,
        b.balance_due,
        b.payment_status,
        b.payment_method,
        p.patient_id as uhid,
        p.name as patient_name,
        p.phone,
        a.appointment_date,
        a.appointment_time
      FROM bills b
      LEFT JOIN appointments a ON b.appointment_id = a.id
      LEFT JOIN patients p ON b.patient_id = p.id
      WHERE a.doctor_id = ?
        AND b.payment_status IN ('pending', 'partial')
        AND DATE(b.bill_date) = CURDATE()
      ORDER BY b.bill_date DESC
    `, [doctorId]);
    
    // Calculate summary
    const totalCollected = billedPayments.reduce((sum, b) => sum + parseFloat(b.amount_paid || 0), 0);
    const totalOutstanding = pendingPayments.reduce((sum, b) => sum + parseFloat(b.balance_due || 0), 0);
    
    res.json({
      success: true,
      data: {
        unbilledVisits,
        billedPayments,
        pendingPayments,
        summary: {
          totalCollected,
          totalOutstanding,
          unbilledCount: unbilledVisits.length,
          billedCount: billedPayments.length,
          pendingCount: pendingPayments.length
        }
      }
    });
  } catch (error) {
    console.error('Get doctor billing dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch billing dashboard' });
  }
};

// Create bill from visit (for doctors - same logic as staff)
exports.createBillFromVisit = async (req, res) => {
  try {
    const { queue_id } = req.body;
    const services = Array.isArray(req.body?.services) ? req.body.services : [];
    const db = getDb();

    if (!queue_id) {
      return res.status(400).json({ success: false, error: 'queue_id is required' });
    }
    
    // Check if bill already exists (first to bill wins)
    const [existingBill] = await db.execute(`
      SELECT b.id FROM bills b
      INNER JOIN queue q ON b.appointment_id = q.appointment_id
      WHERE q.id = ?
    `, [queue_id]);
    
    if (existingBill.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Bill already created by another user',
        bill_id: existingBill[0].id
      });
    }
    
    // Get visit details
    const [visit] = await db.execute(`
      SELECT q.*, p.patient_id as uhid, a.doctor_id, d.consultation_fee,
             COALESCE(q.clinic_id, a.clinic_id, d.clinic_id) as clinic_id
      FROM queue q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE q.id = ?
    `, [queue_id]);
    
    if (visit.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    
    const v = visit[0];

    // Resolve doctor_id / clinic_id fallbacks (bills.clinic_id is NOT NULL)
    let resolvedDoctorId = v.doctor_id || req.user?.doctor_id || req.user?.doctorId || null;
    if (!resolvedDoctorId && req.user?.id) {
      try {
        const [rows] = await db.execute('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
        if (rows.length) resolvedDoctorId = rows[0].id;
      } catch (_) {
        // ignore
      }
    }

    const resolvedClinicId = v.clinic_id || req.user?.clinic_id || req.user?.clinicId || null;
    if (!resolvedClinicId) {
      return res.status(400).json({ success: false, error: 'clinic_id could not be resolved for this visit' });
    }

    const safeServices = services.length > 0
      ? services
      : [{
          service_name: 'Consultation',
          quantity: 1,
          unit_price: v.consultation_fee || 500,
          total: v.consultation_fee || 500,
        }];
    
    // Generate bill number based on first service name
    const firstService = safeServices.length > 0 ? (safeServices[0].service_name || safeServices[0].name) : null;
    const billNumber = generateBillNumber(firstService);
    const subtotal = safeServices.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const billDate = getLocalDateString();
    
    // Create bill with transaction to prevent race conditions
    const billId = await transaction(async (conn) => {
      // Double-check if bill exists (within transaction)
      const [doubleCheck] = await conn.execute(`
        SELECT b.id FROM bills b
        INNER JOIN queue q ON b.appointment_id = q.appointment_id
        WHERE q.id = ?
      `, [queue_id]);
      
      if (doubleCheck.length > 0) {
        const error = new Error('Bill already created by another user');
        error.code = 409;
        error.billId = doubleCheck[0].id;
        throw error;
      }
      
      // Create bill
      const [result] = await conn.execute(`
        INSERT INTO bills (
          patient_id, appointment_id, clinic_id, doctor_id, bill_number,
          subtotal, total_amount, balance_due, payment_status, bill_date, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        v.patient_id,
        v.appointment_id,
        resolvedClinicId,
        resolvedDoctorId,
        billNumber,
        subtotal,
        subtotal,
        subtotal,
        'pending',
        billDate,
        req.user?.id || null
      ]);
      
      // Add bill items
      const newBillId = result.insertId;
      for (let i = 0; i < safeServices.length; i++) {
        const service = safeServices[i];
        await conn.execute(`
          INSERT INTO bill_items (
            bill_id, service_name, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          newBillId, service.service_name, service.quantity || 1, 
          service.unit_price || 0, service.total || 0
        ]);
      }
      
      return newBillId;
    });

    res.json({ success: true, bill_id: billId });
    
  } catch (error) {
    // Handle custom error codes
    if (error.code === 409) {
      return res.status(409).json({ 
        success: false, 
        error: error.message,
        bill_id: error.billId
      });
    }
    
    console.error('Create bill from visit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bill',
      details: error?.sqlMessage || error?.message || String(error)
    });
  }
};
