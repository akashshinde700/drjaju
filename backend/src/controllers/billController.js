const { getDb, transaction } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { asyncHandler } = require('../utils');
const PDFDocument = require('pdfkit');
const { getLocalDateString } = require('../utils/localDate');
const { resolveBillLetterhead } = require('../services/PdfGeneratorService');

// Normalize raw bill-item payloads (both `items` and `service_items` shapes)
// into the bill_items column shape. Single source of truth — this exact logic
// was previously duplicated in addBill and updateBill and had begun to drift.
function normalizeBillItems(rawItems) {
  return (Array.isArray(rawItems) ? rawItems : []).map((it, idx) => {
    const quantity = it.quantity ?? it.qty ?? 1;
    const unitPrice = it.unit_price ?? it.amount ?? it.price ?? 0;
    const discountAmount = it.discount_amount ?? it.discount ?? 0;
    const taxPercent = it.tax_percent ?? 0;
    const taxAmount = it.tax_amount ?? 0;
    const totalPrice = it.total_price ?? it.total ?? (Number(quantity || 1) * Number(unitPrice || 0) - Number(discountAmount || 0));
    return {
      service_id: it.service_id ?? null,
      service_name: it.service_name ?? it.service ?? it.name ?? it.item_name ?? 'Service',
      quantity: Number(quantity) || 1,
      unit_price: Number(unitPrice) || 0,
      discount_amount: Number(discountAmount) || 0,
      tax_percent: Number(taxPercent) || 0,
      tax_amount: Number(taxAmount) || 0,
      total_price: Number(totalPrice) || 0,
      sort_order: idx + 1
    };
  });
}

// Bulk-insert normalized bill items in ONE statement (replaces the old
// one-INSERT-per-item loop). `conn` may be a pool or a transaction connection.
async function bulkInsertBillItems(conn, billId, normalizedItems) {
  if (!normalizedItems.length) return;
  const values = normalizedItems.map((it) => [
    billId, it.service_id, it.service_name, it.quantity, it.unit_price,
    it.discount_amount, it.tax_percent, it.tax_amount, it.total_price, it.sort_order
  ]);
  // .query (not .execute) — mysql2 only expands the nested VALUES ? form via query.
  await conn.query(
    `INSERT INTO bill_items (
       bill_id, service_id, service_name, quantity, unit_price,
       discount_amount, tax_percent, tax_amount, total_price, sort_order
     ) VALUES ?`,
    [values]
  );
}

