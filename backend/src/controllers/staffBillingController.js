const { getDb, transaction } = require('../config/db');

// Get completed visits for staff billing (FIFO order)
exports.getCompletedVisits = async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const [visits] = await db.query(`
      SELECT 
        q.id as queue_id,
        q.appointment_id,
        q.patient_id,
        q.completed_at,
        q.visit_status,
        p.patient_id as uhid,
        p.name as patient_name,
        p.phone,
        u.name as doctor_name,
        d.consultation_fee,
        CASE 
          WHEN q.visit_status = 'with_staff' THEN 'Priority - Skipped by Doctor'
          WHEN q.visit_status = 'unbilled' THEN 'Available for Billing'
          ELSE 'Ready for Billing'
        END as priority_status,
        TIMESTAMPDIFF(MINUTE, q.completed_at, NOW()) as wait_time_minutes
      FROM queue q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN bills b ON b.appointment_id = q.appointment_id
      WHERE q.status = 'completed' 
        AND DATE(q.completed_at) = CURDATE()
        AND b.id IS NULL
      ORDER BY
        CASE WHEN q.visit_status = 'with_staff' THEN 1 ELSE 2 END,
        q.completed_at ASC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM queue q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      LEFT JOIN bills b ON b.appointment_id = q.appointment_id
      WHERE q.status = 'completed' 
        AND DATE(q.completed_at) = CURDATE()
        AND b.id IS NULL
    `);
    
    const total = countResult[0].total;
    
    res.json({ 
      success: true, 
      visits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completed visits' });
  }
};

// Create bill from completed visit (with first to bill wins logic)
exports.createBillFromVisit = async (req, res) => {
  try {
    const { queue_id, services } = req.body;
    const db = getDb();
    
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
    const billNumber = `BILL${Date.now()}`;
    const subtotal = services.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    
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
        v.patient_id, v.appointment_id, v.clinic_id, v.doctor_id, billNumber,
        subtotal, subtotal, subtotal, 'pending', new Date(), req.user.id
      ]);
      
      // Add bill items
      const newBillId = result.insertId;
      for (let i = 0; i < services.length; i++) {
        const service = services[i];
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
