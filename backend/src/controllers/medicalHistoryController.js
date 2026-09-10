/**
 * Medical History Controller
 * Manages configurable patient medical history for prescription pad
 */

const { getDb } = require('../config/db');
const { resolveClinicIdForPatient } = require('../utils/helpers');

/**
 * Get all medical history options (master list)
 * GET /api/medical-history/options
 */
async function getMedicalHistoryOptions(req, res) {
  try {
    const db = getDb();
    const doctorId = req.user?.id;

    // Get all active options with doctor's custom visibility settings
    const [options] = await db.execute(`
      SELECT
        mho.id,
        mho.condition_name,
        mho.condition_code,
        mho.category,
        COALESCE(dmhc.display_order, mho.display_order) as display_order,
        COALESCE(dmhc.is_visible, mho.is_default) as is_visible
      FROM medical_history_options mho
      LEFT JOIN doctor_medical_history_config dmhc
        ON mho.id = dmhc.option_id AND dmhc.doctor_id = ?
      WHERE mho.is_active = 1
      ORDER BY display_order ASC, mho.condition_name ASC
    `, [doctorId]);

    res.json({
      success: true,
      options
    });

  } catch (error) {
    console.error('Get medical history options error:', error);
    res.status(500).json({ error: 'Failed to fetch options', details: error.message });
  }
}

/**
 * Save doctor's configuration for medical history options
 * POST /api/medical-history/configure
 */
async function saveDoctorConfiguration(req, res) {
  try {
    const doctorId = req.user?.id;
    const { configurations } = req.body;

    if (!configurations || !Array.isArray(configurations)) {
      return res.status(400).json({ error: 'configurations array is required' });
    }

    const db = getDb();

    // Delete existing configurations
    await db.execute(
      `DELETE FROM doctor_medical_history_config WHERE doctor_id = ?`,
      [doctorId]
    );

    // Insert new configurations
    for (const config of configurations) {
      await db.execute(`
        INSERT INTO doctor_medical_history_config (doctor_id, option_id, is_visible, display_order)
        VALUES (?, ?, ?, ?)
      `, [doctorId, config.option_id, config.is_visible !== false, config.display_order || 0]);
    }

    res.json({
      success: true,
      message: 'Configuration saved successfully'
    });

  } catch (error) {
    console.error('Save configuration error:', error);
    res.status(500).json({ error: 'Failed to save configuration', details: error.message });
  }
}

/**
 * Add new custom medical history option
 * POST /api/medical-history/options
 */
async function addCustomOption(req, res) {
  try {
    const { condition_name, condition_code, category } = req.body;

    if (!condition_name) {
      return res.status(400).json({ error: 'condition_name is required' });
    }

    const db = getDb();

    const [result] = await db.execute(`
      INSERT INTO medical_history_options (condition_name, condition_code, category, is_default)
      VALUES (?, ?, ?, FALSE)
    `, [condition_name, condition_code || null, category || 'chronic']);

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Option added successfully'
    });

  } catch (error) {
    console.error('Add option error:', error);
    res.status(500).json({ error: 'Failed to add option', details: error.message });
  }
}

/**
 * Get patient's medical history for prescription pad
 * GET /api/medical-history/patient/:patientId
 */
