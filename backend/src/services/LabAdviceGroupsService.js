const { getDb } = require('../config/db');

class LabAdviceGroupsService {
  static async _ensureTable(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS lab_advice_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_name VARCHAR(255) NOT NULL,
        tests TEXT NOT NULL,
        doctor_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  static async listGroups({ doctorId } = {}) {
    const db = getDb();
    try { await LabAdviceGroupsService._ensureTable(db); } catch (_) { /* ignore */ }

    const params = [];
    let where = 'WHERE 1=1';
    if (doctorId) {
      where += ' AND (doctor_id = ? OR doctor_id IS NULL)';
      params.push(doctorId);
    }

    const [rows] = await db.execute(
      `SELECT id, group_name, tests FROM lab_advice_groups ${where} ORDER BY group_name`,
      params
    );

    return rows.map(r => ({
      ...r,
      tests: typeof r.tests === 'string' ? JSON.parse(r.tests) : (r.tests || [])
    }));
  }

  static async addGroup({ group_name, tests, doctorId }) {
    const db = getDb();
    try { await LabAdviceGroupsService._ensureTable(db); } catch (_) { /* ignore */ }

    const [result] = await db.execute(
      'INSERT INTO lab_advice_groups (group_name, tests, doctor_id) VALUES (?, ?, ?)',
      [group_name, JSON.stringify(tests || []), doctorId || null]
    );

    return { id: result.insertId };
  }

  static async updateGroup({ id, group_name, tests }) {
    const db = getDb();
    await db.execute(
      'UPDATE lab_advice_groups SET group_name = ?, tests = ? WHERE id = ?',
      [group_name, JSON.stringify(tests || []), id]
    );
    return { ok: true };
  }

  static async deleteGroup({ id }) {
    const db = getDb();
    await db.execute('DELETE FROM lab_advice_groups WHERE id = ?', [id]);
    return { ok: true };
  }
}

module.exports = LabAdviceGroupsService;

