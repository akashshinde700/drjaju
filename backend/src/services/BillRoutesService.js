const { getDb } = require('../config/db');

class BillRoutesService {
  static async getPendingSummary({ clinicId, doctorId }) {
    const db = getDb();

    const where = [];
    const params = [];
    // doctorId takes precedence: a doctor in a multi-doctor clinic must only
    // see their own pending bills — clinic-wide scoping alone showed every
    // doctor combined on this doctor's own dashboard card.
    if (doctorId) {
      where.push('doctor_id = ?');
      params.push(doctorId);
    } else if (clinicId) {
      where.push('clinic_id = ?');
      params.push(clinicId);
    }
    const whereSql = where.length ? `AND ${where.join(' AND ')}` : '';

    const [rows] = await db.execute(
      `SELECT
         SUM(CASE WHEN payment_status IN ('pending','partial') THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() THEN IFNULL(amount_paid, 0) ELSE 0 END) AS today_revenue
       FROM bills
       WHERE 1=1 ${whereSql}`,
      params
    );

    const r = rows[0] || {};

    return {
      count: parseInt(r.pending_count || 0, 10),
      revenue: parseFloat(r.today_revenue || 0)
    };
  }

  static async listBillingServices() {
    const db = getDb();
    const [services] = await db.execute(
      'SELECT id, service_name as name, category, default_price as price, unit FROM billing_services WHERE is_active = 1 ORDER BY category, sort_order, service_name'
    );

    const grouped = {};
    for (const s of services) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }

