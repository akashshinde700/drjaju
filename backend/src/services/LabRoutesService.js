const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class LabRoutesService {
  static async addLabResultForPatient({ patientId, user, body }) {
    const { test_name, result_value, result_unit, reference_range, result_date, notes, status, test_category, report_group } = body;

    if (!test_name) {
      throw ApiError.badRequest('test_name is required');
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO lab_investigations (patient_id, clinic_id, doctor_id, test_name, result_value, result_date, result_unit, reference_range, notes, status, test_category, report_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        user?.clinic_id || null,
        user?.id || null,
        test_name,
        result_value || null,
        result_date || new Date(),
        result_unit || null,
        reference_range || null,
        notes || null,
        status || 'completed',
        test_category || null,
        report_group || null
      ]
    );

    return { id: result.insertId, message: 'Lab result added' };
  }

  static async listLabsForPatient({ patientId }) {
    const db = getDb();
    const [labs] = await db.execute(
      `SELECT id, test_name as name, result_value as reading, result_date as date, result_unit as unit, report_group, reference_range, test_category, notes
       FROM lab_investigations WHERE patient_id = ? ORDER BY result_date DESC, report_group, id`,
      [patientId]
    );

    return { labs };
  }
}

module.exports = LabRoutesService;
