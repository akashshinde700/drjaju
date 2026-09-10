const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class MedicalRoutesService {
  static async searchSnomedSymptoms({ q, limit = 20 }) {
    if (!q || q.length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const db = getDb();

    const [symptoms] = await db.execute(
      `
      SELECT snomed_id, preferred_term 
      FROM snomed_concepts 
      WHERE preferred_term LIKE ? 
      AND (preferred_term LIKE '%symptom%' OR preferred_term LIKE '%pain%' OR preferred_term LIKE '%fever%' OR preferred_term LIKE '%cough%' OR preferred_term LIKE '%headache%')
      ORDER BY preferred_term
      LIMIT ${parseInt(limit, 10)}
    `,
      [`%${q}%`]
    );

    return {
      success: true,
      data: symptoms.map(s => ({
        id: s.snomed_id,
        name: s.preferred_term,
        type: 'symptom',
        source: 'snomed'
      }))
    };
  }

  static async getDiagnosisSuggestions({ symptoms }) {
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      throw ApiError.badRequest('Symptoms array is required');
    }

    const db = getDb();

    let whereClause = '';
    const params = [];

    symptoms.forEach((symptom, index) => {
      whereClause += index === 0 ? 'primary_description LIKE ?' : ' OR primary_description LIKE ?';
      params.push(`%${symptom}%`);
    });

    const [diagnoses] = await db.execute(
      `
      SELECT DISTINCT 
        icd_code, 
        primary_description, 
        short_description
      FROM icd_codes 
      WHERE ${whereClause}
      ORDER BY primary_description
      LIMIT 15
    `,
      params
    );

    let whereClause11 = '';
    const params11 = [];

    symptoms.forEach((symptom, index) => {
      whereClause11 += index === 0 ? 'preferred_label LIKE ?' : ' OR preferred_label LIKE ?';
      params11.push(`%${symptom}%`);
    });

    const [icd11Diagnoses] = await db.execute(
      `
      SELECT DISTINCT 
        icd11_code, 
        preferred_label,
        short_definition
      FROM icd11_codes 
      WHERE ${whereClause11}
      ORDER BY preferred_label
      LIMIT 10
    `,
      params11
    );

    return {
      success: true,
      data: {
        icd10: diagnoses.map(d => ({
          code: d.icd_code,
          description: d.primary_description,
          shortDescription: d.short_description,
          type: 'icd10'
        })),
        icd11: icd11Diagnoses.map(d => ({
          code: d.icd11_code,
          description: d.preferred_label,
          shortDescription: d.short_definition,
          type: 'icd11'
        }))
      }
    };
  }

  static async getMedicineSuggestions({ symptoms, diagnosisCodes, diagnosisType }) {
    const db = getDb();
    const medicines = [];

    if (symptoms && Array.isArray(symptoms) && symptoms.length > 0) {
      const [symptomMeds] = await db.execute(
        `
        SELECT DISTINCT 
          sm.medication_name,
          sm.brand_name,
          sm.strength_value,
          sm.strength_unit,
          sm.dose_form,
          sm.route_of_administration,
          smm.recommendation_priority,
          smm.frequency,
          smm.duration,
          smm.severity_level
        FROM snomed_medications sm
        LEFT JOIN symptom_medication_mapping smm ON sm.medication_name = smm.medication_name
        WHERE smm.symptom_name IN (${symptoms.map(() => '?').join(',')})
        ORDER BY smm.recommendation_priority ASC, sm.medication_name
        LIMIT 20
      `,
        symptoms
      );

      medicines.push(
        ...symptomMeds.map(m => ({
          name: m.medication_name,
          brandName: m.brand_name,
          strength: m.strength_value ? `${m.strength_value} ${m.strength_unit}` : null,
          dosageForm: m.dose_form,
          route: m.route_of_administration,
          priority: m.recommendation_priority,
          frequency: m.frequency,
          duration: m.duration,
          severityLevel: m.severity_level,
          source: 'symptom_mapping'
        }))
      );
    }

    if (diagnosisCodes && Array.isArray(diagnosisCodes) && diagnosisCodes.length > 0) {
      const tableName = diagnosisType === 'icd11' ? 'icd11_medication_mapping' : 'icd_medication_mapping';
      const codeColumn = diagnosisType === 'icd11' ? 'icd11_code' : 'icd_code';

      const [diagnosisMeds] = await db.execute(
        `
        SELECT DISTINCT 
          sm.medication_name,
          sm.brand_name,
          sm.strength_value,
          sm.strength_unit,
          sm.dose_form,
          sm.route_of_administration,
          dm.recommended_frequency,
          dm.recommended_duration,
          dm.indication,
          dm.is_first_line,
          dm.priority
        FROM snomed_medications sm
        LEFT JOIN ${tableName} dm ON sm.medication_name = dm.medication_name
        WHERE dm.${codeColumn} IN (${diagnosisCodes.map(() => '?').join(',')})
        ORDER BY dm.is_first_line DESC, sm.medication_name
        LIMIT 20
      `,
        diagnosisCodes
      );

      medicines.push(
        ...diagnosisMeds.map(m => ({
          name: m.medication_name,
          brandName: m.brand_name,
          strength: m.strength_value ? `${m.strength_value} ${m.strength_unit}` : null,
          dosageForm: m.dose_form,
          route: m.route_of_administration,
          isFirstLine: m.is_first_line,
          priority: m.priority,
          frequency: m.recommended_frequency,
          duration: m.recommended_duration,
          indication: m.indication,
          source: 'diagnosis_mapping'
        }))
      );
    }

    const uniqueMedicines = medicines.filter((medicine, index, self) =>
      index === self.findIndex((m) => m.name === medicine.name)
    );

    uniqueMedicines.sort((a, b) => {
      if (a.isFirstLine && !b.isFirstLine) return -1;
      if (!a.isFirstLine && b.isFirstLine) return 1;
      if (a.priority && b.priority) return a.priority - b.priority;
      return 0;
    });

    return {
      success: true,
      data: uniqueMedicines.slice(0, 25)
    };
  }

  static async getMedicineDosage({ medicineName }) {
    const db = getDb();

    const [dosageRefs] = await db.execute(
      `
      SELECT 
        medication_name,
        dosage_form,
        strength,
        recommended_frequency,
        recommended_duration,
        max_daily_dose,
        special_instructions
      FROM dosage_references 
      WHERE medication_name LIKE ?
      ORDER BY recommended_frequency
      LIMIT 5
    `,
      [`%${medicineName}%`]
    );

    const [snomedMeds] = await db.execute(
      `
      SELECT 
        medication_name,
        brand_name,
        strength_value,
        strength_unit,
        dose_form,
        route_of_administration,
        therapeutic_class,
        schedule
      FROM snomed_medications 
      WHERE medication_name LIKE ?
      AND is_active = 1
      LIMIT 3
    `,
      [`%${medicineName}%`]
    );

    return {
      success: true,
      data: {
        dosageReferences: dosageRefs,
        medicationDetails: snomedMeds
      }
    };
  }

  static async searchIcdCodes({ q, type = 'icd10', limit = 20 }) {
    if (!q || q.length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const db = getDb();
    const results = [];

    if (type === 'icd10' || type === 'all') {
      const [icd10] = await db.execute(
        `
        SELECT icd_code, primary_description, short_description
        FROM icd_codes 
        WHERE primary_description LIKE ? OR icd_code LIKE ?
        ORDER BY primary_description
        LIMIT ${parseInt(limit, 10)}
      `,
        [`%${q}%`, `%${q}%`]
      );

      results.push(
        ...icd10.map(d => ({
          code: d.icd_code,
          description: d.primary_description,
          shortDescription: d.short_description,
          type: 'icd10'
        }))
      );
    }

    if (type === 'icd11' || type === 'all') {
      const [icd11] = await db.execute(
        `
        SELECT icd11_code, preferred_label, short_definition
        FROM icd11_codes 
        WHERE preferred_label LIKE ? OR icd11_code LIKE ?
        ORDER BY preferred_label
        LIMIT ${parseInt(limit, 10)}
      `,
        [`%${q}%`, `%${q}%`]
      );

      results.push(
        ...icd11.map(d => ({
          code: d.icd11_code,
          description: d.preferred_label,
          shortDescription: d.short_definition,
          type: 'icd11'
        }))
      );
    }

    return { success: true, data: results };
  }
}

module.exports = MedicalRoutesService;
