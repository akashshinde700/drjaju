const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { getLocalDateString } = require('../utils/localDate');

class EnhancedAnalyticsService {
  static buildDateRange(period, start_date, end_date) {
    let dateStart = start_date;
    let dateEnd = end_date;
    if (!dateStart || !dateEnd) {
      const today = new Date();
      dateEnd = getLocalDateString(today);
      switch (period) {
        case 'today':
          dateStart = dateEnd;
          break;
        case 'week': {
          const d = new Date(today);
          d.setDate(d.getDate() - 7);
          dateStart = getLocalDateString(d);
          break;
        }
        case 'month': {
          const d = new Date(today);
          d.setMonth(d.getMonth() - 1);
          dateStart = getLocalDateString(d);
          break;
        }
        case '3months': {
          const d = new Date(today);
          d.setMonth(d.getMonth() - 3);
          dateStart = getLocalDateString(d);
          break;
        }
        case 'year': {
          const d = new Date(today);
          d.setFullYear(d.getFullYear() - 1);
          dateStart = getLocalDateString(d);
          break;
        }
        default:
          dateStart = dateEnd;
      }
    }
    return { dateStart, dateEnd };
  }

  static async getDashboardOverview(query) {
    const { doctor_id, clinic_id, period = 'month', start_date, end_date } = query;
    const db = getDb();
    const { dateStart, dateEnd } = EnhancedAnalyticsService.buildDateRange(period, start_date, end_date);

    const params = [dateStart, dateEnd];
    let baseWhere = 'WHERE a.appointment_date >= ? AND a.appointment_date <= ?';
    if (doctor_id) { baseWhere += ' AND a.doctor_id = ?'; params.push(parseInt(doctor_id)); }
    if (clinic_id) { baseWhere += ' AND a.clinic_id = ?'; params.push(parseInt(clinic_id)); }

    const [totalAppts] = await db.execute(`SELECT COUNT(*) as total FROM appointments a ${baseWhere}`, params);

    const [statusBreakdown] = await db.execute(
      `SELECT
        SUM(CASE WHEN status = 'scheduled' OR status = 'confirmed' OR status = 'checked-in' OR status = 'in-progress' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as noshow
      FROM appointments a ${baseWhere}`,
      params
    );

    const [arrivalBreakdown] = await db.execute(
      `SELECT
        SUM(CASE WHEN arrival_type = 'online' OR arrival_type = 'app' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN arrival_type = 'walk-in' THEN 1 ELSE 0 END) as walkin,
        SUM(CASE WHEN arrival_type = 'referral' THEN 1 ELSE 0 END) as referral,
        SUM(CASE WHEN arrival_type = 'emergency' THEN 1 ELSE 0 END) as emergency
      FROM appointments a ${baseWhere}`,
      params
    );

    const [totalPatients] = await db.execute(
      `SELECT COUNT(DISTINCT a.patient_id) as total FROM appointments a ${baseWhere}`,
      params
    );

    let patientParams = [dateStart, dateEnd];
    let patientWhere = 'WHERE registered_date >= ? AND registered_date <= ?';
    if (clinic_id) { patientWhere += ' AND clinic_id = ?'; patientParams.push(parseInt(clinic_id)); }
    const [newPatients] = await db.execute(`SELECT COUNT(*) as total FROM patients ${patientWhere}`, patientParams);

    const todayDate = getLocalDateString();
    let todayParams = [todayDate];
    let todayWhere = 'WHERE a.appointment_date = ?';
    if (doctor_id) { todayWhere += ' AND a.doctor_id = ?'; todayParams.push(parseInt(doctor_id)); }
    if (clinic_id) { todayWhere += ' AND a.clinic_id = ?'; todayParams.push(parseInt(clinic_id)); }
    const [todayAppts] = await db.execute(`SELECT COUNT(*) as total FROM appointments a ${todayWhere}`, todayParams);

    const [avgWait] = await db.execute(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, checked_in_at, visit_started_at)), 1) as avg_wait
       FROM appointments a ${baseWhere}
       AND checked_in_at IS NOT NULL AND visit_started_at IS NOT NULL
       AND visit_started_at > checked_in_at`,
      params
    );

    const [avgDuration] = await db.execute(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, visit_started_at, visit_ended_at)), 1) as avg_dur
       FROM appointments a ${baseWhere}
       AND visit_started_at IS NOT NULL AND visit_ended_at IS NOT NULL
       AND visit_ended_at > visit_started_at`,
      params
    );

    let billParams = [dateStart, dateEnd];
    let billWhere = 'WHERE bill_date >= ? AND bill_date <= ?';
    if (clinic_id) { billWhere += ' AND clinic_id = ?'; billParams.push(parseInt(clinic_id)); }
    const [revenue] = await db.execute(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_revenue
       FROM bills ${billWhere}`,
      billParams
    );

    return {
      period,
      date_range: { start: dateStart, end: dateEnd },
      total_appointments: totalAppts[0]?.total || 0,
      today_appointments: todayAppts[0]?.total || 0,
      scheduled_appointments: statusBreakdown[0]?.scheduled || 0,
      completed_appointments: statusBreakdown[0]?.completed || 0,
      cancelled_appointments: statusBreakdown[0]?.cancelled || 0,
      noshow_appointments: statusBreakdown[0]?.noshow || 0,
      total_patients: totalPatients[0]?.total || 0,
      new_patients: newPatients[0]?.total || 0,
      online_arrivals: arrivalBreakdown[0]?.online || 0,
      walkin_arrivals: arrivalBreakdown[0]?.walkin || 0,
      referral_arrivals: arrivalBreakdown[0]?.referral || 0,
      emergency_arrivals: arrivalBreakdown[0]?.emergency || 0,
      avg_waiting_time: avgWait[0]?.avg_wait || 0,
      avg_visit_duration: avgDuration[0]?.avg_dur || 0,
      total_revenue: revenue[0]?.total_revenue || 0,
      paid_revenue: revenue[0]?.paid_revenue || 0,
    };
  }

  static async getVisitAnalytics(query) {
    const { doctor_id, clinic_id, start_date, end_date, group_by = 'day' } = query;
    const db = getDb();

    const dateStart = start_date || getLocalDateString(new Date(Date.now() - 30 * 86400000));
    const dateEnd = end_date || getLocalDateString();

    const params = [dateStart, dateEnd];
    let baseWhere = 'WHERE a.appointment_date >= ? AND a.appointment_date <= ?';
    if (doctor_id) { baseWhere += ' AND a.doctor_id = ?'; params.push(parseInt(doctor_id)); }
    if (clinic_id) { baseWhere += ' AND a.clinic_id = ?'; params.push(parseInt(clinic_id)); }

    let groupByClause;
    switch (group_by) {
      case 'week': groupByClause = 'DATE_FORMAT(a.appointment_date, "%Y-%u")'; break;
      case 'month': groupByClause = 'DATE_FORMAT(a.appointment_date, "%Y-%m")'; break;
      default: groupByClause = 'DATE(a.appointment_date)';
    }

    const [trends] = await db.execute(
      `SELECT
        ${groupByClause} as period,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_visits,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_visits,
        COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) as noshow_visits,
        COUNT(CASE WHEN a.arrival_type = 'walk-in' THEN 1 END) as walkin_visits,
        COUNT(CASE WHEN a.arrival_type IN ('online','app') THEN 1 END) as online_visits,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        ROUND(AVG(CASE WHEN a.checked_in_at IS NOT NULL AND a.visit_started_at IS NOT NULL
          AND a.visit_started_at > a.checked_in_at
          THEN TIMESTAMPDIFF(MINUTE, a.checked_in_at, a.visit_started_at) END), 1) as avg_waiting_time
      FROM appointments a
      ${baseWhere}
      GROUP BY ${groupByClause}
      ORDER BY period ASC
      LIMIT 90`,
      params
    );

    const [peakHours] = await db.execute(
      `SELECT
        HOUR(a.appointment_time) as hour,
        COUNT(*) as visit_count
      FROM appointments a
      ${baseWhere}
      GROUP BY HOUR(a.appointment_time)
      ORDER BY hour ASC`,
      params
    );

    const [topDoctors] = await db.execute(
      `SELECT
        u.name as doctor_name,
        a.doctor_id,
        COUNT(*) as visit_count,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count,
        COUNT(DISTINCT a.patient_id) as unique_patients
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      ${baseWhere}
      GROUP BY a.doctor_id, u.name
      ORDER BY visit_count DESC
      LIMIT 10`,
      params
    );

    return {
      visit_trends: trends,
      peak_hours: peakHours,
      top_doctors: topDoctors,
      date_range: { start: dateStart, end: dateEnd }
    };
  }

  static async getMedicationAnalytics(query) {
    const { doctor_id, clinic_id, start_date, end_date, limit = 20, search = '' } = query;
    const db = getDb();

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) { whereClause += ' AND p.created_at >= ?'; params.push(start_date); }
    if (end_date) { whereClause += ' AND p.created_at <= ?'; params.push(end_date + ' 23:59:59'); }
    if (doctor_id) { whereClause += ' AND p.doctor_id = ?'; params.push(parseInt(doctor_id)); }
    if (clinic_id) { whereClause += ' AND p.clinic_id = ?'; params.push(parseInt(clinic_id)); }
    if (search) { whereClause += ' AND pi.medicine_name LIKE ?'; params.push(`%${search}%`); }

    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));

    const [medications] = await db.query(
      `SELECT
        pi.medicine_name,
        COUNT(*) as prescription_count,
        COUNT(DISTINCT p.patient_id) as unique_patients
      FROM prescription_items pi
      JOIN prescriptions p ON pi.prescription_id = p.id
      ${whereClause}
      GROUP BY pi.medicine_name
      ORDER BY prescription_count DESC
      LIMIT ${safeLimit}`,
      params
    );

    const [categories] = await db.query(
      `SELECT
        COALESCE(pi.route, 'Oral') as name,
        COUNT(*) as count
      FROM prescription_items pi
      JOIN prescriptions p ON pi.prescription_id = p.id
      ${whereClause}
      GROUP BY pi.route
      ORDER BY count DESC`,
      params
    );

    let trendWhere = 'WHERE 1=1';
    const trendParams = [];
    if (start_date) { trendWhere += ' AND p.created_at >= ?'; trendParams.push(start_date); }
    if (end_date) { trendWhere += ' AND p.created_at <= ?'; trendParams.push(end_date + ' 23:59:59'); }
    if (doctor_id) { trendWhere += ' AND p.doctor_id = ?'; trendParams.push(parseInt(doctor_id)); }
    if (clinic_id) { trendWhere += ' AND p.clinic_id = ?'; trendParams.push(parseInt(clinic_id)); }

    const [trend] = await db.query(
      `SELECT DATE(p.created_at) as date, COUNT(*) as prescription_count
       FROM prescriptions p ${trendWhere}
       GROUP BY DATE(p.created_at)
       ORDER BY date ASC
       LIMIT 60`,
      trendParams
    );

    return {
      top_medications: medications,
      medication_categories: categories,
      prescription_trend: trend,
      total_unique_medications: medications.length
    };
  }

  static async getSymptomsAnalytics(query) {
    const { doctor_id, clinic_id, start_date, end_date, limit = 20, search = '' } = query;
    const db = getDb();

    let whereClause = 'WHERE reason_for_visit IS NOT NULL AND reason_for_visit != ""';
    const params = [];

    if (start_date) { whereClause += ' AND appointment_date >= ?'; params.push(start_date); }
    if (end_date) { whereClause += ' AND appointment_date <= ?'; params.push(end_date); }
    if (doctor_id) { whereClause += ' AND doctor_id = ?'; params.push(parseInt(doctor_id)); }
    if (clinic_id) { whereClause += ' AND clinic_id = ?'; params.push(parseInt(clinic_id)); }
    if (search) { whereClause += ' AND reason_for_visit LIKE ?'; params.push(`%${search}%`); }

    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));

    const [symptoms] = await db.query(
      `SELECT
        reason_for_visit as symptom,
        COUNT(*) as frequency,
        COUNT(DISTINCT patient_id) as unique_patients,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_visits
      FROM appointments
      ${whereClause}
      GROUP BY reason_for_visit
      ORDER BY frequency DESC
      LIMIT ${safeLimit}`,
      params
    );

    let diagWhere = 'WHERE diagnosis IS NOT NULL AND diagnosis != ""';
    const diagParams = [];
    if (start_date) { diagWhere += ' AND created_at >= ?'; diagParams.push(start_date); }
    if (end_date) { diagWhere += ' AND created_at <= ?'; diagParams.push(end_date + ' 23:59:59'); }
    if (doctor_id) { diagWhere += ' AND doctor_id = ?'; diagParams.push(parseInt(doctor_id)); }
    if (clinic_id) { diagWhere += ' AND clinic_id = ?'; diagParams.push(parseInt(clinic_id)); }
    if (search) { diagWhere += ' AND diagnosis LIKE ?'; diagParams.push(`%${search}%`); }

    const [diagnoses] = await db.query(
      `SELECT
        diagnosis,
        COUNT(*) as frequency,
        COUNT(DISTINCT patient_id) as unique_patients
      FROM prescriptions
      ${diagWhere}
      GROUP BY diagnosis
      ORDER BY frequency DESC
      LIMIT ${safeLimit}`,
      diagParams
    );

    return {
      top_symptoms: symptoms,
      top_diagnoses: diagnoses
    };
  }

  static async getPrescriptionAnalytics(query) {
    const { doctor_id, clinic_id, start_date, end_date } = query;
    const db = getDb();

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (start_date) { whereClause += ' AND p.created_at >= ?'; params.push(start_date); }
    if (end_date) { whereClause += ' AND p.created_at <= ?'; params.push(end_date + ' 23:59:59'); }
    if (doctor_id) { whereClause += ' AND p.doctor_id = ?'; params.push(parseInt(doctor_id)); }
    if (clinic_id) { whereClause += ' AND p.clinic_id = ?'; params.push(parseInt(clinic_id)); }

    const [totalPrescriptions] = await db.execute(
      `SELECT COUNT(*) as total FROM prescriptions p ${whereClause}`, params
    );
    const [avgMeds] = await db.execute(
      `SELECT AVG(med_count) as avg_medications FROM (
        SELECT pi.prescription_id, COUNT(*) as med_count
        FROM prescription_items pi
        JOIN prescriptions p ON pi.prescription_id = p.id
        ${whereClause}
        GROUP BY pi.prescription_id
      ) as sub`,
      params
    );
    const [diagnoses] = await db.execute(
      `SELECT diagnosis, COUNT(*) as count
       FROM prescriptions p
       ${whereClause} AND diagnosis IS NOT NULL AND diagnosis != ''
       GROUP BY diagnosis ORDER BY count DESC LIMIT 10`,
      params
    );
    const [byPeriod] = await db.execute(
      `SELECT DATE(p.created_at) as date, COUNT(*) as prescription_count
       FROM prescriptions p ${whereClause}
       GROUP BY DATE(p.created_at)
       ORDER BY date DESC LIMIT 30`,
      params
    );

    return {
      total_prescriptions: totalPrescriptions[0]?.total || 0,
      avg_medications_per_prescription: Math.round(avgMeds[0]?.avg_medications || 0),
      top_diagnoses: diagnoses,
      prescriptions_by_date: byPeriod
    };
  }

  static async getPaymentAnalytics(query) {
    const { clinic_id, start_date, end_date, period = 'day' } = query;
    const db = getDb();

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (start_date) { whereClause += ' AND bill_date >= ?'; params.push(start_date); }
    if (end_date) { whereClause += ' AND bill_date <= ?'; params.push(end_date); }
    if (clinic_id) { whereClause += ' AND clinic_id = ?'; params.push(parseInt(clinic_id)); }

    const [revenue] = await db.execute(
      `SELECT
        COUNT(*) as total_bills,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'cancelled' THEN total_amount ELSE 0 END), 0) as cancelled_amount,
        COALESCE(AVG(total_amount), 0) as avg_bill_amount
      FROM bills ${whereClause}`,
      params
    );

    const [paymentMethods] = await db.execute(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
       FROM bills ${whereClause}
       GROUP BY payment_method ORDER BY total_amount DESC`,
      params
    );

    let groupBy;
    switch (period) {
      case 'week': groupBy = 'YEARWEEK(bill_date)'; break;
      case 'month': groupBy = 'DATE_FORMAT(bill_date, "%Y-%m")'; break;
      default: groupBy = 'DATE(bill_date)';
    }
    const [revenueByPeriod] = await db.execute(
      `SELECT ${groupBy} as period, COUNT(*) as bill_count,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_revenue
       FROM bills ${whereClause}
       GROUP BY ${groupBy} ORDER BY period ASC LIMIT 60`,
      params
    );

    const [topPatients] = await db.execute(
      `SELECT
        p.name as patient_name,
        p.patient_id,
        COUNT(b.id) as visit_count,
        COALESCE(SUM(b.total_amount), 0) as total_spent
      FROM bills b
      JOIN patients p ON b.patient_id = p.id
      ${whereClause}
      GROUP BY b.patient_id, p.name, p.patient_id
      ORDER BY total_spent DESC
      LIMIT 10`,
      params
    );

    return {
      total_bills: revenue[0]?.total_bills || 0,
      total_revenue: revenue[0]?.total_revenue || 0,
      paid_amount: revenue[0]?.paid_amount || 0,
      pending_amount: revenue[0]?.pending_amount || 0,
      cancelled_amount: revenue[0]?.cancelled_amount || 0,
      avg_bill_amount: Math.round(revenue[0]?.avg_bill_amount || 0),
      payment_methods: paymentMethods,
      daily_revenue: revenueByPeriod,
      revenue_by_period: revenueByPeriod,
      top_patients: topPatients
    };
  }

  static async getPatientDemographics(query) {
    const { clinic_id } = query;
    const db = getDb();

    let whereClause = 'WHERE deleted_at IS NULL';
    const params = [];
    if (clinic_id) { whereClause += ' AND clinic_id = ?'; params.push(parseInt(clinic_id)); }

    const [ageDistribution] = await db.execute(
      `SELECT
        CASE
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) < 18 THEN '0-17'
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 18 AND 30 THEN '18-30'
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 31 AND 45 THEN '31-45'
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 46 AND 60 THEN '46-60'
          ELSE '60+'
        END as age_group,
        COUNT(*) as patient_count
      FROM patients
      ${whereClause} AND dob IS NOT NULL
      GROUP BY age_group
      ORDER BY FIELD(age_group, '0-17','18-30','31-45','46-60','60+')`,
      params
    );

    const countParams = [...params];
    const [genderDistribution] = await db.execute(
      `SELECT
        gender,
        COUNT(*) as patient_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM patients ${whereClause}), 1) as percentage
      FROM patients ${whereClause}
      GROUP BY gender
      ORDER BY patient_count DESC`,
      [...params, ...countParams]
    );

    const [bloodGroups] = await db.execute(
      `SELECT blood_group, COUNT(*) as patient_count
       FROM patients ${whereClause} AND blood_group IS NOT NULL AND blood_group != 'Unknown'
       GROUP BY blood_group ORDER BY patient_count DESC`,
      params
    );

    const [patientSource] = await db.execute(
      `SELECT
        COALESCE(NULLIF(TRIM(referral_source), ''), 'Direct') as source,
        COUNT(*) as patient_count
       FROM patients ${whereClause}
       GROUP BY source
       ORDER BY patient_count DESC
       LIMIT 10`,
      params
    );

    const [locationDistribution] = await db.execute(
      `SELECT
        COALESCE(NULLIF(TRIM(city), ''), 'Unknown') as city,
        COUNT(*) as patient_count
       FROM patients ${whereClause}
       AND city IS NOT NULL AND city NOT IN ('Imported City', '')
       GROUP BY city
       ORDER BY patient_count DESC
       LIMIT 20`,
      params
    );

    return {
      age_distribution: ageDistribution,
      gender_distribution: genderDistribution,
      blood_group_distribution: bloodGroups,
      patient_source: patientSource,
      location_distribution: locationDistribution
    };
  }

  static async getDoctorPerformance(query) {
    const { doctor_id, start_date, end_date } = query;
    const db = getDb();

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (start_date) { whereClause += ' AND a.appointment_date >= ?'; params.push(start_date); }
    if (end_date) { whereClause += ' AND a.appointment_date <= ?'; params.push(end_date); }
    if (doctor_id) { whereClause += ' AND a.doctor_id = ?'; params.push(parseInt(doctor_id)); }

    const [performance] = await db.execute(
      `SELECT
        u.name as doctor_name,
        a.doctor_id,
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        ROUND(AVG(CASE WHEN a.visit_started_at IS NOT NULL AND a.visit_ended_at IS NOT NULL
          AND a.visit_ended_at > a.visit_started_at
          THEN TIMESTAMPDIFF(MINUTE, a.visit_started_at, a.visit_ended_at) END), 1) as avg_consultation_time,
        ROUND(AVG(CASE WHEN a.checked_in_at IS NOT NULL AND a.visit_started_at IS NOT NULL
          AND a.visit_started_at > a.checked_in_at
          THEN TIMESTAMPDIFF(MINUTE, a.checked_in_at, a.visit_started_at) END), 1) as avg_waiting_time
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      ${whereClause}
      GROUP BY a.doctor_id, u.name
      ORDER BY total_appointments DESC`,
      params
    );

    return { data: performance };
  }

  static async searchPatients(query) {
    const { q = '', limit = 20 } = query;
    const db = getDb();
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const [rows] = await db.execute(
      `SELECT id, patient_id, name, phone, gender, age_years, city
       FROM patients
       WHERE deleted_at IS NULL
       AND (name LIKE ? OR patient_id LIKE ? OR phone LIKE ?)
       ORDER BY name ASC
       LIMIT ${safeLimit}`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    return { patients: rows };
  }

  static async getDoctorsList(query) {
    const { clinic_id } = query;
    const db = getDb();
    let where = 'WHERE u.role = "doctor" AND u.is_active = 1 AND u.deleted_at IS NULL';
    const params = [];
    if (clinic_id) { where += ' AND u.clinic_id = ?'; params.push(parseInt(clinic_id)); }
    const [rows] = await db.execute(
      `SELECT u.id, u.name, d.specialization FROM users u
       LEFT JOIN doctors d ON d.user_id = u.id
       ${where}
       ORDER BY u.name ASC`,
      params
    );
    return { doctors: rows };
  }
}

module.exports = EnhancedAnalyticsService;
