const { getDb } = require('../config/db');
const { sendSuccess, sendError, sendCreated, sendValidationError } = require('../utils/responseHelper');

exports.listByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const active = req.query.active === '0' ? 0 : 1;
    const db = getDb();
    const [rows] = await db.execute(
      `SELECT id, category, allergen_name, snomed_id, reaction, severity, is_active, created_at
       FROM patient_allergies
       WHERE patient_id = ? AND (is_active = ? OR ? = 0)
       ORDER BY created_at DESC`,
      [patientId, active, active]
    );
    sendSuccess(res, { items: rows }, 'Allergies retrieved successfully');
  } catch (e) {
    console.error('List allergies error:', e);
    sendError(res, 'Failed to list allergies', 500, e.message);
  }
};

exports.create = async (req, res) => {
  try {
    const { patient_id, category, allergen_name, snomed_concept_id, reaction, severity, notes, is_active } = req.body;
    if (!patient_id || !category || !allergen_name) {
      return sendValidationError(res, 'patient_id, category, allergen_name required');
    }
    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO patient_allergies (patient_id, category, allergen_name, snomed_concept_id, reaction, severity, notes, is_active, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 1), NOW())`,
      [patient_id, category, allergen_name, snomed_concept_id || null, reaction || null, severity || null, notes || null, is_active]
    );
    sendCreated(res, { id: result.insertId }, 'Allergy created successfully');
  } catch (e) {
    sendError(res, 'Failed to create allergy', 500, e.message);
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, allergen_name, snomed_concept_id, reaction, severity, notes, is_active } = req.body || {};
    const db = getDb();
    const [result] = await db.execute(
      `UPDATE patient_allergies
       SET category = COALESCE(?, category),
           allergen_name = COALESCE(?, allergen_name),
           snomed_concept_id = COALESCE(?, snomed_concept_id),
           reaction = COALESCE(?, reaction),
           severity = COALESCE(?, severity),
           notes = COALESCE(?, notes),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [category || null, allergen_name || null, snomed_concept_id || null, reaction || null, severity || null, notes || null, is_active, id]
    );
    sendSuccess(res, { affectedRows: result.affectedRows }, 'Allergy updated successfully');
  } catch (e) {
    sendError(res, 'Failed to update allergy', 500, e.message);
  }
};