    return { services, grouped };
  }

  static async addBillingService({ service_name, category, default_price, unit }) {
    const db = getDb();

    const [result] = await db.execute(
      'INSERT INTO billing_services (service_name, category, default_price, unit) VALUES (?, ?, ?, ?)',
      [service_name, category, parseFloat(default_price) || 0, unit || 'per visit']
    );

    return { id: result.insertId };
  }

  static async updateBillingService({ id, service_name, category, default_price, unit }) {
    const db = getDb();
    await db.execute(
      'UPDATE billing_services SET service_name = ?, category = ?, default_price = ?, unit = ? WHERE id = ?',
      [service_name, category, parseFloat(default_price) || 0, unit || 'per visit', id]
    );

    return { ok: true };
  }

  static async deleteBillingService({ id }) {
    const db = getDb();
    await db.execute('DELETE FROM billing_services WHERE id = ?', [id]);
    return { ok: true };
  }

  // ── Service Groups ──────────────────────────────────────────────────────────

  static async _ensureGroupsTable(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS billing_service_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_name VARCHAR(255) NOT NULL,
        services TEXT NOT NULL,
        doctor_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  static async listServiceGroups({ doctorId } = {}) {
    const db = getDb();
    try { await BillRoutesService._ensureGroupsTable(db); } catch (_) { /* ignore */ }
    const params = [];
    let where = 'WHERE 1=1';
    if (doctorId) {
      where += ' AND (doctor_id = ? OR doctor_id IS NULL)';
      params.push(doctorId);
    }
    const [rows] = await db.execute(
      `SELECT id, group_name, services FROM billing_service_groups ${where} ORDER BY group_name`,
      params
    );
    return rows.map(r => ({
      ...r,
      services: typeof r.services === 'string' ? JSON.parse(r.services) : r.services
    }));
  }

  static async addServiceGroup({ group_name, services, doctorId }) {
    const db = getDb();
    try { await BillRoutesService._ensureGroupsTable(db); } catch (_) { /* table may already exist */ }
    const [result] = await db.execute(
      'INSERT INTO billing_service_groups (group_name, services, doctor_id) VALUES (?, ?, ?)',
      [group_name, JSON.stringify(services || []), doctorId || null]
    );
    return { id: result.insertId };
  }

  static async updateServiceGroup({ id, group_name, services }) {
    const db = getDb();
    await db.execute(
      'UPDATE billing_service_groups SET group_name = ?, services = ? WHERE id = ?',
      [group_name, JSON.stringify(services || []), id]
    );
    return { ok: true };
  }

  static async deleteServiceGroup({ id }) {
    const db = getDb();
    await db.execute('DELETE FROM billing_service_groups WHERE id = ?', [id]);
    return { ok: true };
  }

  // ── End Service Groups ──────────────────────────────────────────────────────

  static async getBillsSummary({ clinicId, startDate, endDate, paymentStatus, paymentMethod, search, dayStart, dayEnd } = {}) {
    const db = getDb();

    // Ensure split-payment columns exist (cached via billController helper)
    const { hasBillsColumn } = require('../controllers/billController');
    try {
      const hasCash = await hasBillsColumn(db, 'cash_component');
      const hasOther = await hasBillsColumn(db, 'other_component');
      void (hasCash && hasOther);
    } catch (_e) {
      // ignore
    }

    // Build scoping + filter WHERE clause. The cards must reflect the same
    // dataset that the bills table (GET /api/bills) is showing, and must be
    // scoped to the caller's clinic/doctor to avoid cross-clinic data leaks.
    const where = ['1=1'];
    const params = [];
    if (clinicId) {
      where.push('clinic_id = ?');
      params.push(clinicId);
    }
    if (startDate) {
      where.push('bill_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('bill_date <= ?');
      params.push(endDate);
    }
    if (paymentStatus) {
      where.push('payment_status = ?');
      params.push(paymentStatus);
    }
    if (paymentMethod) {
      where.push('payment_method = ?');
      params.push(paymentMethod);
    }
    if (search) {
      const s = `%${String(search).toLowerCase()}%`;
      where.push("(CAST(id AS CHAR) LIKE ? OR LOWER(IFNULL(bill_number, '')) LIKE ? OR patient_id IN (SELECT id FROM patients WHERE LOWER(name) LIKE ? OR LOWER(patient_id) LIKE ? OR phone LIKE ?))");
      params.push(`%${String(search)}%`, s, s, s, `%${String(search)}%`);
    }
    const whereSql = where.join(' AND ');

    const [summary] = await db.execute(`
      SELECT
        COUNT(*) as total_bills,
        -- Revenue = billed amount EXCLUDING cancelled/refunded bills
        SUM(CASE WHEN payment_status NOT IN ('cancelled','refunded') THEN total_amount ELSE 0 END) as total_revenue,
        SUM(amount_paid)   as total_collected,
        SUM(balance_due)   as total_outstanding,

        -- Status counts (all time)
        SUM(CASE WHEN payment_status = 'paid'    THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,

        -- Status amounts (all time)
        SUM(CASE WHEN payment_status = 'paid'    THEN amount_paid   ELSE 0 END) as paid_amount,
        SUM(CASE WHEN payment_status = 'pending' THEN total_amount  ELSE 0 END) as pending_amount,
        SUM(CASE WHEN payment_status = 'partial' THEN balance_due   ELSE 0 END) as partial_balance,

        -- Today counts & amounts
        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() THEN amount_paid ELSE 0 END) as today_collected,

        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() AND payment_status = 'paid'    THEN 1 ELSE 0 END) as today_paid_count,
        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() AND payment_status = 'pending' THEN 1 ELSE 0 END) as today_pending_count,
        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() AND payment_status = 'partial' THEN 1 ELSE 0 END) as today_partial_count,

        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() AND payment_status = 'paid'    THEN amount_paid  ELSE 0 END) as today_paid_amount,
        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() AND payment_status = 'pending' THEN total_amount ELSE 0 END) as today_pending_amount,
        SUM(CASE WHEN DATE(IFNULL(bill_date, created_at)) = CURDATE() AND payment_status = 'partial' THEN balance_due  ELSE 0 END) as today_partial_balance,

        -- Payment method breakdown (split payments use cash_component / other_component)
        SUM(CASE
          WHEN payment_method = 'cash'                               THEN amount_paid
          WHEN payment_method IN ('cash+upi','cash+card')            THEN IFNULL(cash_component, 0)
          ELSE 0 END) as cash_amount,
        SUM(CASE
          WHEN payment_method IN ('upi','gpay')                      THEN amount_paid
          WHEN payment_method = 'cash+upi'                           THEN IFNULL(other_component, 0)
          ELSE 0 END) as upi_amount,
        SUM(CASE
          WHEN payment_method IN ('debit_card','credit_card','card') THEN amount_paid
          WHEN payment_method = 'cash+card'                          THEN IFNULL(other_component, 0)
          ELSE 0 END) as card_amount,
        SUM(CASE WHEN payment_method = 'bank_transfer'               THEN amount_paid ELSE 0 END) as bank_amount,
        SUM(CASE
          WHEN payment_method NOT IN ('cash','upi','gpay','debit_card','credit_card','card','bank_transfer','cash+upi','cash+card')
            OR payment_method IS NULL                                THEN amount_paid
          ELSE 0 END) as other_amount
      FROM bills
      WHERE ${whereSql}
    `, params);

    const s0 = summary[0] || {};

    // Day-scoped figures. FIX (2026-07-11): the "today_*" fields above are hardcoded
    // to CURDATE(), so selecting a date never changed them. Recompute them for the
    // selected day (defaults to today) in a separate, cleanly-parameterised query,
    // and add `today_total` = the full amount billed that day (collected + outstanding,
    // excluding cancelled/refunded) so the dashboard can show a real day total.
    const dayWhere = ['1=1'];
    const dayParams = [];
    if (clinicId) { dayWhere.push('clinic_id = ?'); dayParams.push(clinicId); }
    const hasDayRange = Boolean(dayStart && dayEnd);
    if (hasDayRange) {
      dayWhere.push('DATE(IFNULL(bill_date, created_at)) BETWEEN ? AND ?');
      dayParams.push(dayStart, dayEnd);
    } else {
      dayWhere.push('DATE(IFNULL(bill_date, created_at)) = CURDATE()');
    }
    const [dayRows] = await db.execute(`
      SELECT
        COUNT(*) AS today_count,
        SUM(IFNULL(amount_paid, 0)) AS today_collected,
        SUM(CASE WHEN payment_status = 'paid'    THEN 1 ELSE 0 END) AS today_paid_count,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS today_pending_count,
        SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) AS today_partial_count,
        SUM(CASE WHEN payment_status = 'paid'    THEN IFNULL(amount_paid, 0)  ELSE 0 END) AS today_paid_amount,
        SUM(CASE WHEN payment_status = 'pending' THEN IFNULL(total_amount, 0) ELSE 0 END) AS today_pending_amount,
        SUM(CASE WHEN payment_status = 'partial' THEN IFNULL(balance_due, 0)  ELSE 0 END) AS today_partial_balance,
        SUM(CASE WHEN payment_status NOT IN ('cancelled','refunded') THEN IFNULL(total_amount, 0) ELSE 0 END) AS today_total
      FROM bills
      WHERE ${dayWhere.join(' AND ')}
    `, dayParams);
    const d0 = dayRows[0] || {};

    return {
      ...s0,
      ...d0,
      paid_bills: s0.paid_count || 0,
      pending_bills: s0.pending_count || 0
    };
  }

  static async updateBillPayment({ id, amount, paid_amount }) {
    const db = getDb();

    const [bills] = await db.execute('SELECT total_amount, amount_paid FROM bills WHERE id = ?', [id]);

    if (bills.length === 0) {
      return { ok: false, code: 'not_found' };
    }

    const bill = bills[0];
    const currentPaid = parseFloat(bill.amount_paid || 0);
    const totalAmount = parseFloat(bill.total_amount);

    const hasAbsolute = paid_amount !== undefined && paid_amount !== null;
    const newPaidAmount = hasAbsolute ? parseFloat(paid_amount) : (currentPaid + parseFloat(amount));
    const remainingAmount = totalAmount - newPaidAmount;

    let newStatus = 'pending';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    await db.execute(
      'UPDATE bills SET amount_paid = ?, payment_status = ?, balance_due = ? WHERE id = ?',
      [newPaidAmount, newStatus, remainingAmount, id]
    );

    // Best-effort sync appointment payment_status
    try {
      const [billRows] = await db.execute('SELECT appointment_id FROM bills WHERE id = ?', [id]);
      const appointmentId = billRows[0]?.appointment_id;
      if (appointmentId) {
        await db.execute('UPDATE appointments SET payment_status = ?, updated_at = NOW() WHERE id = ?', [newStatus, appointmentId]);
      }
    } catch (_e) {
      // ignore
    }

    return {
      ok: true,
      data: {
        success: true,
        paid_amount: newPaidAmount,
        remaining_amount: remainingAmount,
        payment_status: newStatus
      }
    };
  }
}

module.exports = BillRoutesService;
