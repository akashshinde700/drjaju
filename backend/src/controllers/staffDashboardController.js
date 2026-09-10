const { query, getFromCache, setCache } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getLocalDateString } = require('../utils/localDate');

// Batched staff dashboard endpoint to reduce parallel calls
async function getStaffDashboard(req, res) {
  try {
    const today = getLocalDateString();
    const cacheKey = `staff_dashboard_${today}`;
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return sendSuccess(res, { ...cached, cached: true });
    }

    const [
      totalPatientsResult,
      queueResult,
      servingResult,
      completedResult,
      avgWaitResult,
      todayAppointmentsResult,
      upcomingResult,
      recentPatientsResult
    ] = await Promise.all([
      query(`SELECT COUNT(DISTINCT p.id) as total FROM patients p WHERE DATE(p.created_at) = ?`, [today]),
      query(`SELECT COUNT(*) as in_queue FROM queue q WHERE q.status IN ('waiting','in_progress') AND DATE(q.check_in_time) = ?`, [today]),
      query(`SELECT COUNT(*) as currently_serving FROM queue q WHERE q.status = 'in_progress' AND DATE(q.check_in_time) = ?`, [today]),
      query(`SELECT COUNT(*) as completed_today FROM queue q WHERE q.status = 'completed' AND DATE(q.completed_at) = ?`, [today]),
      query(`SELECT AVG(TIMESTAMPDIFF(MINUTE, q.check_in_time, COALESCE(q.start_time, NOW()))) as avg_wait_time FROM queue q WHERE q.status = 'completed' AND DATE(q.completed_at) = ? AND q.check_in_time IS NOT NULL`, [today]),
      query(`SELECT a.id, a.appointment_time, a.status, p.patient_id as uhid, p.name as patient_name, p.phone, u.name as doctor_name FROM appointments a JOIN patients p ON a.patient_id = p.id LEFT JOIN doctors d ON a.doctor_id = d.id LEFT JOIN users u ON d.user_id = u.id WHERE a.appointment_date = ? ORDER BY a.appointment_time ASC LIMIT 20`, [today]),
      query(`SELECT a.id, a.appointment_date, a.appointment_time, p.patient_id as uhid, p.name as patient_name, u.name as doctor_name FROM appointments a JOIN patients p ON a.patient_id = p.id LEFT JOIN doctors d ON a.doctor_id = d.id LEFT JOIN users u ON d.user_id = u.id WHERE a.appointment_date > ? AND a.status = 'scheduled' ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 3`, [today]),
      query(`SELECT id, patient_id, name, phone, gender, created_at FROM patients WHERE created_at >= DATE_SUB(?, INTERVAL 7 DAY) ORDER BY created_at DESC LIMIT 10`, [today])
    ]);

    const dashboard = {
      date: today,
      stats: {
        totalPatients: totalPatientsResult[0]?.total || 0,
        inQueue: queueResult[0]?.in_queue || 0,
        currentlyServing: servingResult[0]?.currently_serving || 0,
        completedToday: completedResult[0]?.completed_today || 0,
        avgWaitTime: Math.round(avgWaitResult[0]?.avg_wait_time || 0)
      },
      todayAppointments: todayAppointmentsResult,
      upcoming: upcomingResult,
      recentPatients: recentPatientsResult,
      timestamp: new Date().toISOString()
    };

    await setCache(cacheKey, dashboard, 300); // 5 minutes
    return sendSuccess(res, dashboard);
  } catch (error) {
    sendError(res, 'Failed to fetch staff dashboard', 500, process.env.NODE_ENV === 'development' ? error.message : undefined);
  }
}