async function getPatientMedicalHistory(req, res) {
  try {
    const { patientId } = req.params;
    const doctorId = req.user?.id;
    const db = getDb();

    // Get configured options with patient's values
    const [medicalHistory] = await db.execute(`
      SELECT
        mho.id as option_id,
        mho.condition_name,
        mho.condition_code,
        mho.category,
        COALESCE(dmhc.display_order, mho.display_order) as display_order,
        COALESCE(dmhc.is_visible, mho.is_default) as is_visible,
        pmh.id as patient_history_id,
        COALESCE(pmh.has_condition, FALSE) as has_condition,
        pmh.since_date,
        pmh.notes
      FROM medical_history_options mho
      LEFT JOIN doctor_medical_history_config dmhc
        ON mho.id = dmhc.option_id AND dmhc.doctor_id = ?
      LEFT JOIN patient_medical_history pmh
        ON mho.id = pmh.option_id AND pmh.patient_id = ?
      WHERE mho.is_active = 1
        AND COALESCE(dmhc.is_visible, mho.is_default) = TRUE
      ORDER BY display_order ASC, mho.condition_name ASC
    `, [doctorId, patientId]);

    // Get existing conditions (chronic conditions that are marked as active)
    const [existingConditions] = await db.execute(`
      SELECT id, condition_name, icd_code, status, start_date, notes
      FROM patient_chronic_conditions
      WHERE patient_id = ? AND status = 'Active'
      ORDER BY created_at DESC
    `, [patientId]);

    // Get past surgical procedures
    const [surgicalHistory] = await db.execute(`
      SELECT id, surgery_name, surgery_date, hospital, surgeon, complications
      FROM patient_surgical_history
      WHERE patient_id = ?
      ORDER BY surgery_date DESC
    `, [patientId]);

    // Get allergies
    const [allergies] = await db.execute(`
      SELECT id, category, allergen_name, severity, reaction
      FROM patient_allergies
      WHERE patient_id = ? AND is_active = 1
      ORDER BY severity DESC
    `, [patientId]);

    // Get family history
    const [familyHistory] = await db.execute(`
      SELECT id, relation, condition_name, icd_code, notes
      FROM family_history
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `, [patientId]);

    res.json({
      success: true,
      data: {
        medicalHistory,
        existingConditions,
        surgicalHistory,
        allergies,
        familyHistory
      }
    });

  } catch (error) {
    console.error('Get patient medical history error:', error);
    res.status(500).json({ error: 'Failed to fetch patient history', details: error.message });
  }
}

/**
 * Save patient's medical history selections
 * POST /api/medical-history/patient/:patientId
 */
async function savePatientMedicalHistory(req, res) {
  try {
    const { patientId } = req.params;
    const { selections } = req.body;
    const userId = req.user?.id;

    if (!selections || !Array.isArray(selections)) {
      return res.status(400).json({ error: 'selections array is required' });
    }

    const db = getDb();

    for (const selection of selections) {
      // Check if entry exists
      const [existing] = await db.execute(
        `SELECT id FROM patient_medical_history WHERE patient_id = ? AND option_id = ?`,
        [patientId, selection.option_id]
      );

      if (existing.length > 0) {
        // Update existing
        await db.execute(`
          UPDATE patient_medical_history
          SET has_condition = ?, since_date = ?, notes = ?, updated_at = NOW()
          WHERE id = ?
        `, [
          selection.has_condition || false,
          selection.since_date || null,
          selection.notes || null,
          existing[0].id
        ]);
      } else {
        // Insert new
        await db.execute(`
          INSERT INTO patient_medical_history
            (patient_id, option_id, condition_name, has_condition, since_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          patientId,
          selection.option_id,
          selection.condition_name,
          selection.has_condition || false,
          selection.since_date || null,
          selection.notes || null,
          userId
        ]);
      }
    }

    res.json({
      success: true,
      message: 'Patient medical history saved successfully'
    });

  } catch (error) {
    console.error('Save patient medical history error:', error);
    res.status(500).json({ error: 'Failed to save patient history', details: error.message });
  }
}

/**
 * Toggle single condition for patient
 * PUT /api/medical-history/patient/:patientId/toggle
 */
async function togglePatientCondition(req, res) {
  try {
    const { patientId } = req.params;
    const { option_id, has_condition, since_date, condition_name } = req.body;
    const userId = req.user?.id;

    if (!option_id) {
      return res.status(400).json({ error: 'option_id is required' });
    }

    const db = getDb();

    // Check if entry exists
    const [existing] = await db.execute(
      `SELECT id FROM patient_medical_history WHERE patient_id = ? AND option_id = ?`,
      [patientId, option_id]
    );

    if (existing.length > 0) {
      await db.execute(`
        UPDATE patient_medical_history
        SET has_condition = ?, since_date = ?, updated_at = NOW()
        WHERE id = ?
      `, [has_condition, since_date || null, existing[0].id]);
    } else {
      await db.execute(`
        INSERT INTO patient_medical_history
          (patient_id, option_id, condition_name, has_condition, since_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [patientId, option_id, condition_name, has_condition, since_date || null, userId]);
    }

    res.json({
      success: true,
      message: 'Condition updated successfully'
    });

  } catch (error) {
    console.error('Toggle condition error:', error);
    res.status(500).json({ error: 'Failed to update condition', details: error.message });
  }
}

/**
 * Add existing condition (different from predefined options)
 * POST /api/medical-history/patient/:patientId/existing-condition
 */
async function addExistingCondition(req, res) {
  try {
    const { patientId } = req.params;
    const { condition_name, icd_code, start_date, notes } = req.body;

    if (!condition_name) {
      return res.status(400).json({ error: 'condition_name is required' });
    }

    const db = getDb();

    const clinicId = await resolveClinicIdForPatient(db, patientId, req.user?.clinic_id);
    if (!clinicId) {
      return res.status(400).json({
        error: 'Cannot add condition: clinic is not set for this patient. Link the patient to a clinic or assign clinic to your account.',
      });
    }

    // Validate icd_code FK — only save if it exists in icd_codes table
    let safeIcdCode = null;
    if (icd_code) {
      const [icdRows] = await db.execute('SELECT icd_code FROM icd_codes WHERE icd_code = ? LIMIT 1', [icd_code]);
      if (icdRows.length > 0) safeIcdCode = icd_code;
    }

    const [result] = await db.execute(`
      INSERT INTO patient_chronic_conditions
        (patient_id, clinic_id, condition_name, icd_code, start_date, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `, [patientId, clinicId, condition_name, safeIcdCode, start_date || null, notes || null]);

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Condition added successfully'
    });

  } catch (error) {
    console.error('Add existing condition error:', error);
    res.status(500).json({ error: 'Failed to add condition', details: error.message });
  }
}

