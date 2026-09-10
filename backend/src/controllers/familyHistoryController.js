const { getDb } = require('../config/db');

async function getFamilyHistory(req, res) {
  try {
    const { patientId } = req.params;
    const db = getDb();

    const [history] = await db.execute(
      'SELECT * FROM family_history WHERE patient_id = ? ORDER BY created_at DESC',
      [patientId]
    );

    res.json({ history });
  } catch (error) {
    console.error('Get family history error:', error);
    res.status(500).json({ error: 'Failed to fetch family history' });
  }
}

async function addFamilyHistory(req, res) {
  try {
    const { patientId } = req.params;
    const { relation, condition, notes } = req.body;

    if (!relation || !condition) {
      return res.status(400).json({ error: 'Relation and condition are required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO family_history (patient_id, relation, condition, notes)
       VALUES (?, ?, ?, ?)`,
      [patientId, relation, condition, notes || null]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Family history added successfully'
    });
  } catch (error) {
    console.error('Add family history error:', error);
    res.status(500).json({ error: 'Failed to add family history' });
  }
}

async function updateFamilyHistory(req, res) {
  try {
    const { id } = req.params;
    const { relation, condition, notes } = req.body;

    const db = getDb();
    const updateFields = [];
    const params = [];

    if (relation) { updateFields.push('relation = ?'); params.push(relation); }
    if (condition) { updateFields.push('condition = ?'); params.push(condition); }
    if (notes !== undefined) { updateFields.push('notes = ?'); params.push(notes); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.execute(
      `UPDATE family_history SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Family history updated successfully' });
  } catch (error) {
    console.error('Update family history error:', error);
    res.status(500).json({ error: 'Failed to update family history' });
  }
}

async function deleteFamilyHistory(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute('DELETE FROM family_history WHERE id = ?', [id]);

    res.json({ message: 'Family history deleted successfully' });
  } catch (error) {
    console.error('Delete family history error:', error);
    res.status(500).json({ error: 'Failed to delete family history' });
  }
}

module.exports = require('./familyHistoryController_refactored');