// Get staff dashboard statistics
async function getStaffStats(req, res) {
  try {
    const today = getLocalDateString(); // YYYY-MM-DD format
    
    // Check cache first
    const cacheKey = `staff_stats_${today}`;
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        ...cached,
        cached: true
      });
    }

    // Get total patients today
    const [totalPatientsResult] = await query(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM patients p
      WHERE DATE(p.created_at) = ?
    `, [today]);

    // Get patients currently in queue
    const [queueResult] = await query(`
      SELECT COUNT(*) as in_queue
      FROM queue q
      WHERE q.status IN ('waiting', 'in_progress')
      AND DATE(q.check_in_time) = ?
    `, [today]);

    // Get currently serving patients
    const [servingResult] = await query(`
      SELECT COUNT(*) as currently_serving
      FROM queue q
      WHERE q.status = 'in_progress'
      AND DATE(q.check_in_time) = ?
    `, [today]);

    // Get completed patients today
    const [completedResult] = await query(`
      SELECT COUNT(*) as completed_today
      FROM queue q
      WHERE q.status = 'completed'
      AND DATE(q.completed_at) = ?
    `, [today]);

    // Get average wait time
    const [avgWaitResult] = await query(`
      SELECT AVG(
        TIMESTAMPDIFF(MINUTE, q.check_in_time, 
          COALESCE(q.start_time, NOW())
        )
      ) as avg_wait_time
      FROM queue q
      WHERE q.status = 'completed'
      AND DATE(q.completed_at) = ?
      AND q.check_in_time IS NOT NULL
    `, [today]);

    const stats = {
      totalPatients: totalPatientsResult[0]?.total || 0,
      inQueue: queueResult[0]?.in_queue || 0,
      currentlyServing: servingResult[0]?.currently_serving || 0,
      completedToday: completedResult[0]?.completed_today || 0,
      avgWaitTime: Math.round(avgWaitResult[0]?.avg_wait_time || 0),
      timestamp: new Date().toISOString()
    };

    // Cache for 5 minutes
    await setCache(cacheKey, stats, 300);

    res.json({
      success: true,
      ...stats
    });

  } catch (error) {
    console.error('Error fetching staff stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
}

// Get patients in queue
async function getPatientsInQueue(req, res) {
  try {
    const { status } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status && status !== 'all') {
      whereClause = 'WHERE q.status = ?';
      params = [status];
    }

    const patients = await query(`
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
    `, params);

    res.json({
      success: true,
      patients: patients
    });

  } catch (error) {
    console.error('Error fetching patients in queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patients'
    });
  }
}

// Update patient queue status
async function updatePatientQueueStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['waiting', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    let updateFields = 'status = ?, updated_at = NOW()';
    let params = [status];

    if (status === 'in_progress') {
      updateFields += ', started_at = NOW()';
    } else if (status === 'completed') {
      updateFields += ', completed_at = NOW()';
    }

    await query(`
      UPDATE queue 
      SET ${updateFields}
      WHERE id = ?
    `, [...params, id]);

    // Clear cache
    await setCache(`staff_stats_${getLocalDateString()}`, null, 0);

    res.json({
      success: true,
      message: 'Patient status updated successfully'
    });

  } catch (error) {
    console.error('Error updating patient status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update patient status'
    });
  }
}

// Assign patient to doctor
async function assignPatientToDoctor(req, res) {
  try {
    const { id } = req.params;
    const { doctor_id } = req.body;

    if (!doctor_id) {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID is required'
      });
    }

    // Get doctor details
    const [doctor] = await query(`
      SELECT name FROM doctors WHERE id = ?
    `, [doctor_id]);

    if (!doctor || doctor.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Update patient assignment
    await query(`
      UPDATE queue 
      SET doctor_id = ?, status = 'in_progress', started_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [doctor_id, id]);

    // Clear cache
    await setCache(`staff_stats_${getLocalDateString()}`, null, 0);

    res.json({
      success: true,
      message: 'Patient assigned to doctor successfully',
      doctor_name: doctor[0].name
    });

  } catch (error) {
    console.error('Error assigning patient to doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign patient to doctor'
    });
  }
}

module.exports = {
  getStaffDashboard,
  getStaffStats,
  getPatientsInQueue,
  updatePatientQueueStatus,
  assignPatientToDoctor
};

module.exports = require('./staffDashboardController_refactored');
