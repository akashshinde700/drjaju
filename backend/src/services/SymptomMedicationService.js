const { getDb } = require('../config/db');

class SymptomMedicationService {
  static async getMedicationSuggestions({ symptoms, age, weight }) {
    if (!symptoms) {
      const err = new Error('Symptoms parameter is required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    const symptomList = Array.isArray(symptoms)
      ? symptoms
      : String(symptoms)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    if (symptomList.length === 0) {
      return {
        medications: [],
        diagnoses: [],
        flatList: [],
        total: {
          medications: 0,
          diagnoses: 0,
        },
      };
    }

    const allMedications = [];
    const allDiagnoses = [];
    const seenMeds = new Set();
    const seenDiagnoses = new Set();

    let spUnavailable = false;

    for (const symptom of symptomList) {
      try {
        const [results] = await db.execute('CALL sp_get_complete_prescription_suggestion(?, ?, ?, ?)', [
          symptom,
          age ? parseInt(age, 10) : null,
          weight ? parseFloat(weight) : null,
          20,
        ]);

        if (results && Array.isArray(results)) {
          results.forEach((row) => {
            if (row.result_type === 'diagnosis' && row.icd_code) {
              if (!seenDiagnoses.has(row.icd_code)) {
                seenDiagnoses.add(row.icd_code);
                allDiagnoses.push({
                  icd_code: row.icd_code,
                  diagnosis_name: row.diagnosis_name,
                  symptom,
                });
              }
            } else if (row.result_type === 'medication' && row.medication_name) {
              const medKey = row.medication_name.toLowerCase();
              if (!seenMeds.has(medKey)) {
                seenMeds.add(medKey);
                allMedications.push({
                  name: row.medication_name,
                  dosageForm: row.dosage_form,
                  strength: row.strength,
                  dosage: row.strength,
                  frequency: row.frequency,
                  duration: row.duration,
                  priority: row.priority,
                  isFirstLine: row.is_first_line,
                  standardDosage: row.standard_dosage,
                  route: row.route,
                  symptom,
                  medicine_id: row.medicine_id,
                  usage_count: row.usage_count,
                });
              }
            }
          });
        }
      } catch (e) {
        if (e && (e.code === 'ER_SP_DOES_NOT_EXIST' || /sp_get_complete_prescription_suggestion/i.test(e.message || ''))) {
          spUnavailable = true;
          break;
        }
        console.warn(`Error getting suggestions for symptom "${symptom}":`, e.message);
      }
    }

    if (spUnavailable) {
      const fallback = await SymptomMedicationService._getSuggestionsFromMappings(db, symptomList, 20);
      return {
        medications: fallback.medications,
        diagnoses: fallback.diagnoses,
        flatList: fallback.medications,
        total: {
          medications: fallback.medications.length,
          diagnoses: fallback.diagnoses.length,
        },
      };
    }

    allMedications.sort((a, b) => {
      if (a.isFirstLine !== b.isFirstLine) return b.isFirstLine - a.isFirstLine;
      return (a.priority || 100) - (b.priority || 100);
    });

    return {
      medications: allMedications,
      diagnoses: allDiagnoses,
      flatList: allMedications,
      total: {
        medications: allMedications.length,
        diagnoses: allDiagnoses.length,
      },
    };
  }

  static async getAllMappings() {
    const db = getDb();
    const [mappings] = await db.execute(`
      SELECT *
      FROM symptom_medication_mapping
      ORDER BY symptom_name, recommendation_priority ASC
    `);

    return { mappings };
  }

  static async addMapping(body) {
    const {
      symptom_name,
      medication_name,
      brand_name,
      composition,
      dosage,
      frequency,
      timing,
      duration,
      priority,
    } = body;

    if (!symptom_name || !medication_name) {
      const err = new Error('Symptom name and medication name are required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    const [result] = await db.execute(
      `INSERT INTO symptom_medication_mapping
       (symptom_name, medication_name, brand_name, composition, dosage, frequency, timing, duration, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        symptom_name,
        medication_name,
        brand_name || null,
        composition || null,
        dosage || null,
        frequency || '1-0-1',
        timing || 'After Meal',
        duration || '7 days',
        priority || 1,
      ]
    );

    return { id: result.insertId };
  }

  static async deleteMapping(id) {
    const db = getDb();
    await db.execute('DELETE FROM symptom_medication_mapping WHERE id = ?', [id]);
    return { deleted: true };
  }

  static async _getSuggestionsFromMappings(db, symptomList, limit = 20) {
    const limitNum = Math.min(parseInt(limit, 10) || 20, 50);
    const symptoms = (Array.isArray(symptomList) ? symptomList : [])
      .map((s) => (s || '').toString().trim())
      .filter(Boolean);

    if (symptoms.length === 0) {
      return { medications: [], diagnoses: [] };
    }

    const symptomClauses = symptoms.map(() => 'LOWER(smm.symptom_name) = LOWER(?)').join(' OR ');

    let medRows = [];
    try {
      const [rows] = await db.execute(
        `SELECT DISTINCT
         smm.symptom_name,
         smm.medication_name,
         smm.dosage_form,
         smm.strength,
         smm.frequency,
         smm.duration,
         smm.recommendation_priority,
         smm.is_first_line,
         dr.standard_dosage,
         dr.route_of_administration AS route,
         med.id AS medicine_id,
         med.usage_count
       FROM symptom_medication_mapping smm
       LEFT JOIN dosage_references dr
         ON LOWER(dr.medication_name) = LOWER(smm.medication_name)
        AND (dr.dosage_form = smm.dosage_form OR dr.dosage_form IS NULL)
        AND (dr.strength = smm.strength OR dr.strength IS NULL)
       LEFT JOIN medicines med
         ON LOWER(med.name) = LOWER(smm.medication_name)
       WHERE (${symptomClauses})
       ORDER BY smm.is_first_line DESC, smm.recommendation_priority ASC, smm.medication_name ASC
       LIMIT ${limitNum}`,
        [...symptoms]
      );
      medRows = rows || [];
    } catch (e) {
      try {
        const [rows] = await db.execute(
          `SELECT DISTINCT
           smm.symptom_name,
           smm.medication_name,
           NULL AS dosage_form,
           NULL AS strength,
           smm.frequency,
           smm.duration,
           NULL AS recommendation_priority,
           0 AS is_first_line,
           NULL AS standard_dosage,
           NULL AS route,
           NULL AS medicine_id,
           0 AS usage_count
         FROM symptom_medication_mapping smm
         WHERE (${symptoms.map(() => 'LOWER(smm.symptom_name) = LOWER(?)').join(' OR ')})
         ORDER BY smm.medication_name ASC
         LIMIT ${limitNum}`,
          [...symptoms]
        );
        medRows = rows || [];
      } catch {
        const [rows] = await db.execute(
          `SELECT DISTINCT
           symptom_name AS symptom_name,
           medication_name AS medication_name
         FROM symptom_medication_mapping
         WHERE (${symptoms.map(() => 'LOWER(symptom_name) = LOWER(?)').join(' OR ')})
         ORDER BY medication_name ASC
         LIMIT ${limitNum}`,
          [...symptoms]
        );

        medRows = (rows || []).map((r) => ({
          symptom_name: r.symptom_name,
          medication_name: r.medication_name,
          dosage_form: null,
          strength: null,
          frequency: null,
          duration: null,
          recommendation_priority: null,
          is_first_line: 0,
          standard_dosage: null,
          route: null,
          medicine_id: null,
          usage_count: 0,
        }));
      }
    }

    const seenMeds = new Set();
    const medications = [];
    for (const r of medRows) {
      const name = r.medication_name;
      if (!name) continue;
      const key = name.toLowerCase().trim();
      if (seenMeds.has(key)) continue;
      seenMeds.add(key);

      medications.push({
        name,
        dosageForm: r.dosage_form,
        strength: r.strength,
        dosage: r.standard_dosage || r.strength,
        frequency: r.frequency,
        duration: r.duration,
        priority: r.recommendation_priority,
        isFirstLine: r.is_first_line,
        standardDosage: r.standard_dosage,
        route: r.route,
        symptom: r.symptom_name,
        medicine_id: r.medicine_id,
        usage_count: r.usage_count,
      });
    }

    const diagnoses = [];
    try {
      const likeClauses = symptoms.map(() => 'LOWER(clinical_term) LIKE LOWER(?)').join(' OR ');
      const likeParams = symptoms.map((s) => `%${s}%`);

      const [icdHits] = await db.execute(
        `SELECT icd_code, COUNT(*) AS hits
         FROM snomed_clinical_findings
        WHERE icd_code IS NOT NULL AND (${likeClauses})
        GROUP BY icd_code
        ORDER BY hits DESC
        LIMIT ?`,
        [...likeParams, limitNum]
      );

      const codes = (icdHits || []).map((r) => r.icd_code).filter(Boolean);
      if (codes.length > 0) {
        const placeholders = codes.map(() => '?').join(',');
        const [labels] = await db.execute(
          `SELECT icd_code, primary_description
           FROM icd_codes
          WHERE icd_code IN (${placeholders})`,
          codes
        );
        const labelMap = new Map((labels || []).map((l) => [l.icd_code, l.primary_description]));

        for (const c of codes) {
          diagnoses.push({ icd_code: c, diagnosis_name: labelMap.get(c) || c });
        }
      }
    } catch {
      // ignore
    }

    return { medications, diagnoses };
  }
}

module.exports = SymptomMedicationService;
