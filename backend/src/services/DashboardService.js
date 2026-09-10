const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { getLocalDateString } = require('../utils/localDate');

class DashboardService {
  static async getDashboardMetrics({ dateRange = 'week', doctorId }) {
    const db = getDb();

    const now = new Date();
    let fromDate = new Date();

    if (dateRange === 'day') {
      fromDate.setDate(now.getDate() - 1);
    } else if (dateRange === 'week') {
      fromDate.setDate(now.getDate() - 7);
    } else if (dateRange === 'month') {
      fromDate.setMonth(now.getMonth() - 1);
    }

    const fromDateStr = getLocalDateString(fromDate);

    const [prescriptions] = await db.execute(
      'SELECT * FROM prescriptions WHERE doctor_id = ? AND created_at >= ?',
      [doctorId, fromDateStr]
    );

    const [patientStats] = await db.execute(
      'SELECT COUNT(DISTINCT patient_id) as count FROM prescriptions WHERE doctor_id = ? AND created_at >= ?',
      [doctorId, fromDateStr]
    );

    // Was clinic-wide (missing doctor_id filter) — a per-doctor dashboard was
    // showing every doctor's revenue under this doctor's numbers.
    const [revenueStats] = await db.execute(
      'SELECT COALESCE(SUM(total_amount), 0) as revenue FROM bills WHERE doctor_id = ? AND created_at >= ? AND payment_status != ?',
      [doctorId, fromDateStr, 'cancelled']
    );

    const totalPatients = patientStats[0]?.count || 0;
    const totalRevenue = revenueStats[0]?.revenue || 0;

    const today = getLocalDateString();
    const [todayPrescs] = await db.execute(
      'SELECT * FROM prescriptions WHERE doctor_id = ? AND DATE(created_at) = ?',
      [doctorId, today]
    );

    const [todayRevenue] = await db.execute(
      'SELECT COALESCE(SUM(total_amount), 0) as revenue FROM bills WHERE doctor_id = ? AND DATE(created_at) = ? AND payment_status != ?',
      [doctorId, today, 'cancelled']
    );

    // Real per-day revenue for this doctor, for the chart (was hardcoded to 0
    // for every day).
    const [dailyRevenueRows] = await db.execute(
      `SELECT DATE(created_at) as day, COALESCE(SUM(total_amount), 0) as revenue
       FROM bills
       WHERE doctor_id = ? AND created_at >= ? AND payment_status != ?
       GROUP BY DATE(created_at)`,
      [doctorId, fromDateStr, 'cancelled']
    );
    const revenueByDay = new Map(dailyRevenueRows.map(r => [
      getLocalDateString(new Date(r.day)),
      Number(r.revenue),
    ]));

    // Average actual consultation duration from queue check-in/completion
    // timestamps (was hardcoded to a flat 15 regardless of real data).
    const [consultTimeRows] = await db.execute(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, check_in_time, completed_at)) as avg_minutes
       FROM queue
       WHERE doctor_id = ? AND status = 'completed'
         AND completed_at IS NOT NULL AND check_in_time >= ?`,
      [doctorId, fromDateStr]
    );
    const avgConsultationTime = Math.round(Number(consultTimeRows[0]?.avg_minutes) || 0);

    const chartData = DashboardService.generateChartData(prescriptions, 7, revenueByDay);
    const topDiagnoses = DashboardService.getTopDiagnoses(prescriptions, 5);
    const weeklyTrend = DashboardService.generateWeeklyTrend(prescriptions);
    const todayPatientIds = new Set(todayPrescs.map(p => p.patient_id));

    return {
      totalPatients,
      todayPatients: todayPatientIds.size,
      totalRevenue,
      todayRevenue: todayRevenue[0]?.revenue || 0,
      avgConsultationTime,
      prescriptionsFilled: prescriptions.length,
      chartData,
      topDiagnoses,
      weeklyTrend,
      performanceMetrics: {
        efficiency: DashboardService.calculateEfficiency(prescriptions),
        // No feedback/rating table exists yet — report null rather than a fake
        // static 4.8 that never reflects real patient satisfaction.
        satisfaction: null,
        templateUsage: DashboardService.calculateTemplateUsage(prescriptions)
      }
    };
  }

  static async getPatientDetails({ patientId }) {
    const db = getDb();

    const rawId = String(patientId || '').trim();
    const normalizedId = rawId.split(':')[0].split('/')[0].trim();

    if (!normalizedId) {
      throw ApiError.badRequest('Invalid patient ID');
    }

    let patient;

    if (/^\d+$/.test(normalizedId)) {
      [patient] = await db.execute(
        'SELECT * FROM patients WHERE id = ? LIMIT 1',
        [parseInt(normalizedId, 10)]
      );
    }

    if (!patient || !patient.length) {
      [patient] = await db.execute(
        'SELECT * FROM patients WHERE patient_id = ? OR patient_id = ? LIMIT 1',
        [rawId, normalizedId]
      );
    }

    if (!patient || !patient.length) {
      throw ApiError.notFound('Patient');
    }

    const p = patient[0];

    const [prescsStats] = await db.execute(
      'SELECT COUNT(*) as count, MAX(created_at) as lastVisit FROM prescriptions WHERE patient_id = ?',
      [patientId]
    );

    const [nextFollowUp] = await db.execute(
      'SELECT follow_up_date as nextDate FROM prescriptions WHERE patient_id = ? AND follow_up_date >= CURDATE() ORDER BY follow_up_date ASC LIMIT 1',
      [patientId]
    );

    return {
      ...p,
      prescriptionCount: prescsStats[0]?.count || 0,
      lastVisit: prescsStats[0]?.lastVisit || null,
      complianceScore: 75,
      nextFollowUp: nextFollowUp[0]?.nextDate || null
    };
  }

  static async getPatientPrescriptions({ patientId }) {
    const db = getDb();

    const [prescriptions] = await db.execute(
      `SELECT p.*, u.name as doctorName
       FROM prescriptions p
       LEFT JOIN users u ON p.doctor_id = u.id
       WHERE p.patient_id = ?
       ORDER BY p.created_at DESC`,
      [patientId]
    );

    return prescriptions.map(p => ({
      ...p,
      diagnoses: p.diagnosis ? p.diagnosis.split(',').map(d => d.trim()) : [],
      medications: []
    }));
  }

  static async savePrescription({ body, doctorId }) {
    const db = getDb();
    const {
      patientId,
      diagnoses = [],
      advice,
      investigations = [],
      followupDays
    } = body;

    const diagnosisText = Array.isArray(diagnoses) ? diagnoses.join(', ') : (diagnoses || '');
    const investigationsText = Array.isArray(investigations) ? investigations.join(', ') : (investigations || '');

    const [result] = await db.execute(
      `INSERT INTO prescriptions (patient_id, doctor_id, diagnosis, advice, investigations_advised, follow_up_days, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', NOW())`,
      [patientId, doctorId, diagnosisText, advice || null, investigationsText || null, followupDays || null]
    );