/**
 * Add surgical procedure
 * POST /api/medical-history/patient/:patientId/surgical-procedure
 */
async function addSurgicalProcedure(req, res) {
  try {
    const { patientId } = req.params;
    const { surgery_name, surgery_date, hospital, surgeon, complications } = req.body;

    if (!surgery_name) {
      return res.status(400).json({ error: 'surgery_name is required' });
    }

    const db = getDb();

    const [result] = await db.execute(`
      INSERT INTO patient_surgical_history
        (patient_id, surgery_name, surgery_date, hospital, surgeon, complications)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [patientId, surgery_name, surgery_date || null, hospital || null, surgeon || null, complications || null]);

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Surgical procedure added successfully'
    });

  } catch (error) {
    console.error('Add surgical procedure error:', error);
    res.status(500).json({ error: 'Failed to add procedure', details: error.message });
  }
}

/**
 * Delete existing condition
 * DELETE /api/medical-history/patient/:patientId/existing-condition/:conditionId
 */
async function deleteExistingCondition(req, res) {
  try {
    const { patientId, conditionId } = req.params;
    const db = getDb();

    await db.execute(
      `DELETE FROM patient_chronic_conditions WHERE id = ? AND patient_id = ?`,
      [conditionId, patientId]
    );

    res.json({ success: true, message: 'Condition deleted successfully' });

  } catch (error) {
    console.error('Delete condition error:', error);
    res.status(500).json({ error: 'Failed to delete condition', details: error.message });
  }
}

/**
 * Delete surgical procedure
 * DELETE /api/medical-history/patient/:patientId/surgical-procedure/:procedureId
 */
async function deleteSurgicalProcedure(req, res) {
  try {
    const { patientId, procedureId } = req.params;
    const db = getDb();

    await db.execute(
      `DELETE FROM patient_surgical_history WHERE id = ? AND patient_id = ?`,
      [procedureId, patientId]
    );

    res.json({ success: true, message: 'Procedure deleted successfully' });

  } catch (error) {
    console.error('Delete procedure error:', error);
    res.status(500).json({ error: 'Failed to delete procedure', details: error.message });
  }
}

module.exports = {
  getMedicalHistoryOptions,
  saveDoctorConfiguration,
  addCustomOption,
  getPatientMedicalHistory,
  savePatientMedicalHistory,
  togglePatientCondition,
  addExistingCondition,
  addSurgicalProcedure,
  deleteExistingCondition,
  deleteSurgicalProcedure
};

module.exports = require('./medicalHistoryController_refactored');
