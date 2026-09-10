const { query, getFromCache, setCache } = require('../config/db');
const { getLocalDateString } = require('../utils/localDate');
// Canonical KPI source — the SAME service the Queue Dashboard cards use.
// Overlapping metrics (completed) must come from here, never re-implemented.
const QueueService = require('./QueueService');

class StaffDashboardService {
  static async getStaffDashboard() {
    const today = getLocalDateString();
    const cacheKey = `staff_dashboard_${today}`;

    const cached = await getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const [
      totalPatientsResult,
      queueResult,
      servingResult,
      canonicalStats,
      avgWaitResult,
      todayAppointmentsResult,
      upcomingResult,
      recentPatientsResult,
    ] = await Promise.all([
      query(`SELECT COUNT(DISTINCT p.id) as total FROM patients p WHERE DATE(p.created_at) = ?`, [today]),
      query(`SELECT COUNT(*) as in_queue FROM queue q WHERE q.status IN ('waiting','in_progress') AND DATE(q.check_in_time) = ?`, [today]),
      query(`SELECT COUNT(*) as currently_serving FROM queue q WHERE q.status = 'in_progress' AND DATE(q.check_in_time) = ?`, [today]),
      // Completed = delegated to the canonical KPI source (the same
      // QueueService.getDashboardStats the Queue Dashboard cards use), so this
      // dashboard can never drift from the others. Clinic-wide (unscoped) —
      // the staff dashboard shows the whole clinic. The old local COUNT(*)
      // over queue rows missed appointment-side completions and
      // double-counted duplicate queue rows.
      QueueService.getDashboardStats({}),
      query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, q.check_in_time, COALESCE(q.start_time, NOW()))) as avg_wait_time FROM queue q WHERE q.status = 'completed' AND DATE(q.completed_at) = ? AND q.check_in_time IS NOT NULL`,
        [today]
      ),
      query(
        `SELECT a.id, a.appointment_time, a.status, p.patient_id as uhid, p.name as patient_name, p.phone, u.name as doctor_name FROM appointments a JOIN patients p ON a.patient_id = p.id LEFT JOIN doctors d ON a.doctor_id = d.id LEFT JOIN users u ON d.user_id = u.id WHERE a.appointment_date = ? ORDER BY a.appointment_time ASC LIMIT 20`,
        [today]
      ),
      query(
        `SELECT a.id, a.appointment_date, a.appointment_time, p.patient_id as uhid, p.name as patient_name, u.name as doctor_name FROM appointments a JOIN patients p ON a.patient_id = p.id LEFT JOIN doctors d ON a.doctor_id = d.id LEFT JOIN users u ON d.user_id = u.id WHERE a.appointment_date > ? AND a.status = 'scheduled' ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 3`,
        [today]
      ),
      query(`SELECT id, patient_id, name, phone, gender, created_at FROM patients WHERE created_at >= DATE_SUB(?, INTERVAL 7 DAY) ORDER BY created_at DESC LIMIT 10`, [today]),
    ]);

    const dashboard = {
      date: today,
      stats: {
        totalPatients: totalPatientsResult[0]?.total || 0,
        inQueue: queueResult[0]?.in_queue || 0,
        currentlyServing: servingResult[0]?.currently_serving || 0,
        completedToday: canonicalStats?.completed || 0,
        avgWaitTime: Math.round(avgWaitResult[0]?.avg_wait_time || 0),
      },
      todayAppointments: todayAppointmentsResult,
      upcoming: upcomingResult,
      recentPatients: recentPatientsResult,
      timestamp: new Date().toISOString(),
    };

    await setCache(cacheKey, dashboard, 300);
    return dashboard;
  }

  static async getStaffStats() {
    const today = getLocalDateString();
    const cacheKey = `staff_stats_${today}`;

    const cached = await getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const [totalPatientsResult] = await query(
      `
      SELECT COUNT(DISTINCT p.id) as total
      FROM patients p
      WHERE DATE(p.created_at) = ?
    `,
      [today]
    );

    const [queueResult] = await query(
      `
      SELECT COUNT(*) as in_queue
      FROM queue q
      WHERE q.status IN ('waiting', 'in_progress')
      AND DATE(q.check_in_time) = ?
    `,
      [today]
    );

    const [servingResult] = await query(
      `
      SELECT COUNT(*) as currently_serving
      FROM queue q
      WHERE q.status = 'in_progress'
      AND DATE(q.check_in_time) = ?
    `,
      [today]
    );

    const [completedResult] = await query(
      `
      SELECT COUNT(*) as completed_today
      FROM queue q
      WHERE q.status = 'completed'
      AND DATE(q.completed_at) = ?
    `,
      [today]
    );

    const [avgWaitResult] = await query(
      `
      SELECT AVG(
        TIMESTAMPDIFF(MINUTE, q.check_in_time, 
          COALESCE(q.start_time, NOW())
        )
      ) as avg_wait_time
      FROM queue q
      WHERE q.status = 'completed'
      AND DATE(q.completed_at) = ?
      AND q.check_in_time IS NOT NULL
    `,
      [today]
    );

    const stats = {
      totalPatients: totalPatientsResult[0]?.total || 0,
      inQueue: queueResult[0]?.in_queue || 0,
      currentlyServing: servingResult[0]?.currently_serving || 0,
      completedToday: completedResult[0]?.completed_today || 0,
      avgWaitTime: Math.round(avgWaitResult[0]?.avg_wait_time || 0),
      timestamp: new Date().toISOString(),
    };

    await setCache(cacheKey, stats, 300);
    return stats;
  }

  static async getPatientsInQueue({ status }) {
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status && status !== 'all') {
      whereClause = 'WHERE q.status = ?';
      params = [status];
    }

    const patients = await query(
      `
      SELECT 
        q.id,
        p.patient_id,
        p.name,
        p.phone,
        q.status as queue_status,
        q.check_in_time,
        q.start_time as service_start_time,
        q.doctor_id as assigned_doctor_id,
        u.name as assigned_doctor_name,
        TIMESTAMPDIFF(MINUTE, q.check_in_time, COALESCE(q.start_time, NOW())) as wait_minutes
      FROM queue q
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN doctors d ON q.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN q.status = 'waiting' THEN 1
          WHEN q.status = 'in_progress' THEN 2
          WHEN q.status = 'completed' THEN 3
          ELSE 4
        END,
        q.check_in_time ASC
      LIMIT 50
    `,
      params
    );

    return { patients };
  }

  static async updatePatientQueueStatus({ id, status }) {
    const validStatuses = ['waiting', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      const err = new Error('Invalid status');
      err.statusCode = 400;
      throw err;
    }

    let updateFields = 'status = ?, updated_at = NOW()';
    const params = [status];

    if (status === 'in_progress') {
      updateFields += ', started_at = NOW()';
    } else if (status === 'completed') {
      updateFields += ', completed_at = NOW()';
    }

    await query(
      `
      UPDATE queue 
      SET ${updateFields}
      WHERE id = ?
    `,
      [...params, id]
    );

    await setCache(`staff_stats_${getLocalDateString()}`, null, 0);

    return { updated: true };
  }

  static async assignPatientToDoctor({ id, doctor_id }) {
    if (!doctor_id) {
      const err = new Error('Doctor ID is required');
      err.statusCode = 400;
      throw err;
    }

    const doctor = await query(`SELECT name FROM doctors WHERE id = ?`, [doctor_id]);

    if (!doctor || doctor.length === 0) {
      const err = new Error('Doctor not found');
      err.statusCode = 400;
      throw err;
    }

    await query(
      `
      UPDATE queue 
      SET doctor_id = ?, status = 'in_progress', started_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `,
      [doctor_id, id]
    );

    await setCache(`staff_stats_${getLocalDateString()}`, null, 0);

    return { doctor_name: doctor[0].name };
  }
}

module.exports = StaffDashboardService;
