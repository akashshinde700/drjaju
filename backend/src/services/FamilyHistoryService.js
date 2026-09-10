const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class FamilyHistoryService {
  static async getFamilyHistory(patientId) {
    const db = getDb();
    const [history] = await db.execute(
      'SELECT * FROM family_history WHERE patient_id = ? ORDER BY created_at DESC',
      [patientId]
    );

    return { history };
  }

  static async addFamilyHistory({ patientId, body }) {
    const { relation, condition, condition_name, notes } = body;
    const conditionValue = condition || condition_name;

    if (!relation || !conditionValue) {
      throw ApiError.badRequest('Relation and condition are required');
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO family_history (patient_id, relation, condition_name, notes)
       VALUES (?, ?, ?, ?)`,
      [patientId, relation, conditionValue, notes || null]
    );

    return { id: result.insertId };
  }

  static async updateFamilyHistory({ id, body }) {
    const { relation, condition, condition_name, notes } = body;
    const conditionValue = condition || condition_name;

    const updateFields = [];
    const params = [];

    if (relation) {
      updateFields.push('relation = ?');
      params.push(relation);
    }
    if (conditionValue) {
      updateFields.push('condition_name = ?');
      params.push(conditionValue);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    params.push(id);

    const db = getDb();
    await db.execute(`UPDATE family_history SET ${updateFields.join(', ')} WHERE id = ?`, params);

    return { updated: true };
  }

  static async deleteFamilyHistory(id) {
    const db = getDb();
    await db.execute('DELETE FROM family_history WHERE id = ?', [id]);
    return { deleted: true };
  }
}

module.exports = FamilyHistoryService;