    return { prescriptionId: result.insertId };
  }

  static async updatePrescription({ prescriptionId, status }) {
    const db = getDb();

    if (!status) {
      throw ApiError.badRequest('No updates provided');
    }

    await db.execute(
      'UPDATE prescriptions SET status = ? WHERE id = ?',
      [status, prescriptionId]
    );

    return { updated: true };
  }

  // Helper functions
  static generateChartData(prescriptions, days, revenueByDay = new Map()) {
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);

      const dayPrescs = prescriptions.filter(p =>
        p.created_at && getLocalDateString(new Date(p.created_at)) === dateStr
      );

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenueByDay.get(dateStr) || 0,
        count: dayPrescs.length
      });
    }

    return data;
  }

  static getTopDiagnoses(prescriptions, limit) {
    const diagMap = {};

    prescriptions.forEach(p => {
      if (p.diagnosis) {
        const diags = p.diagnosis.split(',').map(d => d.trim()).filter(Boolean);
        diags.forEach(d => {
          diagMap[d] = (diagMap[d] || 0) + 1;
        });
      }
    });

    return Object.entries(diagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({
        name,
        count,
        percentage: prescriptions.length > 0 ? Math.round((count / prescriptions.length) * 100) : 0
      }));
  }

  static generateWeeklyTrend(prescriptions) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trends = {};

    days.forEach(day => {
      trends[day] = 0;
    });

    prescriptions.forEach(p => {
      if (p.created_at) {
        const dayIndex = new Date(p.created_at).getDay();
        trends[days[dayIndex]]++;
      }
    });

    return Object.entries(trends).map(([day, patients]) => ({
      day,
      patients
    }));
  }

  static calculateEfficiency(prescriptions) {
    if (prescriptions.length < 2) return 100;
    return Math.min(100, Math.round((prescriptions.length / 10) * 100));
  }

  static calculateTemplateUsage(prescriptions) {
    if (prescriptions.length === 0) return 0;
    const templatePrescs = prescriptions.filter(p => p.template_id != null).length;
    return Math.round((templatePrescs / prescriptions.length) * 100);
  }
}

module.exports = DashboardService;