// Generate bill number based on service name
function generateBillNumber(serviceName) {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${serviceName || 'CONSULT'}${dateStr}${random}`;
}

const _billsColumnCache = new Map();
async function hasBillsColumn(db, columnName) {
  if (_billsColumnCache.has(columnName)) return _billsColumnCache.get(columnName);
  try {
    const [cols] = await db.execute(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bills' AND column_name = ? LIMIT 1",
      [columnName]
    );
    const result = Array.isArray(cols) && cols.length > 0;
    _billsColumnCache.set(columnName, result);
    return result;
  } catch (_e) {
    return false;
  }
}

// Get clinic settings for receipts
async function getClinicSettings(req, res) {
  try {
    const db = getDb();
    let clinicId = req.query.clinic_id;
    
    // If no clinic_id provided, get from logged-in user
    if (!clinicId && req.user) {
      const [users] = await db.execute(
        `SELECT clinic_id FROM users WHERE id = ?`,
        [req.user.id]
      );
      if (users.length > 0 && users[0].clinic_id) {
        clinicId = users[0].clinic_id;
      }
    }
    
    if (!clinicId) {
      // Return first active clinic as default
      const [clinics] = await db.execute(
        `SELECT * FROM clinics WHERE is_active = 1 LIMIT 1`
      );
      if (clinics.length > 0) {
        return res.json({ success: true, clinic: clinics[0] });
      }
      return res.status(404).json({ success: false, error: 'No clinic found' });
    }
    
    const [clinics] = await db.execute(
      `SELECT * FROM clinics WHERE id = ?`,
      [clinicId]
    );
    
    if (clinics.length === 0) {
      return res.status(404).json({ success: false, error: 'Clinic not found' });
    }
    
    res.json({ success: true, clinic: clinics[0] });
  } catch (error) {
    console.error('Get clinic settings error:', error);
    res.status(500).json({ error: 'Failed to fetch clinic settings' });
  }
}

// List bills - simplified version
async function listBills(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      name,
      uhid,
      phone,
      patient_id,
      appointment_id,
      payment_status,
      payment_method,
      start_date,
      end_date
    } = req.query;

    // Cap raised 100 → 500: the Queue dashboard's bill-matching fetch requests
    // limit=500; the old cap silently truncated it and broke bill badges.
    const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
    const offset = (parseInt(page, 10) - 1) * limitNum;
    const db = getDb();

    // Build WHERE clause
    let whereSql = 'WHERE 1=1';
    const params = [];

    // Scope to the caller's clinic to prevent cross-clinic data leaks and to
    // keep this list in sync with the clinic-scoped /api/bills/summary cards.
    const clinicId = req.user?.clinic_id || null;
    if (clinicId) {
      whereSql += ' AND b.clinic_id = ?';
      params.push(clinicId);
    }

    // Patient ID filter (for queue actions)
    if (patient_id) {
      whereSql += ' AND b.patient_id = ?';
      params.push(patient_id);
    }

    // Appointment ID filter — scopes a bill lookup to one specific visit so a
    // patient's older, unrelated bill isn't mistaken for "the" bill of today's
    // appointment (was causing new charges to merge into a past bill).
    if (appointment_id) {
      whereSql += ' AND b.appointment_id = ?';
      params.push(appointment_id);
    }

    // Payment status filter
    if (payment_status) {
      whereSql += ' AND b.payment_status = ?';
      params.push(payment_status);
    }

    // Payment method filter — the Billing Dashboard passes this to BOTH the
    // summary endpoint and this list; previously only the summary honored it,
    // so the cards and the table showed different datasets.
    if (payment_method) {
      whereSql += ' AND b.payment_method = ?';
      params.push(payment_method);
    }

    // Date filters (bill_date)
    if (start_date) {
      whereSql += ' AND b.bill_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereSql += ' AND b.bill_date <= ?';
      params.push(end_date);
    }

    // Patient filters
    if (name) {
      whereSql += ' AND LOWER(p.name) LIKE ?';
      params.push(`%${String(name).toLowerCase()}%`);
    }
    if (uhid) {
      whereSql += ' AND LOWER(p.patient_id) LIKE ?';
      params.push(`%${String(uhid).toLowerCase()}%`);
    }
    if (phone) {
      whereSql += ' AND p.phone LIKE ?';
      params.push(`%${String(phone)}%`);
    }

    // Generic search across common fields
    if (search) {
      const s = `%${String(search).toLowerCase()}%`;
      whereSql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.patient_id) LIKE ? OR p.phone LIKE ? OR CAST(b.id AS CHAR) LIKE ? OR LOWER(IFNULL(b.bill_number, '')) LIKE ?)";
      params.push(s, s, `%${String(search)}%`, `%${String(search)}%`, s);
    }

    // Trim fields for list view to reduce payload
    const [bills] = await db.execute(`
      SELECT
        b.id,
        b.patient_id,
        b.appointment_id,
        b.bill_number,
        b.total_amount,
        b.amount_paid,
        b.balance_due,
        b.payment_status,
        b.payment_method,
        b.bill_date,
        b.created_at,
        p.patient_id as patient_uhid,
        p.name as patient_name,
        p.phone as patient_phone,
        u.name as doctor_name,
        d.specialization,
        (SELECT bi.service_name FROM bill_items bi
         WHERE bi.bill_id = b.id ORDER BY bi.id LIMIT 1) as service_name
      FROM bills b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      ${whereSql}
      ORDER BY b.bill_date DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);
    
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM bills b LEFT JOIN patients p ON b.patient_id = p.id ${whereSql}`,
      params
    );
    const total = countResult[0]?.total || 0;
    
    return sendSuccess(res, {
      bills: bills,
      pagination: {
        page: parseInt(page, 10),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
    
  } catch (error) {
    console.error('🔍 listBills error:', error);
    sendError(res, 'Failed to fetch bills', 500, process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
}

async function getUnbilledVisits(req, res) {
  try {
    const { start_date, end_date, page = 1, limit = 50 } = req.query;
    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const offset = (parseInt(page, 10) - 1) * limitNum;

    // Get unbilled visits from queue table
    let whereSql = "WHERE q.visit_status = 'unbilled' AND q.status = 'completed'";
    const params = [];

    if (start_date) {
      whereSql += ' AND DATE(q.check_in_time) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereSql += ' AND DATE(q.check_in_time) <= ?';
      params.push(end_date);
    }

    const [visits] = await db.execute(`
      SELECT q.id as queue_id, q.*, p.name as patient_name, p.patient_id as uhid, p.phone as patient_phone,
             u.name as doctor_name, d.specialization as doctor_specialization,
             c.name as clinic_name
      FROM queue q
      LEFT JOIN patients p ON q.patient_id = p.id 
      LEFT JOIN doctors d ON q.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON q.clinic_id = c.id
      ${whereSql}
      ORDER BY q.check_in_time DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);
    
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM queue q ${whereSql}`,
      params
    );
    const total = countResult[0]?.total || 0;
    
    return sendSuccess(res, {
      visits: visits,
      pagination: {
        page: parseInt(page, 10),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
    
  } catch (error) {
    console.error('🔍 getUnbilledVisits error:', error);
    sendError(res, 'Failed to fetch unbilled visits', 500, process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
}

// Delete unbilled visit
async function deleteUnbilledVisit(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Get the queue entry first to verify it's actually unbilled
    const [queueEntries] = await db.execute(
      "SELECT * FROM queue WHERE id = ? AND visit_status = 'unbilled'",
      [id]
    );

    if (queueEntries.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'This visit is not unbilled or does not exist' 
      });
    }

    // Delete the unbilled visit from queue
    await db.execute('DELETE FROM queue WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Unbilled visit deleted successfully'
    });
  } catch (error) {
    console.error('Delete unbilled visit error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete unbilled visit' 
    });
  }
}

// Get single bill
async function getBill(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const [bills] = await db.execute(`
      SELECT b.*, p.name as patient_name, p.patient_id as patient_uhid,
             p.phone as patient_phone, p.email as patient_email,
             u.name as doctor_name,
             d.specialization as doctor_specialization,
             c.name as clinic_name, c.address as clinic_address, c.city as clinic_city,
             c.state as clinic_state, c.pincode as clinic_pincode, c.phone as clinic_phone
      FROM bills b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON b.clinic_id = c.id
      WHERE b.id = ?
    `, [id]);
    
    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    const bill = bills[0];
    
    // Get bill items
    const [items] = await db.execute(`
      SELECT bi.id, bi.bill_id, bi.service_id, bi.service_name, 
             bi.quantity, bi.unit_price, bi.discount_amount, 
             bi.tax_percent, bi.tax_amount, bi.total_price, bi.sort_order,
             s.name as service_code
      FROM bill_items bi
      LEFT JOIN services s ON bi.service_id = s.id
      WHERE bi.bill_id = ?
      ORDER BY bi.sort_order
    `, [id]);
    
    bill.items = items;
    bill.service_items = items;  // Also provide as service_items for frontend compatibility

    // The letterhead this bill prints with — resolved by the SAME rule the PDF
    // uses, so the on-screen receipt and the printout can never disagree.
    // (Previously the bill came back without its template's header/footer, so
    // picking a template in Edit Receipt never showed up after saving.)
    try {
      const lh = await resolveBillLetterhead(db, bill);
      bill.letterhead = lh;
      bill.template_header_image = lh.header_image;
      bill.template_header_content = lh.header_content;
      bill.template_footer_image = lh.footer_image;
      bill.template_footer_content = lh.footer_content;
    } catch (_e) { /* letterhead is optional */ }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
}

// Create new bill
async function addBill(req, res) {
  try {
    const db = getDb();
    const body = req.body;

    const patient_id = body.patient_id;
    // ... (rest of the code remains the same)
    const appointment_id = body.appointment_id || body.appointmentId || null;
    const clinic_id = body.clinic_id || req.user?.clinic_id || null;
    // Fallback to the caller's own doctor_id (JWT already resolves this for
    // both 'doctor' and 'staff' roles at login) when the request body didn't
    // include one. Every frontend bill-creation flow was omitting this field
    // entirely, so 100% of bills in production have doctor_id = NULL — which
    // silently zeroed out every doctor-scoped "Paid" KPI, no matter how
    // correctly that query itself was written.
    const doctor_id = body.doctor_id || req.user?.doctor_id || null;
    
    // Generate bill number based on first service name
    const itemsArray = Array.isArray(body.items) ? body.items : [];
    const serviceItemsArray = Array.isArray(body.service_items) ? body.service_items : [];
    const allItems = itemsArray.length > 0 ? itemsArray : serviceItemsArray;
    const firstService = allItems.length > 0 ? (allItems[0].service_name || allItems[0].service || allItems[0].name || allItems[0].item_name) : null;
    const bill_number = body.bill_number || generateBillNumber(firstService);
    const template_id = body.template_id || null;
    const subtotal = body.subtotal || body.amount || 0;
    const discount_percent = body.discount_percent || 0;
    const discount_amount = body.discount_amount || body.discount || body.additional_discount || 0;
    const tax_percent = body.tax_percent || 0;
    const tax_amount = body.tax_amount || body.tax || 0;
    const total_amount = body.total_amount || 0;
    const amount_paid = body.amount_paid || 0;
    const balance_due = body.balance_due || (total_amount - amount_paid);
    const payment_method = body.payment_method || 'cash';
    const payment_reference = body.payment_reference || body.payment_id || null;
    const payment_status = body.payment_status || 'pending';
    const cash_component = body.cash_component != null ? parseFloat(body.cash_component) : null;
    const other_component = body.other_component != null ? parseFloat(body.other_component) : null;
    // Bill line items (support both shapes used across frontend/pages)
    // - items: internal/legacy shape
    // - service_items: receipts page shape
    const items = Array.isArray(body.items) ? body.items : [];
    const serviceItems = Array.isArray(body.service_items) ? body.service_items : [];
    
    // Ensure payment status consistency
    let final_payment_status = payment_status;
    if (payment_status === 'completed') {
      final_payment_status = 'paid';
    }
    
    // Auto-determine payment status based on amount
    if (amount_paid >= total_amount && total_amount > 0) {
      final_payment_status = 'paid';
    } else if (amount_paid > 0 && amount_paid < total_amount) {
      final_payment_status = 'partial';
    } else if (amount_paid === 0) {
      final_payment_status = 'pending';
    }
    const bill_date = body.bill_date || getLocalDateString();
    const due_date = body.due_date || null;
    const notes = body.notes || body.remarks || null;

    // Validate required fields
    if (!patient_id) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // Validate appointment_id if provided — avoid FK constraint failure
    let validAppointmentId = appointment_id;
    if (appointment_id) {
      try {
        const [apptRows] = await db.execute('SELECT id FROM appointments WHERE id = ?', [appointment_id]);
        if (apptRows.length === 0) {
          console.warn(`Bill creation: appointment ${appointment_id} not found, creating bill without appointment link`);
          validAppointmentId = null;
        }
      } catch (_e) {
        validAppointmentId = null;
      }
    }

    // Allow multiple bills per patient - no duplicate check

    // Detect whether bills table has appointment_id column (cached)
    const hasAppointmentId = await hasBillsColumn(db, 'appointment_id');

    // Ensure split-payment tracking columns exist (cached check)
    const hasCashCol = await hasBillsColumn(db, 'cash_component');
    const hasOtherCol = await hasBillsColumn(db, 'other_component');
    let hasSplitCols = hasCashCol && hasOtherCol;
    if (!hasSplitCols) {
      try {
        if (!hasCashCol) {
          await db.execute("ALTER TABLE bills ADD COLUMN cash_component DECIMAL(10,2) DEFAULT NULL");
          _billsColumnCache.set('cash_component', true);
        }
        if (!hasOtherCol) {
          await db.execute("ALTER TABLE bills ADD COLUMN other_component DECIMAL(10,2) DEFAULT NULL");
          _billsColumnCache.set('other_component', true);
        }
        hasSplitCols = true;
      } catch (_e) { hasSplitCols = false; }
    }

    // Build INSERT SQL dynamically (include split columns when available)
    const splitColSql = hasSplitCols ? ', cash_component, other_component' : '';
    const splitPhSql  = hasSplitCols ? ', ?, ?' : '';
    const splitVals   = hasSplitCols ? [cash_component, other_component] : [];

    // Create bill
    const insertSql = hasAppointmentId
      ? `INSERT INTO bills (
          patient_id, appointment_id, clinic_id, doctor_id, bill_number, template_id,
          subtotal, discount_percent, discount_amount, tax_percent, tax_amount,
          total_amount, amount_paid, balance_due, payment_method, payment_reference,
          payment_status, bill_date, due_date, notes, created_by${splitColSql}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${splitPhSql})`
      : `INSERT INTO bills (
          patient_id, clinic_id, doctor_id, bill_number, template_id,
          subtotal, discount_percent, discount_amount, tax_percent, tax_amount,
          total_amount, amount_paid, balance_due, payment_method, payment_reference,
          payment_status, bill_date, due_date, notes, created_by${splitColSql}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${splitPhSql})`;

    const insertParams = hasAppointmentId
      ? [
          patient_id, validAppointmentId,
          clinic_id, doctor_id, bill_number, template_id,
          subtotal, discount_percent, discount_amount, tax_percent, tax_amount,
          total_amount, amount_paid, balance_due, payment_method, payment_reference,
          final_payment_status, bill_date, due_date, notes, req.user.id,
          ...splitVals
        ]
      : [
          patient_id,
          clinic_id, doctor_id, bill_number, template_id,
          subtotal, discount_percent, discount_amount, tax_percent, tax_amount,
          total_amount, amount_paid, balance_due, payment_method, payment_reference,
          final_payment_status, bill_date, due_date, notes, req.user.id,
          ...splitVals
        ];

    // ATOMIC create: bill header + all items commit or roll back together.
    // Previously the header was inserted first and items looped one-by-one
    // outside any transaction — a crash mid-loop left a bill with missing
    // items (silently wrong invoice totals on reprint).
    const normalizedItems = normalizeBillItems(items.length > 0 ? items : serviceItems);
    const billId = await transaction(async (conn) => {
      const [result] = await conn.execute(insertSql, insertParams);
      await bulkInsertBillItems(conn, result.insertId, normalizedItems);
      return result.insertId;
    });

    // Update patient statistics (best-effort — don't fail bill creation if SP is missing)
    try {
      await db.execute('CALL sp_update_patient_stats(?)', [patient_id]);
    } catch (_spErr) { /* stored procedure may not exist in all environments */ }

    // Fetch the complete bill with items to return to frontend
    const [billData] = await db.execute(
      `SELECT b.*, 
              p.name as patient_name, p.patient_id as patient_uhid,
              p.phone as patient_phone, p.email as patient_email,
              u.name as doctor_name,
              d.specialization as doctor_specialization,
              c.name as clinic_name, c.address as clinic_address, c.city as clinic_city,
              c.state as clinic_state, c.pincode as clinic_pincode, c.phone as clinic_phone
       FROM bills b
       LEFT JOIN patients p ON b.patient_id = p.id
       LEFT JOIN doctors d ON b.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN clinics c ON b.clinic_id = c.id
       WHERE b.id = ?`,
      [billId]
    );

    // Fetch bill items
    const [billItems] = await db.execute(
      `SELECT * FROM bill_items WHERE bill_id = ? ORDER BY sort_order, id`,
      [billId]
    );

    const bill = billData[0] || {};
    bill.service_items = billItems;

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      bill_id: billId,
      bill: bill
    });
  } catch (error) {
    console.error('Add bill error:', error);
    res.status(500).json({ error: 'Failed to create bill' });
  }
}

// Update bill
async function updateBill(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const updates = { ...req.body };

    // Preserve items arrays before removing from updates
    const itemsArray = req.body.items;
    const serviceItemsArray = req.body.service_items;

    // Remove fields that shouldn't be updated or don't exist in DB
    delete updates.id;
    delete updates.created_at;
    delete updates.created_by;
    delete updates.items;
    delete updates.service_items;

    // Normalize payment_status: map legacy values to DB ENUM values
    if (updates.payment_status) {
      const statusMap = { 'completed': 'paid', 'failed': 'cancelled', 'success': 'paid' };
      updates.payment_status = statusMap[updates.payment_status] || updates.payment_status;
    }

    // Auto-calculate balance_due and normalize payment_status based on amount_paid.
    // The caller's own `payment_status` used to win whenever it was present —
    // but the bill-edit form sends payment_status on every save (not just
    // when the user changes it), so a bill marked "Paid" whose Amount Paid
    // field was then edited down (or left blank) saved as payment_status=
    // 'paid' with amount_paid=0/partial: marked paid with nothing collected.
    // Amount now always wins except for the two terminal, amount-independent
    // statuses (cancelled/refunded).
    if (updates.amount_paid !== undefined || updates.total_amount !== undefined) {
      const [currentBill] = await db.execute('SELECT total_amount, amount_paid FROM bills WHERE id = ?', [id]);
      if (currentBill.length > 0) {
        const total = parseFloat(updates.total_amount ?? currentBill[0].total_amount) || 0;
        const paid = parseFloat(updates.amount_paid ?? currentBill[0].amount_paid) || 0;
        const isTerminal = ['cancelled', 'refunded'].includes(updates.payment_status);
        updates.balance_due = isTerminal ? 0 : Math.max(0, total - paid);
        if (updates.amount_paid !== undefined && !isTerminal) {
          if (paid >= total && total > 0) updates.payment_status = 'paid';
          else if (paid > 0) updates.payment_status = 'partial';
          else updates.payment_status = 'pending';
        }
      }
    } else if (['cancelled', 'refunded'].includes(updates.payment_status)) {
      // Status-only cancel/refund with no amount fields in the payload —
      // still zero the stale balance_due so it stops counting as outstanding.
      updates.balance_due = 0;
    }

    // Map frontend field names to database column names
    const fieldMapping = {
      'amount': 'subtotal',
      'tax': 'tax_amount',
      'discount': 'discount_amount',
      'payment_id': 'payment_reference'
    };

    // Apply field mapping
    for (const [frontendField, dbField] of Object.entries(fieldMapping)) {
      if (updates[frontendField] !== undefined) {
        updates[dbField] = updates[frontendField];
        delete updates[frontendField];
      }
    }

    // Valid database columns for bills table
    const validColumns = [
      'patient_id', 'clinic_id', 'appointment_id', 'doctor_id', 'bill_number',
      'template_id', 'subtotal', 'discount_percent', 'discount_amount',
      'tax_percent', 'tax_amount', 'total_amount', 'amount_paid', 'balance_due',
      'payment_method', 'payment_reference', 'payment_status', 'bill_date',
      'due_date', 'notes', 'cash_component', 'other_component'
    ];

    // Filter to only valid columns
    const updateFields = Object.keys(updates).filter(key =>
      validColumns.includes(key) && updates[key] !== undefined
    );
    const updateValues = updateFields.map(key => `${key} = ?`);
    const updateParams = updateFields.map(key => updates[key]);

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // If total_amount is being updated, recalculate balance_due
    if (updates.total_amount !== undefined) {
      const [bills] = await db.execute('SELECT amount_paid FROM bills WHERE id = ?', [id]);
      if (bills.length > 0) {
        const amountPaid = parseFloat(bills[0].amount_paid) || 0;
        const totalAmount = parseFloat(updates.total_amount) || 0;
        const newBalanceDue = Math.max(0, totalAmount - amountPaid);
        if (!updateFields.includes('balance_due')) {
          updateFields.push('balance_due');
          updateValues.push('balance_due = ?');
          updateParams.push(newBalanceDue);
        }
      }
    }

    const updatedById = req.user?.id ?? null;
    const updateQuery = `UPDATE bills SET ${updateValues.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const execParams = [...updateParams, id];

    // Pre-normalize incoming items so the transaction below stays small.
    const hasItems = Array.isArray(itemsArray);
    const hasServiceItems = Array.isArray(serviceItemsArray);
    const replaceItems = hasItems || hasServiceItems;
    const normalizedItems = replaceItems ? normalizeBillItems(hasItems ? itemsArray : serviceItemsArray) : [];

    // ATOMIC update: header update + item replacement commit or roll back
    // together. The old code ran DELETE FROM bill_items and then inserted the
    // new items one-by-one with NO transaction — a failure after the DELETE
    // left the bill with zero line items while its totals stayed populated.
    await transaction(async (conn) => {
      if (updatedById) {
        try {
          await conn.execute(
            `UPDATE bills SET ${updateValues.join(', ')}, updated_by = ?, updated_at = NOW() WHERE id = ?`,
            [...updateParams, updatedById, id]
          );
        } catch (colErr) {
          if (colErr.code === 'ER_BAD_FIELD_ERROR') {
            await conn.execute(updateQuery, execParams);
          } else {
            throw colErr;
          }
        }
      } else {
        await conn.execute(updateQuery, execParams);
      }

      if (replaceItems) {
        await conn.execute('DELETE FROM bill_items WHERE bill_id = ?', [id]);
        await bulkInsertBillItems(conn, id, normalizedItems);
      }
    });

    // Sync payment_status to linked appointment and queue
    if (updates.payment_status) {
      try {
        const hasAppointmentId = await hasBillsColumn(db, 'appointment_id');
        if (hasAppointmentId) {
          const [rows] = await db.execute('SELECT appointment_id FROM bills WHERE id = ? LIMIT 1', [id]);
          const appointmentId = rows && rows[0] && rows[0].appointment_id;
          if (appointmentId) {
            await db.execute(
              'UPDATE appointments SET payment_status = ?, updated_at = NOW() WHERE id = ?',
              [updates.payment_status, appointmentId]
            ).catch(() => {});
            // Mark queue billed when paid
            if (updates.payment_status === 'paid') {
              await db.execute(
                "UPDATE queue SET visit_status = 'billed' WHERE appointment_id = ?",
                [appointmentId]
              ).catch(() => {});
            }
          }
        }
      } catch (_e) { /* ignore sync errors */ }
    }

    // (Bill items are now replaced inside the transaction above.)

    // Fetch and return the updated bill with all details
    const [updatedBills] = await db.execute(`
      SELECT b.*, 
             p.name as patient_name, p.patient_id as patient_uhid,
             p.phone as patient_phone, p.email as patient_email,
             u.name as doctor_name,
             d.specialization as doctor_specialization,
             c.name as clinic_name, c.address as clinic_address, c.city as clinic_city,
             c.state as clinic_state, c.pincode as clinic_pincode, c.phone as clinic_phone
      FROM bills b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON b.clinic_id = c.id
      WHERE b.id = ?
    `, [id]);

    if (updatedBills.length === 0) {
      return res.status(404).json({ error: 'Bill not found after update' });
    }

    const updatedBill = updatedBills[0];

    // Get updated bill items
    const [updatedItems] = await db.execute(`
      SELECT bi.id, bi.bill_id, bi.service_id, bi.service_name, 
             bi.quantity, bi.unit_price, bi.discount_amount, 
             bi.tax_percent, bi.tax_amount, bi.total_price, bi.sort_order
      FROM bill_items bi
      WHERE bi.bill_id = ?
      ORDER BY bi.sort_order
    `, [id]);

    updatedBill.items = updatedItems;
    updatedBill.service_items = updatedItems;

    res.json({
      success: true,
      message: 'Bill updated successfully',
      bill: updatedBill
    });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ error: 'Failed to update bill' });
  }
}

