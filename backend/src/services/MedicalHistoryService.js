const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { resolveClinicIdForPatient } = require('../utils/helpers');

class MedicalHistoryService {
  static async getMedicalHistoryOptions({ doctorId }) {
    const db = getDb();

    const [options] = await db.execute(
      `
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
    `,
      [doctorId]
    );

    return { options };
  }

  static async saveDoctorConfiguration({ doctorId, configurations }) {
    if (!configurations || !Array.isArray(configurations)) {
      throw ApiError.badRequest('configurations array is required');
    }

    const db = getDb();

    await db.execute('DELETE FROM doctor_medical_history_config WHERE doctor_id = ?', [doctorId]);

    for (const config of configurations) {
      await db.execute(
        `
        INSERT INTO doctor_medical_history_config (doctor_id, option_id, is_visible, display_order)
        VALUES (?, ?, ?, ?)
      `,
        [doctorId, config.option_id, config.is_visible !== false, config.display_order || 0]
      );
    }

    return { saved: true };
  }

  static async addCustomOption({ condition_name, condition_code, category }) {
    if (!condition_name) {
      throw ApiError.badRequest('condition_name is required');
    }

    const db = getDb();
    const [result] = await db.execute(
      `
      INSERT INTO medical_history_options (condition_name, condition_code, category, is_default)
      VALUES (?, ?, ?, FALSE)
    `,
      [condition_name, condition_code || null, category || 'chronic']
    );

    return { id: result.insertId };
  }

  static async getPatientMedicalHistory({ patientId, doctorId }) {
    const db = getDb();

    const [medicalHistory] = await db.execute(
      `
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
    `,
      [doctorId, patientId]
    );

    const [existingConditions] = await db.execute(
      `
      SELECT id, condition_name, icd_code, status, start_date, notes
      FROM patient_chronic_conditions
      WHERE patient_id = ? AND status = 'Active'
      ORDER BY created_at DESC
    `,
      [patientId]
    );

    const [surgicalHistory] = await db.execute(
      `
      SELECT id, surgery_name, surgery_date, hospital, surgeon, complications
      FROM patient_surgical_history
      WHERE patient_id = ?
      ORDER BY surgery_date DESC
    `,
      [patientId]
    );

    const [allergies] = await db.execute(
      `
      SELECT id, category, allergen_name, severity, reaction
      FROM patient_allergies
      WHERE patient_id = ? AND is_active = 1
      ORDER BY severity DESC
    `,
      [patientId]
    );

    const [familyHistory] = await db.execute(
      `
      SELECT id, relation, condition_name, icd_code, notes
      FROM family_history
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `,
      [patientId]
    );

    return {
      medicalHistory,
      existingConditions,
      surgicalHistory,
      allergies,
      familyHistory,
    };
  }

  static async savePatientMedicalHistory({ patientId, selections, userId }) {
    if (!selections || !Array.isArray(selections)) {
      throw ApiError.badRequest('selections array is required');
    }

    const db = getDb();

    for (const selection of selections) {
      const [existing] = await db.execute(
        'SELECT id FROM patient_medical_history WHERE patient_id = ? AND option_id = ?',
        [patientId, selection.option_id]
      );

      if (existing.length > 0) {
        await db.execute(
          `
          UPDATE patient_medical_history
          SET has_condition = ?, since_date = ?, notes = ?, updated_at = NOW()
          WHERE id = ?
        `,
          [
            selection.has_condition || false,
            selection.since_date || null,
            selection.notes || null,
            existing[0].id,
          ]
        );
      } else {
        await db.execute(
          `
          INSERT INTO patient_medical_history
            (patient_id, option_id, condition_name, has_condition, since_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            patientId,
            selection.option_id,
            selection.condition_name,
            selection.has_condition || false,
            selection.since_date || null,
            selection.notes || null,
            userId,
          ]
        );
      }
    }

    return { saved: true };
  }

  static async togglePatientCondition({ patientId, body, userId }) {
    const { option_id, has_condition, since_date, condition_name } = body;

    if (!option_id) {
      throw ApiError.badRequest('option_id is required');
    }

    const db = getDb();

    const [existing] = await db.execute(
      'SELECT id FROM patient_medical_history WHERE patient_id = ? AND option_id = ?',
      [patientId, option_id]
    );

    if (existing.length > 0) {
      await db.execute(
        `
        UPDATE patient_medical_history
        SET has_condition = ?, since_date = ?, updated_at = NOW()
        WHERE id = ?
      `,
        [has_condition, since_date || null, existing[0].id]
      );
    } else {
      await db.execute(
        `
        INSERT INTO patient_medical_history
          (patient_id, option_id, condition_name, has_condition, since_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [patientId, option_id, condition_name, has_condition, since_date || null, userId]
      );
    }

    return { updated: true };
  }

  static async addExistingCondition({ patientId, body, clinicId }) {
    const { condition_name, icd_code, start_date, notes } = body;

    if (!condition_name) {
      throw ApiError.badRequest('condition_name is required');
    }

    const db = getDb();

    const resolvedClinicId = await resolveClinicIdForPatient(db, patientId, clinicId);
    if (!resolvedClinicId) {
      throw ApiError.badRequest(
        'Cannot add condition: clinic is not set for this patient or your account.'
      );
    }

    // Validate icd_code FK — only save if it exists in icd_codes table
    let safeIcdCode = null;
    if (icd_code) {
      const [rows] = await db.execute('SELECT icd_code FROM icd_codes WHERE icd_code = ? LIMIT 1', [icd_code]);
      if (rows.length > 0) safeIcdCode = icd_code;
    }

    const [result] = await db.execute(
      `
      INSERT INTO patient_chronic_conditions
        (patient_id, clinic_id, condition_name, icd_code, start_date, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `,
      [patientId, resolvedClinicId, condition_name, safeIcdCode, start_date || null, notes || null]
    );

    return { id: result.insertId };
  }

  static async addSurgicalProcedure({ patientId, body }) {
    const { surgery_name, surgery_date, hospital, surgeon, complications } = body;

    if (!surgery_name) {
      throw ApiError.badRequest('surgery_name is required');
    }

    const db = getDb();

    const [result] = await db.execute(
      `
      INSERT INTO patient_surgical_history
        (patient_id, surgery_name, surgery_date, hospital, surgeon, complications)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [patientId, surgery_name, surgery_date || null, hospital || null, surgeon || null, complications || null]
    );

    return { id: result.insertId };
  }

  static async deleteExistingCondition({ patientId, conditionId }) {
    const db = getDb();
    await db.execute('DELETE FROM patient_chronic_conditions WHERE id = ? AND patient_id = ?', [conditionId, patientId]);
    return { deleted: true };
  }

  static async deleteSurgicalProcedure({ patientId, procedureId }) {
    const db = getDb();
    await db.execute('DELETE FROM patient_surgical_history WHERE id = ? AND patient_id = ?', [procedureId, patientId]);
    return { deleted: true };
  }
}

module.exports = MedicalHistoryService;
