const { query } = require('../config/db');
const { ApiError } = require('../utils');

class ClinicalService {
  static async getClinicalData() {
    const clinicalRecords = await query(`
      SELECT
        mr.id,
        mr.patient_id,
        mr.doctor_id,
        mr.record_title as chief_complaint,
        mr.description as diagnosis,
        mr.created_at,
        p.name as patient_name,
        p.phone as patient_phone,
        u.name as doctor_name
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY mr.created_at DESC
      LIMIT 50
    `);

    const statsRows = await query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT patient_id) as unique_patients,
        COUNT(DISTINCT doctor_id) as active_doctors
      FROM medical_records
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    return {
      clinicalRecords,
      stats: statsRows[0] || {
        total_records: 0,
        unique_patients: 0,
        active_doctors: 0
      }
    };
  }

  static async getClinicalRecordById({ id }) {
    if (!id) {
      throw ApiError.badRequest('Clinical record id is required');
    }

    const records = await query(
      `
      SELECT
        mr.record_title as chief_complaint,
        mr.description as diagnosis,
        mr.created_at,
        p.name as patient_name,
        p.phone as patient_phone,
        p.age,
        p.gender,
        u.name as doctor_name
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE mr.id = ?
    `,
      [id]
    );

    if (records.length === 0) {
      throw ApiError.notFound('Clinical record');
    }

    return { record: records[0] };
  }
}

module.exports = ClinicalService;