// Update bill status
async function updateBillStatus(req, res) {
  try {
    const { id } = req.params;
    const { payment_status, amount_paid, payment_method, payment_reference } = req.body;
    const db = getDb();

    // Validate required fields
    if (!payment_status) {
      return res.status(400).json({ error: 'Payment status is required' });
    }

    // Get current bill for balance calculation
    const [bills] = await db.execute('SELECT total_amount, amount_paid FROM bills WHERE id = ? LIMIT 1', [id]);
    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = bills[0];
    const existingAmountPaid = parseFloat(bill.amount_paid) || 0;
    const totalAmount = parseFloat(bill.total_amount);
    let currentAmountPaid = amount_paid !== undefined ? parseFloat(amount_paid) : existingAmountPaid;

    // When explicitly marking as 'paid' without providing amount, auto-set amount_paid = total_amount
    if (payment_status === 'paid' && amount_paid === undefined && currentAmountPaid < totalAmount) {
      currentAmountPaid = totalAmount;
    }
    
    // Calculate balance. A cancelled/refunded bill owes nothing — without this,
    // cancelling a still-unpaid bill left its old balance_due in place, and
    // that stale amount kept counting toward the Billing Dashboard's
    // "Pending Payments"/outstanding KPI forever.
    const balanceDue = ['cancelled', 'refunded'].includes(payment_status)
      ? 0
      : Math.max(0, totalAmount - currentAmountPaid);

    // Auto-determine payment status if amount_paid is provided
    let finalStatus = payment_status;
    if (amount_paid !== undefined) {
      if (currentAmountPaid >= totalAmount) {
        finalStatus = 'paid';
      } else if (currentAmountPaid > 0) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'pending';
      }
    }

    await db.execute(`
      UPDATE bills 
      SET payment_status = ?, amount_paid = ?, balance_due = ?, payment_method = ?, 
          payment_reference = ?, updated_at = NOW()
      WHERE id = ?
    `, [finalStatus, currentAmountPaid, balanceDue, payment_method || 'cash', payment_reference || null, id]);

    const hasAppointmentId = await hasBillsColumn(db, 'appointment_id');
    try {
      const selectSql = hasAppointmentId
        ? 'SELECT appointment_id, patient_id FROM bills WHERE id = ? LIMIT 1'
        : 'SELECT patient_id FROM bills WHERE id = ? LIMIT 1';
      const [rows] = await db.execute(selectSql, [id]);
      const billRow = rows && rows[0];
      const linkedAppointmentId = hasAppointmentId && billRow && billRow.appointment_id;
      const patientId = billRow && billRow.patient_id;

      if (linkedAppointmentId) {
        // Sync by direct appointment link
        try {
          await db.execute(
            'UPDATE appointments SET payment_status = ?, updated_at = NOW() WHERE id = ?',
            [finalStatus, linkedAppointmentId]
          );
        } catch (apptErr) {
          console.error('Error syncing payment_status to appointment:', { appointmentId: linkedAppointmentId, finalStatus, error: apptErr.message });
        }
        if ((finalStatus || '').toLowerCase() === 'paid') {
          // NOTE (2026-07-15): payment must NOT complete the visit. Only mark
          // the queue row as billed for tracking; status/completed_at are
          // controlled exclusively by the explicit completion flows
          // (Rx→bill-save, status dropdown, status PATCH endpoints).
          try {
            await db.execute(
              "UPDATE queue SET visit_status = 'billed' WHERE appointment_id = ?",
              [linkedAppointmentId]
            );
          } catch (queueErr) {
            console.error('Error updating queue visit_status to billed:', { appointmentId: linkedAppointmentId, error: queueErr.message });
          }
        }
      } else if (patientId) {
        // Fallback: bill has no appointment_id — sync today's appointment for this patient
        try {
          await db.execute(
            `UPDATE appointments SET payment_status = ?, updated_at = NOW()
             WHERE patient_id = ? AND DATE(appointment_date) = CURDATE()`,
            [finalStatus, patientId]
          );
        } catch (apptErr) {
          console.error('Error syncing payment_status to today\'s appointments:', { patientId, finalStatus, error: apptErr.message });
        }
        if ((finalStatus || '').toLowerCase() === 'paid') {
          // NOTE (2026-07-15): payment must NOT complete the visit (see above).
          try {
            await db.execute(
              `UPDATE queue SET visit_status = 'billed'
               WHERE patient_id = ? AND DATE(check_in_time) = CURDATE()`,
              [patientId]
            );
          } catch (queueErr) {
            console.error('Error updating today\'s queue visit_status to billed:', { patientId, error: queueErr.message });
          }
        }
      }
    } catch (_e) {
      console.error('Error syncing bill status to appointments/queue:', _e.message);
    }

    res.json({
      success: true,
      message: 'Bill status updated successfully',
      payment_status: finalStatus,
      balance_due: balanceDue,
      amount_paid: currentAmountPaid
    });
  } catch (error) {
    console.error('Update bill status error:', error);
    res.status(500).json({ error: 'Failed to update bill status' });
  }
}

