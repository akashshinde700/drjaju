const { getDb } = require('../config/db');

const VitalsService = {
  async exists({ patientId, appointmentId }) {
    const db = getDb();
    const [rows] = await db.execute(
      `SELECT 1 FROM patient_vitals
       WHERE patient_id = ?
         AND (appointment_id = ? OR DATE(recorded_at) = CURDATE())
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [patientId, appointmentId || null]
    );

    return { exists: rows.length > 0 };
  },
};

module.exports = VitalsService;
