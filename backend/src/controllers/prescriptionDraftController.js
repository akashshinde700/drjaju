const { query } = require('../config/db');

/**
 * Auto-save prescription draft
 * Saves prescription data periodically without finalizing it
 */
exports.saveDraft = async (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      chief_complaint,
      diagnosis,
      medications,
      investigations,
      advice,
      follow_up_date,
      notes
    } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const userId = req.user?.id;
    const finalDoctorId = doctor_id || req.user?.doctor_id;

    // Check if draft exists for this patient and doctor
    const checkSql = `
      SELECT id FROM prescription_drafts
      WHERE patient_id = ?
      AND doctor_id = ?
      AND created_by = ?
    `;

    const existing = await query(checkSql, [patient_id, finalDoctorId, userId]);

    if (existing.length > 0) {
      // Update existing draft
      const draftId = existing[0].id;
      const updateSql = `
        UPDATE prescription_drafts
        SET
          chief_complaint = ?,
          diagnosis = ?,
          medications = ?,
          investigations = ?,
          advice = ?,
          follow_up_date = ?,
          notes = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      await query(updateSql, [
        chief_complaint || null,
        diagnosis || null,
        JSON.stringify(medications || []),
        JSON.stringify(investigations || []),
        advice || null,
        follow_up_date || null,
        notes || null,
        draftId
      ]);

      return res.json({
        success: true,
        draft_id: draftId,
        message: 'Draft updated successfully'
      });
    } else {
      // Create new draft
      const insertSql = `
        INSERT INTO prescription_drafts (
          patient_id,
          doctor_id,
          chief_complaint,
          diagnosis,
          medications,
          investigations,
          advice,
          follow_up_date,
          notes,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const result = await query(insertSql, [
        patient_id,
        finalDoctorId,
        chief_complaint || null,
        diagnosis || null,
        JSON.stringify(medications || []),
        JSON.stringify(investigations || []),
        advice || null,
        follow_up_date || null,
        notes || null,
        userId
      ]);

      return res.json({
        success: true,
        draft_id: result.insertId,
        message: 'Draft saved successfully'
      });
    }
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Failed to save draft', details: error.message });
  }
};

/**
 * Get prescription draft
 */
exports.getDraft = async (req, res) => {
  try {
    const { patient_id, doctor_id } = req.query;
    const userId = req.user?.id;
    const finalDoctorId = doctor_id || req.user?.doctor_id;

    if (!patient_id) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const sql = `
      SELECT
        id,
        patient_id,
        doctor_id,
        chief_complaint,
        diagnosis,
        medications,
        investigations,
        advice,
        follow_up_date,
        notes,
        created_at,
        updated_at
      FROM prescription_drafts
      WHERE patient_id = ?
      AND doctor_id = ?
      AND created_by = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const results = await query(sql, [patient_id, finalDoctorId, userId]);

    if (results.length === 0) {
      return res.json({ draft: null });
    }

    const draft = results[0];

    // Parse JSON fields
    draft.medications = JSON.parse(draft.medications || '[]');
    draft.investigations = JSON.parse(draft.investigations || '[]');

    res.json({ draft });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ error: 'Failed to get draft', details: error.message });
  }
};

/**
 * Delete prescription draft
 */
exports.deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const deleteSql = `
      DELETE FROM prescription_drafts
      WHERE id = ?
      AND created_by = ?
    `;

    await query(deleteSql, [id, userId]);

    res.json({ success: true, message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Failed to delete draft', details: error.message });
  }
};

/**
 * List all drafts for current user
 */
exports.listDrafts = async (req, res) => {
  try {
    const userId = req.user?.id;
    const doctorId = req.user?.doctor_id;

    const sql = `
      SELECT
        pd.id,
        pd.patient_id,
        pd.created_at,
        pd.updated_at,
        p.name as patient_name,
        p.age_years as age,
        p.gender,
        p.phone
      FROM prescription_drafts pd
      INNER JOIN patients p ON pd.patient_id = p.id
      WHERE pd.created_by = ?
      AND pd.doctor_id = ?
      ORDER BY pd.updated_at DESC
      LIMIT 20
    `;

    const drafts = await query(sql, [userId, doctorId]);

    res.json({ drafts });
  } catch (error) {
    // prescription_drafts isn't provisioned in this DB and no frontend page
    // calls this route yet — degrade to an empty list instead of a 500.
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ drafts: [] });
    }
    console.error('List drafts error:', error);
    res.status(500).json({ error: 'Failed to list drafts', details: error.message });
  }
};