// Delete bill
async function deleteBill(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Delete bill items first (foreign key constraint)
    await db.execute('DELETE FROM bill_items WHERE bill_id = ?', [id]);
    
    // Delete the bill
    await db.execute('DELETE FROM bills WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ error: 'Failed to delete bill' });
  }
}

// Generate receipt PDF (placeholder)
async function generateReceiptPDF(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [bills] = await db.execute(`
      SELECT b.*, p.name as patient_name, p.patient_id as patient_uhid,
             p.phone as patient_phone, p.email as patient_email,
             u.name as doctor_name,
             d.specialization as doctor_specialization,
             c.name as clinic_name, c.address as clinic_address,
             c.city as clinic_city, c.state as clinic_state, c.pincode as clinic_pincode,
             c.phone as clinic_phone, c.email as clinic_email
      FROM bills b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON b.clinic_id = c.id
      WHERE b.id = ?
    `, [id]);

    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = bills[0];

    const [items] = await db.execute(
      `SELECT bi.*, COALESCE(bi.service_name, s.name) AS item_name
       FROM bill_items bi
       LEFT JOIN services s ON bi.service_id = s.id
       WHERE bi.bill_id = ?
       ORDER BY bi.sort_order ASC`,
      [id]
    );

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', () => {});

    doc.fontSize(16).text(bill.clinic_name || 'Clinic', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Receipt / Bill #${bill.bill_number || bill.id}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).text(`Patient: ${bill.patient_name || ''}`);
    doc.fontSize(10).text(`UHID: ${bill.patient_uhid || ''}`);
    doc.text(`Phone: ${bill.patient_phone || ''}`);
    doc.text(`Date: ${bill.bill_date ? new Date(bill.bill_date).toISOString().slice(0, 10) : ''}`);
    doc.moveDown(1);

    doc.fontSize(11).text('Items');
    doc.moveDown(0.5);
    doc.fontSize(10);

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const qty = it.quantity != null ? Number(it.quantity) : 1;
        const unit = it.unit_price != null ? Number(it.unit_price) : 0;
        const total = it.total_price != null ? Number(it.total_price) : (qty * unit);
        doc.text(`${it.item_name || 'Service'}  x${qty}  @ ${unit.toFixed(2)}  = ${total.toFixed(2)}`);
      }
    } else {
      doc.text('No item details available.');
    }

    doc.moveDown(1);
    doc.fontSize(11).text(`Total: ₹${Number(bill.total_amount || 0).toFixed(2)}`);
    doc.fontSize(10).text(`Paid: ₹${Number(bill.amount_paid || 0).toFixed(2)}`);
    doc.text(`Status: ${bill.payment_status || ''}`);

    doc.end();

    await new Promise((resolve) => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${bill.bill_number || bill.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate receipt PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

// Send bill via WhatsApp
async function sendBillWhatsApp(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [bills] = await db.execute(`
      SELECT b.*, p.name as patient_name, p.phone as patient_phone,
             u.name as doctor_name,
             c.name as clinic_name
      FROM bills b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON b.clinic_id = c.id
      WHERE b.id = ?
    `, [id]);

    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = bills[0];

    // Build public PDF URL (no auth required)
    const host = req.get('host');
    const protocol = req.protocol;
    // A receipt sent on WhatsApp is a digital copy — it never lands on the
    // clinic's pre-printed paper — so it always carries the letterhead.
    const pdfUrl = `${protocol}://${host}/api/pdf/bill/${id}?with_letterhead=1`;

    // Build items list
    const [items] = await db.execute('SELECT service_name, quantity, unit_price, total_price FROM bill_items WHERE bill_id = ? ORDER BY sort_order', [id]);
    let itemsList = '';
    if (items.length > 0) {
      itemsList = items.map(it => `  • ${it.service_name} x${it.quantity} = ₹${Number(it.total_price || 0).toFixed(0)}`).join('\n');
    }

    const message = `Hello ${bill.patient_name || ''},

Your receipt from *${bill.clinic_name || 'Our Clinic'}* is ready.

🧾 *Bill #${bill.bill_number || bill.id}*
📅 Date: ${bill.bill_date ? new Date(bill.bill_date).toLocaleDateString('en-IN') : 'Today'}
${itemsList ? `\n📋 *Services:*\n${itemsList}\n` : ''}
💰 *Total: ₹${Number(bill.total_amount || 0).toFixed(2)}*
💳 Status: ${bill.payment_status || 'Pending'}

📄 *View/Download Receipt:*
${pdfUrl}

Thank you for visiting us!`;

    res.json({
      success: true,
      message: 'WhatsApp message prepared successfully',
      patient_phone: bill.patient_phone,
      whatsapp_message: message,
      pdf_url: pdfUrl
    });
  } catch (error) {
    console.error('Send bill WhatsApp error:', error);
    res.status(500).json({ error: 'Failed to process WhatsApp request' });
  }
}

module.exports = {
  hasBillsColumn,
  getClinicSettings: asyncHandler(getClinicSettings),
  listBills: asyncHandler(listBills),
  getUnbilledVisits: asyncHandler(getUnbilledVisits),
  deleteUnbilledVisit: asyncHandler(deleteUnbilledVisit),
  getBill: asyncHandler(getBill),
  addBill: asyncHandler(addBill),
  updateBill: asyncHandler(updateBill),
  updateBillStatus: asyncHandler(updateBillStatus),
  deleteBill: asyncHandler(deleteBill),
  generateReceiptPDF: asyncHandler(generateReceiptPDF),
  sendBillWhatsApp: asyncHandler(sendBillWhatsApp)
};
