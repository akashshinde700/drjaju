const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { getLocalDateString } = require('../utils/localDate');

/**
 * QueueService - Encapsulates patient queue management logic
 * Handles queue operations, token assignment, status management
 */
class QueueService {
  /**
   * Add patient to queue
   * @param {Object} queueData - { patient_id, doctor_id, clinic_id, appointment_id, priority, notes }
   * @returns {Promise<Object>} Queue entry
   */
  async addToQueue(queueData) {
    const {
      patient_id,
      doctor_id,
      clinic_id,
      appointment_id,
      priority = 0,
      notes,
    } = queueData;

    // Validation
    if (!patient_id) throw ApiError.badRequest('Patient ID required', 'patient_id');
    if (!doctor_id) throw ApiError.badRequest('Doctor ID required', 'doctor_id');
    if (!clinic_id) throw ApiError.badRequest('Clinic ID required', 'clinic_id');

    const db = getDb();

    try {
      // Check patient exists
      const [patients] = await db.execute('SELECT id FROM patients WHERE id = ?', [patient_id]);
      if (patients.length === 0) {
        throw ApiError.notFound('Patient not found', 'patient_id');
      }

      // Check doctor exists
      const [doctors] = await db.execute('SELECT id FROM doctors WHERE id = ?', [doctor_id]);
      if (doctors.length === 0) {
        throw ApiError.notFound('Doctor not found', 'doctor_id');
      }

      // Check if already in queue today (not completed/cancelled)
      const [existing] = await db.execute(`
        SELECT id FROM queue
        WHERE patient_id = ? AND doctor_id = ?
        AND check_in_date = CURDATE()
        AND status NOT IN ('completed', 'cancelled', 'no-show')
        LIMIT 1
      `, [patient_id, doctor_id]);

      if (existing.length > 0) {
        throw ApiError.conflict('Patient already in queue', 'patient_id');
      }

      // Generate token number
      const tokenNumber = await this._generateTokenNumber(doctor_id, clinic_id);

      // Add to queue
      const [result] = await db.execute(`
        INSERT INTO queue (
          patient_id, doctor_id, clinic_id, appointment_id,
          token_number, status, priority, notes, check_in_time, check_in_date
        ) VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, NOW(), CURDATE())
      `, [patient_id, doctor_id, clinic_id, appointment_id || null, tokenNumber, priority, notes || null]);

      return this.getById(result.insertId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to add patient to queue', error.message);
    }
  }

  /**
   * Get queue by ID
   * @param {number} id - Queue ID
   * @returns {Promise<Object>} Queue entry with patient details
   */
  async getById(id) {
    if (!id) throw ApiError.badRequest('Queue ID required', 'id');

    const db = getDb();

    try {
      const [queue] = await db.execute(`
        SELECT 
          q.*,
          p.patient_id as patient_identifier,
          p.name as patient_name,
          p.phone as patient_phone,
          p.is_vip,
          p.vip_tier,
          u.name as doctor_name,
          u.phone as doctor_phone,
          c.name as clinic_name,
          a.reason_for_visit,
          a.appointment_time
        FROM queue q
        LEFT JOIN patients p ON q.patient_id = p.id
        LEFT JOIN doctors d ON q.doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON q.clinic_id = c.id
        LEFT JOIN appointments a ON q.appointment_id = a.id
        WHERE q.id = ?
      `, [id]);

      if (queue.length === 0) {
        throw ApiError.notFound('Queue entry not found', 'id');
      }

      return queue[0];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to fetch queue entry', error.message);
    }
  }

  /**
   * Get today's queue for a doctor/clinic
   * @param {Object} options - { doctor_id, clinic_id, status, page, limit }
   * @returns {Promise<Object>} { data, pagination }
   */
  async getTodayQueue(options = {}) {
    const {
      doctor_id,
      clinic_id,
      status,
      date,
      page = 1,
      limit = 50,
    } = options;

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Defaults to today (DB-side CURDATE(), to avoid timezone mismatches
      // between Node runtime and MySQL server time settings), but an explicit
      // `date` lets callers (e.g. "View pending patients on <date>") fetch
      // the queue's waiting/in_progress state for any past day — the queue
      // table is the only place that state exists, so without this a
      // historical date can never show pending/in-progress patients.
      // Also include rows completed on that day even if check-in was earlier.
      let whereClause;
      const params = [];
      if (date) {
        whereClause = "WHERE (DATE(q.check_in_time) = ? OR (q.status = 'completed' AND DATE(q.completed_at) = ?))";
        params.push(date, date);
      } else {
        whereClause = "WHERE (DATE(q.check_in_time) = CURDATE() OR (q.status = 'completed' AND DATE(q.completed_at) = CURDATE()))";
      }

      if (doctor_id) {
        whereClause += ' AND q.doctor_id = ?';
        params.push(doctor_id);
      }

      if (clinic_id) {
        whereClause += ' AND q.clinic_id = ?';
        params.push(clinic_id);
      }

      // By default exclude cancelled/no-show/skipped so stale rows don't
      // consume the paginated result set and hide active patients.
      if (status) {
        whereClause += ' AND q.status = ?';
        params.push(status);
      } else {
        whereClause += " AND q.status NOT IN ('cancelled', 'no-show', 'skipped')";
      }

      // Get total count
      const [[{ total }]] = await db.execute(`
        SELECT COUNT(*) as total FROM queue q
        ${whereClause}
      `, params);

      // Get paginated data
      const [queue] = await db.execute(`
        SELECT 
          q.id,
          q.appointment_id,
          q.token_number,
          q.status,
          q.priority,
          q.check_in_time,
          q.completed_at,
          q.called_at,
          q.notes,
          p.id as patient_id,
          p.patient_id as patient_identifier,
          p.name as patient_name,
          p.phone,
          -- Age/gender/DOB were missing here, so a queue-sourced card (walk-ins,
          -- and completed visits folded in from the queue) had no age to show
          -- while an appointment-sourced card did — the "sometimes it shows,
          -- sometimes it doesn't" the clinic reported. Aliased to match the
          -- appointments payload (patient_age/patient_gender/patient_dob) so
          -- the UI reads one set of field names for both sources.
          p.age_years as patient_age,
          p.dob as patient_dob,
          p.gender as patient_gender,
          p.is_vip,
          p.vip_tier,
          u.name as doctor_name,
          c.name as clinic_name
        FROM queue q
        LEFT JOIN patients p ON q.patient_id = p.id
        LEFT JOIN doctors d ON q.doctor_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN clinics c ON q.clinic_id = c.id
        ${whereClause}
        ORDER BY q.priority DESC, q.check_in_time ASC
        LIMIT ${limitNum} OFFSET ${offset}
      `, params);

      const totalPages = Math.ceil(total / limitNum);

      return {
        data: queue,
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
      throw ApiError.internal('Failed to fetch queue', error.message);
    }
  }

  /**
   * Update queue status
   * @param {number} id - Queue ID
   * @param {string} status - New status (waiting, called, in_progress, completed, cancelled, no-show, skipped)
   * @returns {Promise<Object>} Updated queue entry
   */
  async updateStatus(id, status) {
    if (!id) throw ApiError.badRequest('Queue ID required', 'id');
    if (!status) throw ApiError.badRequest('Status required', 'status');

    // Validate status — must match the queue.status DB enum exactly
    // ('waiting','called','in_progress','completed','cancelled','no-show','skipped').
    const validStatuses = ['waiting', 'called', 'in_progress', 'completed', 'cancelled', 'no-show', 'skipped'];
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'status');
    }

    const db = getDb();

    try {
      const queue = await this.getById(id);

      // Prevent status changes for completed queue entries
      if (queue.status === 'completed') {
        throw ApiError.conflict('Cannot change status of completed queue entry', 'status');
      }

      // Stamp the relevant timestamp columns so wait-time analytics work:
      //  - called_at  : set the first time the patient is called/seen
      //                 (status 'called' or 'in_progress'), only if not already set
      //  - completed_at: set when the visit is completed
      // These columns exist in the queue table; getStats() uses
      // TIMESTAMPDIFF(check_in_time, called_at) for avg_wait_time.
      let setClause = 'status = ?';
      const params = [status];

      if ((status === 'called' || status === 'in_progress')) {
        setClause += ', called_at = COALESCE(called_at, NOW())';
      }
      if (status === 'completed') {
        setClause += ', completed_at = NOW()';
      }

      await db.execute(
        `UPDATE queue SET ${setClause} WHERE id = ?`,
        [...params, id]
      );

      // Also update appointment status if this queue entry is linked to an appointment.
      // Map queue statuses to the appointments.status enum
      // ('scheduled','confirmed','checked-in','in-progress','completed','cancelled','no-show','rescheduled').
      // 'called'/'in_progress'/'waiting' all keep the appointment 'scheduled' (live in-queue state);
      // 'skipped' is treated as 'no-show' for the appointment. This preserves the existing
      // dashboard behavior (no card/predicate logic changes).
      const statusMap = {
        waiting: 'scheduled',
        called: 'scheduled',
        in_progress: 'scheduled',
        completed: 'completed',
        cancelled: 'cancelled',
        'no-show': 'no-show',
        skipped: 'no-show'
      };
      const apptStatus = statusMap[status] || null;
      if (apptStatus && queue.appointment_id) {
        // visit_ended_at mirrors AppointmentService.update's same auto-stamp —
        // this raw-SQL path bypasses that service entirely, so it needs its
        // own copy or "completed on <date>" filters lose their fallback data.
        const extraSet = apptStatus === 'completed' ? ", visit_ended_at = COALESCE(visit_ended_at, NOW())" : '';
        await db.execute(
          `UPDATE appointments SET status = ?, updated_at = NOW()${extraSet} WHERE id = ?`,
          [apptStatus, queue.appointment_id]
        ).catch((e) => console.error('QueueService.updateStatus: appointment sync failed:', e.message));
      }

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to update queue status', error.message);
    }
  }

  /**
   * Call next patient from queue
   * @param {number} doctor_id - Doctor ID
   * @returns {Promise<Object>} Next queue entry
   */
  async callNextPatient(doctor_id) {
    if (!doctor_id) throw ApiError.badRequest('Doctor ID required', 'doctor_id');

    const db = getDb();
    const today = getLocalDateString();

    try {
      // Get next waiting patient (highest priority, earliest check-in)
      const [next] = await db.execute(`
        SELECT id FROM queue
        WHERE doctor_id = ? 
        AND DATE(check_in_time) = ?
        AND status = 'waiting'
        ORDER BY priority DESC, check_in_time ASC
        LIMIT 1
      `, [doctor_id, today]);

      if (next.length === 0) {
        throw ApiError.notFound('No more patients in queue', 'queue');
      }

      return this.updateStatus(next[0].id, 'in_progress');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to call next patient', error.message);
    }
  }

  /**
   * Remove patient from queue
   * @param {number} id - Queue ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated queue entry
   */
  async removeFromQueue(id, reason = '') {
    if (!id) throw ApiError.badRequest('Queue ID required', 'id');

    const db = getDb();

    try {
      // Look up the row first so we can (a) report 404 instead of a silent
      // no-op when the id doesn't exist, and (b) cancel the linked appointment
      // too. Cancelling only the queue row used to leave the appointment as
      // 'scheduled', which then resurfaced on the dashboard the next day.
      const [[row]] = await db.execute(
        'SELECT id, appointment_id FROM queue WHERE id = ? LIMIT 1',
        [id]
      );
      if (!row) throw ApiError.notFound('Queue entry not found', 'id');

      // queue table does not have updated_at or completed_at — only status + notes
      await db.execute(
        'UPDATE queue SET status = ?, notes = ? WHERE id = ?',
        ['cancelled', reason || null, id]
      );

      // Keep the linked appointment in sync so it stops counting on the
      // dashboards — including already-completed visits: "Delete" is
      // explicitly expected to remove the visit everywhere it's shown, not
      // just the active queue. This is a soft-cancel (status='cancelled'),
      // not a hard delete, so the underlying bill/prescription rows are
      // untouched for billing/audit purposes; it just stops showing as an
      // active "completed" visit on the dashboards.
      if (row.appointment_id) {
        await db.execute(
          "UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
          [row.appointment_id]
        );
      }

      return this.getById(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to remove from queue', error.message);
    }
  }

  /**
   * Get queue statistics
   * @param {string} [date] - Optional YYYY-MM-DD; defaults to today. Lets the
   *   KPI cards follow "View completed/pending patients on <date>" instead of
   *   always showing today's numbers while the list below shows another day.
   * @param {Object} [scope] - { doctor_id, clinic_id } — without this the
   *   KPI row summed every doctor's queue/bills clinic-wide, so a doctor in a
   *   multi-doctor clinic saw inflated numbers that didn't match their own
   *   (correctly doctor-scoped) Active Queue list below it.
   * @returns {Promise<Object>} Queue stats
   */
  async getStats(date, scope = {}) {
    const db = getDb();
    const targetDate = date || getLocalDateString();
    const { doctor_id, clinic_id } = scope;

    try {
      // Scoping applied IDENTICALLY to both tables, mirroring getDashboardStats,
      // so the KPI row and the summary cards can never disagree by scope.
      const queueScope = [];
      const queueScopeParams = [];
      const apptScope = [];
      const apptScopeParams = [];
      if (doctor_id) {
        queueScope.push('q.doctor_id = ?');
        queueScopeParams.push(doctor_id);
        apptScope.push('a.doctor_id = ?');
        apptScopeParams.push(doctor_id);
      } else if (clinic_id) {
        queueScope.push('q.clinic_id = ?');
        queueScopeParams.push(clinic_id);
        apptScope.push('a.clinic_id = ?');
        apptScopeParams.push(clinic_id);
      }
      const queueScopeSql = queueScope.length ? ` AND ${queueScope.join(' AND ')}` : '';
      const apptScopeSql = apptScope.length ? ` AND ${apptScope.join(' AND ')}` : '';

      // CONSISTENCY MODEL (the reason KPI numbers used to look "wrong"):
      // this endpoint previously counted the QUEUE TABLE ONLY (checked-in
      // patients), while the five summary cards count appointments ∪ queue.
      // With e.g. 10 booked appointments and 4 check-ins, the top row said
      // Total=4 while the Today card said 10 — mutually contradictory on the
      // same screen. Now:
      //   total     = distinct patients with ANY visit today across BOTH
      //               tables (active ∪ completed; cancelled/no-show excluded)
      //   completed = SAME definition as the Completed summary card
      //   ⇒ Pending (total − completed, derived on the frontend) equals the
      //     "Today (Active)" card exactly.
      const [[{ total }]] = await db.execute(`
        SELECT COUNT(*) AS total FROM (
          SELECT a.patient_id FROM appointments a
           WHERE DATE(a.appointment_date) = ?
             AND a.status NOT IN ('cancelled', 'no-show', 'completed')${apptScopeSql}
          UNION
          SELECT q.patient_id FROM queue q
           WHERE DATE(q.check_in_time) = ?
             AND q.status NOT IN ('cancelled', 'no-show', 'skipped', 'completed')${queueScopeSql}
          UNION
          SELECT a.patient_id FROM appointments a
           WHERE a.status = 'completed'
             AND DATE(COALESCE(a.visit_ended_at, a.appointment_date)) = ?${apptScopeSql}
          UNION
          SELECT q.patient_id FROM queue q
           WHERE q.status = 'completed'
             AND DATE(COALESCE(q.completed_at, q.check_in_time)) = ?${queueScopeSql}
        ) t
      `, [
        targetDate, ...apptScopeParams,
        targetDate, ...queueScopeParams,
        targetDate, ...apptScopeParams,
        targetDate, ...queueScopeParams,
      ]);

      // completed — identical definition to getDashboardStats' Completed card.
      const [[{ completed }]] = await db.execute(`
        SELECT COUNT(*) AS completed FROM (
          SELECT a.patient_id FROM appointments a
           WHERE a.status = 'completed'
             AND DATE(COALESCE(a.visit_ended_at, a.appointment_date)) = ?${apptScopeSql}
          UNION
          SELECT q.patient_id FROM queue q
           WHERE q.status = 'completed'
             AND DATE(COALESCE(q.completed_at, q.check_in_time)) = ?${queueScopeSql}
        ) c
      `, [targetDate, ...apptScopeParams, targetDate, ...queueScopeParams]);

      // waiting / in_progress / avg wait are genuinely queue-only concepts
      // (you can't be "waiting" without checking in). 'called' counts as
      // in_progress — the frontend has always mapped it that way, but the SQL
      // ignored it, so a just-called patient vanished from every bucket while
      // still inflating the old total.
      const [[liveStats]] = await db.execute(`
        SELECT
          SUM(CASE WHEN q.status = 'waiting' THEN 1 ELSE 0 END) as waiting,
          SUM(CASE WHEN q.status IN ('in_progress', 'called') THEN 1 ELSE 0 END) as in_progress,
          AVG(TIMESTAMPDIFF(MINUTE, q.check_in_time, q.called_at)) as avg_wait_time_minutes
        FROM queue q
        WHERE DATE(q.check_in_time) = ? AND q.status NOT IN ('cancelled', 'no-show', 'skipped')${queueScopeSql}
      `, [targetDate, ...queueScopeParams]);

      const stats = {
        total: Number(total) || 0,
        waiting: Number(liveStats?.waiting) || 0,
        in_progress: Number(liveStats?.in_progress) || 0,
        completed: Number(completed) || 0,
        avg_wait_time_minutes: liveStats?.avg_wait_time_minutes ?? null,
      };

      const billScope = [];
      if (doctor_id) {
        billScope.push('b.doctor_id = ?');
      } else if (clinic_id) {
        billScope.push('b.clinic_id = ?');
      }
      const billScopeSql = billScope.length ? ` AND ${billScope.join(' AND ')}` : '';

      // Paid = bills fully paid today, INDEPENDENT of visit status.
      // Since 2026-07-15 payment no longer auto-completes the visit, so a
      // patient can be paid while still active in the queue — tying Paid to
      // completed rows would under-count every such payment.
      const billScopeParams = doctor_id ? [doctor_id] : clinic_id ? [clinic_id] : [];
      const paidParams = [targetDate, ...billScopeParams];
      const [[billStats]] = await db.execute(`
        SELECT COUNT(DISTINCT b.patient_id) as paid
        FROM bills b
        WHERE DATE(b.bill_date) = ?
          AND b.payment_status = 'paid'${billScopeSql}
      `, paidParams);

      return { ...stats, paid: billStats?.paid || 0 };
    } catch (error) {
      throw ApiError.internal('Failed to fetch queue statistics', error.message);
    }
  }

  /**
   * Get the 5 Queue Dashboard summary-card counts in a single round trip.
   *
   * Counts every patient ONCE per calendar day across BOTH the appointments
   * and queue tables (a patient who has an appointment AND a queue row for the
   * same day is counted once). This is computed entirely in SQL so the numbers
   * are an authoritative source of truth and never drift from the displayed
   * list (which previously re-derived them client-side).
   *
   *   - today     : appointments scheduled today  +  walk-in queue rows today
   *                 (cancelled / no-show excluded)
   *   - followups : today's visits whose linked appointment is a follow-up
   *                 (consultation_type='followup') or whose reason mentions
   *                 "follow"
   *   - completed : today's visits in a completed state (appointment.status or
   *                 queue.status = 'completed')
   *   - upcoming  : future-dated appointments not completed/cancelled
   *   - others    : past-dated appointments not completed/cancelled/no-show
   *
   * @param {Object} options - { doctor_id, clinic_id }
   * @returns {Promise<Object>} { today, followups, completed, upcoming, others }
   */
  async getDashboardStats(options = {}) {
    const db = getDb();
    const { doctor_id, clinic_id } = options;

    // Optional doctor/clinic scoping, applied identically to every sub-query so
    // the cards stay consistent with the (doctor-filtered) list.
    const apptScope = [];
    const apptParams = [];
    const queueScope = [];
    const queueParams = [];
    if (doctor_id) {
      apptScope.push('a.doctor_id = ?');
      apptParams.push(doctor_id);
      queueScope.push('q.doctor_id = ?');
      queueParams.push(doctor_id);
    } else if (clinic_id) {
      apptScope.push('a.clinic_id = ?');
      apptParams.push(clinic_id);
      queueScope.push('q.clinic_id = ?');
      queueParams.push(clinic_id);
    }
    const apptScopeSql = apptScope.length ? ` AND ${apptScope.join(' AND ')}` : '';
    const queueScopeSql = queueScope.length ? ` AND ${queueScope.join(' AND ')}` : '';

    try {
      // -- TODAY: distinct patients seen today, ACTIVE ∪ COMPLETED --
      // FIX (2026-07-15): this used to exclude 'completed', making it an
      // active-only count — so marking a visit Done DECREASED Today by 1
      // instead of leaving it unchanged, breaking the invariant
      // Today = Pending + Completed the moment the first patient of the day
      // finished. Today must be the full-day total (mirrors getStats()'
      // 'total', which was already correct) — Pending/Completed are the two
      // mutually-exclusive buckets it splits into, never a subset of it.
      // Each UNION member also carries the visit CHANNEL (offline/online) so
      // the distinct unit is (patient, channel) — the EXACT rule the frontend
      // uses (utils/visitDedupe.js: patient|day|channel). Queue rows are
      // walk-ins → always 'offline' (queue table has no type column).
      const apptChannelSql = "LOWER(COALESCE(NULLIF(a.appointment_type,''), IF(a.arrival_type='online','online','offline')))";
      const [[{ today }]] = await db.execute(
        `
        SELECT COUNT(*) AS today FROM (
          SELECT a.patient_id, ${apptChannelSql} AS ch
            FROM appointments a
           WHERE DATE(a.appointment_date) = CURDATE()
             AND a.status NOT IN ('cancelled', 'no-show', 'completed')${apptScopeSql}
          UNION
          SELECT q.patient_id, 'offline' AS ch
            FROM queue q
           WHERE q.check_in_date = CURDATE()
             AND q.status NOT IN ('cancelled', 'no-show', 'skipped', 'completed')${queueScopeSql}
          UNION
          SELECT a.patient_id, ${apptChannelSql} AS ch
            FROM appointments a
           WHERE a.status = 'completed'
             AND DATE(COALESCE(a.visit_ended_at, a.appointment_date)) = CURDATE()${apptScopeSql}
          UNION
          SELECT q.patient_id, 'offline' AS ch
            FROM queue q
           WHERE q.status = 'completed'
             AND DATE(COALESCE(q.completed_at, q.check_in_date)) = CURDATE()${queueScopeSql}
        ) t
        `,
        [...apptParams, ...queueParams, ...apptParams, ...queueParams]
      );

      // -- COMPLETED today: distinct patients whose visit completed today --
      const [[{ completed }]] = await db.execute(
        `
        SELECT COUNT(*) AS completed FROM (
          SELECT a.patient_id, ${apptChannelSql} AS ch
            FROM appointments a
           WHERE a.status = 'completed'
             AND DATE(COALESCE(a.visit_ended_at, a.appointment_date)) = CURDATE()${apptScopeSql}
          UNION
          SELECT q.patient_id, 'offline' AS ch
            FROM queue q
           WHERE q.status = 'completed'
             AND DATE(COALESCE(q.completed_at, q.check_in_date)) = CURDATE()${queueScopeSql}
        ) c
        `,
        [...apptParams, ...queueParams]
      );

      // -- FOLLOW UPS today (REMAINING only): appointment-based (queue has no
      //    visit_type column). Completed follow-ups are excluded so this card
      //    shows only pending/remaining follow-ups, matching the list view.
      const [[{ followups }]] = await db.execute(
        `
        SELECT COUNT(DISTINCT a.patient_id) AS followups
          FROM appointments a
         WHERE DATE(a.appointment_date) = CURDATE()
           AND a.status NOT IN ('completed', 'cancelled', 'no-show')
           AND (a.consultation_type = 'followup'
                OR LOWER(COALESCE(a.reason_for_visit, '')) LIKE '%follow%')${apptScopeSql}
        `,
        apptParams
      );

      // -- UPCOMING: future-dated appointments, not completed/cancelled --
      const [[{ upcoming }]] = await db.execute(
        `
        SELECT COUNT(DISTINCT a.patient_id, DATE(a.appointment_date)) AS upcoming
          FROM appointments a
         WHERE DATE(a.appointment_date) > CURDATE()
           AND a.status NOT IN ('completed', 'cancelled', 'no-show')${apptScopeSql}
        `,
        apptParams
      );

      // -- OTHERS: RECENT past-dated appointments still open (not completed/
      //    cancelled/no-show). Limited to the last 7 days so very old, stale
      //    appointments that were never closed don't inflate this card.
      const [[{ others }]] = await db.execute(
        `
        SELECT COUNT(DISTINCT a.patient_id, DATE(a.appointment_date)) AS others
          FROM appointments a
         WHERE DATE(a.appointment_date) < CURDATE()
           AND DATE(a.appointment_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           AND a.status NOT IN ('completed', 'cancelled', 'no-show')${apptScopeSql}
        `,
        apptParams
      );

      return {
        today: Number(today) || 0,
        followups: Number(followups) || 0,
        completed: Number(completed) || 0,
        upcoming: Number(upcoming) || 0,
        others: Number(others) || 0,
      };
    } catch (error) {
      throw ApiError.internal('Failed to fetch queue dashboard stats', error.message);
    }
  }

  // ============ PRIVATE METHODS ============

  /**
   * Generate unique token number for the day
   * @private
   */
  async _generateTokenNumber(doctor_id, clinic_id) {
    const db = getDb();
    // token_number is used as a simple per-day sequence in the current DB.
    // Use DB-side CURDATE() to avoid timezone issues.
    const [[{ max_token }]] = await db.execute(
      `
      SELECT MAX(CAST(token_number AS UNSIGNED)) as max_token
      FROM queue
      WHERE doctor_id = ? AND clinic_id = ? AND DATE(check_in_time) = CURDATE()
    `,
      [doctor_id, clinic_id]
    );

    const nextToken = (Number(max_token) || 0) + 1;
    return String(nextToken);
  }
}

module.exports = new QueueService();
