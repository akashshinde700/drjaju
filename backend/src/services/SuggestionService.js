const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class SuggestionService {
  static async getSymptomBasedSuggestions({ symptoms = [], age, patient_weight, allergies = [], limit = 15 }) {
    if (!symptoms || symptoms.length === 0) {
      throw ApiError.badRequest('Symptoms array is required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 15, 50);

    const symptomList = Array.isArray(symptoms)
      ? symptoms.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : s))
      : [symptoms].map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : s));

    const allDiagnoses = [];
    const allMedications = [];

    let spUnavailable = false;

    for (const symptom of symptomList) {
      try {
        const [results] = await db.execute('CALL sp_get_complete_prescription_suggestion(?, ?, ?, ?)', [
          symptom,
          age || null,
          patient_weight || null,
          limitNum,
        ]);

        if (results && Array.isArray(results)) {
          results.forEach((row) => {
            if (row.result_type === 'diagnosis' && row.icd_code) {
              if (!allDiagnoses.find((d) => d.icd_code === row.icd_code)) {
                allDiagnoses.push({
                  icd_code: row.icd_code,
                  diagnosis_name: row.diagnosis_name,
                  evidence_score: 1,
                });
              }
            } else if (row.result_type === 'medication' && row.medication_name) {
              allMedications.push(row);
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
      const fallbackDiagnoses = await SuggestionService._getDiagnosesBySymptoms(db, symptomList, limitNum);
      const fallbackMeds = await SuggestionService._getMedicationsBySymptoms(db, symptomList, limitNum);

      const mergedMeds = SuggestionService._mergeMedications([fallbackMeds]);
      const filtered = SuggestionService._filterByAllergies(mergedMeds, allergies);
      const ranked = SuggestionService._rankMedications(filtered);

      return {
        symptoms: symptomList,
        diagnoses: (fallbackDiagnoses || []).slice(0, limitNum),
        medications: ranked.slice(0, limitNum),
        total: {
          diagnoses: (fallbackDiagnoses || []).length,
          medications: ranked.length,
        },
      };
    }

    const uniqueMedications = SuggestionService._mergeMedications([allMedications]);
    const filteredMedications = SuggestionService._filterByAllergies(uniqueMedications, allergies);
    const rankedMedications = SuggestionService._rankMedications(filteredMedications);

    return {
      symptoms: symptomList,
      diagnoses: allDiagnoses.slice(0, limitNum),
      medications: rankedMedications.slice(0, limitNum),
      total: {
        diagnoses: allDiagnoses.length,
        medications: rankedMedications.length,
      },
    };
  }

  static async getDiagnosisMedicationsAndDosages({ icd_code, age, gender, weight, limit = 20 }) {
    if (!icd_code) {
      throw ApiError.badRequest('ICD code is required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

    const [enrichedMeds] = await db.execute(
      `SELECT DISTINCT
         m.medication_name as name,
         m.generic_name,
         m.dosage_form as form,
         m.strength,
         m.is_first_line,
         m.priority,
         m.evidence_level,
         m.indication,
         m.contraindications_notes as contraindications,
         d.standard_dosage,
         d.max_daily_dose,
         d.recommended_frequency as frequency,
         d.recommended_duration as duration,
         d.route_of_administration as route,
         d.age_group,
         d.is_weight_based,
         d.dose_per_kg,
         med.id as medicine_id,
         med.usage_count,
         med.last_used_at
       FROM diagnosis_medication_mapping m
       LEFT JOIN dosage_references d
         ON LOWER(d.medication_name) = LOWER(m.medication_name)
        AND (d.dosage_form = m.dosage_form OR d.dosage_form IS NULL)
        AND (d.strength = m.strength OR d.strength IS NULL)
       LEFT JOIN medicines med ON LOWER(med.name) = LOWER(m.medication_name)
       WHERE m.icd_code = ?
       ORDER BY m.is_first_line DESC, m.priority ASC, m.medication_name ASC
       LIMIT ?`,
      [icd_code, limitNum]
    );

    const mappedMeds = (enrichedMeds || []).map((med) => ({
      ...med,
      medicine_id: med.medicine_id || null,
      usage_count: med.usage_count || 0,
      last_used_at: med.last_used_at,
      adjusted_dosage: SuggestionService._calculateAdjustedDosage(med, { age, gender, weight }),
    }));

    return {
      icd_code,
      medications: mappedMeds,
      count: mappedMeds.length,
    };
  }

  static async getPrescriptionSuggestion({ symptoms = [], diagnoses = [], age, gender, weight, allergies = [], limit = 20 }) {
    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

    const medsBySymptom = symptoms.length > 0 ? await SuggestionService._getMedicationsBySymptoms(db, symptoms, limitNum) : [];

    const medsByDiagnosis = diagnoses.length > 0 ? await SuggestionService._getMedicationsByDiagnoses(db, diagnoses, limitNum) : [];

    const allMeds = SuggestionService._mergeMedications([medsBySymptom, medsByDiagnosis]);

    const medsWithDosage = await SuggestionService._enrichWithDosage(db, allMeds, { age, gender, weight });

    const filteredMeds = SuggestionService._filterByAllergies(medsWithDosage, allergies);
    const rankedMeds = SuggestionService._rankMedications(filteredMeds).slice(0, limitNum);

    return {
      symptoms,
      diagnoses,
      medications: rankedMeds,
      prescription_ready: true,
      ready_to_add: rankedMeds.length > 0,
    };
  }

  static async getIntegratedPrescriptionSuggestions({
    symptoms = [],
    icd_codes = [],
    diagnosis_names = [],
    age,
    weight,
    allergies = [],
    limit = 20,
  }) {
    if (!symptoms || symptoms.length === 0) {
      throw ApiError.badRequest('Symptoms array is required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const patientAge = age ? parseInt(age, 10) : null;
    const patientWeight = weight ? parseFloat(weight) : null;

    const [diagnosesFromSymptoms] = await db.execute(
      `
      SELECT DISTINCT
        sdm.icd_code,
        ic.primary_description as diagnosis_name,
        sdm.confidence_score,
        ic.category_code
      FROM symptom_diagnosis_mapping sdm
      LEFT JOIN icd_codes ic ON ic.icd_code = sdm.icd_code
      WHERE LOWER(sdm.symptom_name) IN (${symptoms.map(() => 'LOWER(?)').join(',')})
      ORDER BY sdm.confidence_score DESC
      LIMIT ?
    `,
      [...symptoms, limitNum]
    );

    const allDiagnoses = [
      ...(diagnosesFromSymptoms || []),
      ...icd_codes
        .filter((code) => !(diagnosesFromSymptoms || []).find((d) => d.icd_code === code))
        .map((code) => ({ icd_code: code, diagnosis_name: code, confidence_score: null })),
    ];

    const [medicinesFromDiagnosis] = await db.execute(
      `
      SELECT DISTINCT
        mc.id,
        mc.name,
        mc.manufacturer_name AS brand,
        mc.salt_composition AS composition,
        mc.pack_size_label AS strength,
        mc.type AS form,
        'TABLETS' AS category,
        dm.is_first_line,
        dm.priority,
        dm.indication,
        dr.standard_dosage,
        dr.max_daily_dose,
        dr.recommended_frequency AS frequency,
        dr.recommended_duration AS duration,
        dr.route_of_administration AS route,
        dr.age_group,
        dr.is_weight_based,
        dr.dose_per_kg,
        NULL as injections_info
      FROM diagnosis_medication_mapping dm
      LEFT JOIN medicines_consolidated mc ON LOWER(mc.name) = LOWER(dm.medication_name)
      LEFT JOIN dosage_references dr ON LOWER(dr.medication_name) = LOWER(dm.medication_name)
        AND (dr.dosage_form = dm.dosage_form OR dr.dosage_form IS NULL)
      WHERE dm.icd_code IN (${allDiagnoses.map(() => '?').join(',')})
        AND mc.is_discontinued = 0
      ORDER BY dm.is_first_line DESC, dm.priority ASC
      LIMIT ?
    `,
      [...allDiagnoses.map((d) => d.icd_code), limitNum]
    );

    const [injectionsFromDiagnosis] = await db.execute(
      `
      SELECT DISTINCT
        mc.id,
        mc.name,
        mc.manufacturer_name AS brand,
        mc.salt_composition AS composition,
        mc.pack_size_label AS strength,
        mc.type AS form,
        'INJECTIONS' AS category,
        dm.is_first_line,
        dm.priority,
        dm.indication,
        dr.standard_dosage,
        dr.max_daily_dose,
        dr.recommended_frequency AS frequency,
        dr.recommended_duration AS duration,
        dr.route_of_administration AS route,
        dr.age_group,
        dr.is_weight_based,
        dr.dose_per_kg
      FROM diagnosis_medication_mapping dm
      LEFT JOIN medicines_consolidated mc ON LOWER(mc.name) = LOWER(dm.medication_name)
        AND UPPER(TRIM(mc.type)) = 'INJECTIONS'
      LEFT JOIN dosage_references dr ON LOWER(dr.medication_name) = LOWER(dm.medication_name)
        AND dr.dosage_form = 'Injection'
      WHERE dm.icd_code IN (${allDiagnoses.map(() => '?').join(',')})
        AND mc.is_discontinued = 0
      ORDER BY dm.is_first_line DESC, dm.priority ASC
      LIMIT ?
    `,
      [...allDiagnoses.map((d) => d.icd_code), limitNum]
    );

    const [medicinesFromSymptoms] = await db.execute(
      `
      SELECT DISTINCT
        mc.id,
        mc.name,
        mc.manufacturer_name AS brand,
        mc.salt_composition AS composition,
        mc.pack_size_label AS strength,
        mc.type AS form,
        'TABLETS' AS category,
        smm.priority,
        NULL as is_first_line,
        NULL as indication,
        dr.standard_dosage,
        dr.max_daily_dose,
        dr.recommended_frequency AS frequency,
        dr.recommended_duration AS duration,
        dr.route_of_administration AS route,
        dr.age_group,
        dr.is_weight_based,
        dr.dose_per_kg
      FROM symptom_medication_mapping smm
      LEFT JOIN medicines_consolidated mc ON LOWER(mc.name) = LOWER(smm.medication_name)
      LEFT JOIN dosage_references dr ON LOWER(dr.medication_name) = LOWER(smm.medication_name)
      WHERE LOWER(smm.symptom_name) IN (${symptoms.map(() => 'LOWER(?)').join(',')})
        AND mc.is_discontinued = 0
      ORDER BY smm.priority ASC
      LIMIT ?
    `,
      [...symptoms, limitNum]
    );

    const allMedicines = [
      ...(medicinesFromDiagnosis || []),
      ...(medicinesFromSymptoms || []).filter((m) => !(medicinesFromDiagnosis || []).find((d) => d.id === m.id)),
    ];

    const allInjections = injectionsFromDiagnosis || [];

    const filteredMedicines = SuggestionService._filterByAllergies(allMedicines, allergies);
    const filteredInjections = SuggestionService._filterByAllergies(allInjections, allergies);

    const rankedMedicines = SuggestionService._rankMedications(filteredMedicines).slice(0, limitNum);
    const rankedInjections = SuggestionService._rankMedications(filteredInjections).slice(0, Math.ceil(limitNum / 2));

    const enrichedMedicines = rankedMedicines.map((med) =>
      SuggestionService._enrichMedicineWithDosage(med, { age: patientAge, weight: patientWeight })
    );

    const enrichedInjections = rankedInjections.map((inj) =>
      SuggestionService._enrichMedicineWithDosage(inj, { age: patientAge, weight: patientWeight })
    );

    return {
      request: {
        symptoms,
        diagnoses: allDiagnoses.length > 0 ? allDiagnoses : icd_codes,
        diagnosis_names,
        patient_age: patientAge,
        patient_weight: patientWeight,
      },
      suggestions: {
        diagnoses: allDiagnoses.slice(0, limitNum),
        medicines: enrichedMedicines,
        injections: enrichedInjections,
        total_suggestions: {
          diagnoses: allDiagnoses.length,
          medicines: enrichedMedicines.length,
          injections: enrichedInjections.length,
        },
      },
      ready_for_prescription: enrichedMedicines.length > 0 || enrichedInjections.length > 0,
    };
  }

  static async _getDiagnosesBySymptoms(db, symptoms, limit) {
    if (symptoms.length === 0) return [];

    const likeClauses = symptoms.map(() => 'LOWER(clinical_term) LIKE LOWER(?)').join(' OR ');
    const likeParams = symptoms.map((s) => `%${s}%`);

    try {
      const [icdFromFindings] = await db.execute(
        `SELECT DISTINCT icd_code, COUNT(*) AS hits, clinical_term
         FROM snomed_clinical_findings
         WHERE icd_code IS NOT NULL AND (${likeClauses})
         GROUP BY icd_code
         ORDER BY hits DESC
         LIMIT ?`,
        [...likeParams, limit]
      );

      if ((icdFromFindings || []).length > 0) {
        const codes = icdFromFindings.map((r) => r.icd_code);
        const placeholders2 = codes.map(() => '?').join(',');
        const [labels] = await db.execute(
          `SELECT icd_code, primary_description as diagnosis_name
           FROM icd_codes
           WHERE icd_code IN (${placeholders2})`,
          codes
        );
        const labelMap = new Map((labels || []).map((l) => [l.icd_code, l.diagnosis_name]));
        return icdFromFindings.map((r) => ({
          icd_code: r.icd_code,
          diagnosis_name: labelMap.get(r.icd_code) || r.icd_code,
          evidence_score: r.hits,
        }));
      }
    } catch (e) {
      console.warn('Error querying SNOMED findings:', e);
    }

    return [];
  }

  static async _getMedicationsBySymptoms(db, symptoms, limit) {
    if (symptoms.length === 0) return [];

    const placeholders = symptoms.map(() => 'LOWER(symptom_name) = LOWER(?)').join(' OR ');
    try {
      const [meds] = await db.execute(
        `SELECT DISTINCT
         medication_name as name,
         brand_name as brand,
         dosage_form as form,
         strength,
         frequency,
         duration,
         severity_level,
         recommendation_priority as priority,
         evidence_based
       FROM symptom_medication_mapping
       WHERE (${placeholders})
       ORDER BY recommendation_priority ASC, medication_name ASC
       LIMIT ?`,
        [...symptoms, limit]
      );
      return meds || [];
    } catch (e) {
      console.warn('Error getting meds by symptoms:', e);
      return [];
    }
  }

  static async _getMedicationsByDiagnoses(db, icdCodes, limit) {
    if (!icdCodes || icdCodes.length === 0) return [];

    const placeholders = icdCodes.map(() => '?').join(',');
    try {
      const [meds] = await db.execute(
        `SELECT DISTINCT
         medication_name as name,
         dosage_form as form,
         strength,
         frequency,
         duration,
         is_first_line,
         priority,
         evidence_level,
         indication
       FROM diagnosis_medication_mapping
       WHERE icd_code IN (${placeholders})
       ORDER BY is_first_line DESC, priority ASC, medication_name ASC
       LIMIT ?`,
        [...icdCodes, limit]
      );
      return meds || [];
    } catch (e) {
      console.warn('Error getting meds by diagnoses:', e);
      return [];
    }
  }

  static _mergeMedications(medArrays) {
    const merged = new Map();

    for (const medArray of medArrays) {
      if (!Array.isArray(medArray)) continue;
      for (const med of medArray) {
        const key = (med.name || '').toLowerCase();
        if (!merged.has(key)) {
          merged.set(key, med);
        } else {
          const existing = merged.get(key);
          merged.set(key, {
            ...existing,
            ...med,
            form: med.form || existing.form,
            strength: med.strength || existing.strength,
            frequency: med.frequency || existing.frequency,
          });
        }
      }
    }

    return Array.from(merged.values());
  }

  static async _enrichWithDosage(db, medications, patientInfo = {}) {
    return Promise.all(
      medications.map(async (med) => {
        try {
          const [dosageRows] = await db.execute(
            `SELECT
             standard_dosage,
             max_daily_dose,
             recommended_frequency,
             recommended_duration,
             route_of_administration,
             age_group,
             is_weight_based,
             dose_per_kg,
             pregnancy_category,
             lactation_safety
           FROM dosage_references
           WHERE LOWER(medication_name) = LOWER(?)
           LIMIT 1`,
            [med.name]
          );

          if (dosageRows.length > 0) {
            const dosage = dosageRows[0];
            const adjusted = SuggestionService._calculateAdjustedDosage(dosage, patientInfo);

            return {
              ...med,
              standard_dosage: dosage.standard_dosage,
              max_daily_dose: dosage.max_daily_dose,
              recommended_frequency: dosage.recommended_frequency || med.frequency,
              recommended_duration: dosage.recommended_duration || med.duration,
              route: dosage.route_of_administration || 'Oral',
              age_group: dosage.age_group,
              adjusted_dosage: adjusted,
              pregnancy_category: dosage.pregnancy_category,
              lactation_safe: dosage.lactation_safety,
            };
          }
        } catch (e) {
          console.warn(`Error enriching ${med.name} with dosage:`, e);
        }

        return med;
      })
    );
  }

  static _calculateAdjustedDosage(dosageInfo, patientInfo = {}) {
    if (!dosageInfo) return null;

    const { age, weight } = patientInfo;

    if (dosageInfo.is_weight_based && dosageInfo.dose_per_kg && weight) {
      const adjustedDose = (parseFloat(dosageInfo.dose_per_kg) * parseFloat(weight)).toFixed(2);
      return `${adjustedDose}mg`;
    }

    if (age && dosageInfo.standard_dosage) {
      if (age < 1) {
        return `1/4 of ${dosageInfo.standard_dosage}`;
      }
      if (age < 5) {
        return `1/2 of ${dosageInfo.standard_dosage}`;
      }
      if (age >= 18) {
        return dosageInfo.standard_dosage;
      }
    }

    return dosageInfo.standard_dosage;
  }

  static _filterByAllergies(medications, allergies = []) {
    if (!allergies || allergies.length === 0) return medications;

    const allergyNames = allergies.map((a) =>
      typeof a === 'string' ? a.toLowerCase() : a.allergen_name?.toLowerCase()
    );

    return medications.filter((med) => {
      const medName = (med.name || '').toLowerCase();
      const medBrand = (med.brand || '').toLowerCase();

      return !allergyNames.some((allergen) =>
        allergen ? medName.includes(allergen) || allergen.includes(medName) || medBrand.includes(allergen) : false
      );
    });
  }

  static _enrichMedicineWithDosage(medicine, patientData) {
    const { age, weight } = patientData;
    let adjustedDose = medicine.standard_dosage;

    if (medicine.is_weight_based && weight && medicine.dose_per_kg) {
      adjustedDose = `${medicine.dose_per_kg} mg/kg = ${(medicine.dose_per_kg * weight).toFixed(2)} mg`;
    }

    const ageGroup = SuggestionService._getAgeGroup(age);

    return {
      ...medicine,
      calculated_dosage: adjustedDose,
      age_group_match: medicine.age_group === ageGroup || !medicine.age_group,
      patient_specific: {
        age_group: ageGroup,
        weight,
        dosage_note: medicine.is_weight_based ? 'Weight-based dosing' : 'Standard dosing',
      },
    };
  }

  static _getAgeGroup(age) {
    if (!age) return 'Adult';
    if (age < 2) return 'Infant';
    if (age < 6) return 'Child (2-6)';
    if (age < 12) return 'Child (6-12)';
    if (age < 18) return 'Adolescent';
    if (age > 60) return 'Geriatric';
    return 'Adult';
  }

  static _rankMedications(medications) {
    return (medications || []).sort((a, b) => {
      const aFirstLine = a.is_first_line ? 1 : 0;
      const bFirstLine = b.is_first_line ? 1 : 0;
      if (aFirstLine !== bFirstLine) return bFirstLine - aFirstLine;

      const aPriority = a.priority || a.recommendation_priority || 100;
      const bPriority = b.priority || b.recommendation_priority || 100;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aEvidence = SuggestionService._getEvidenceScore(a.evidence_level);
      const bEvidence = SuggestionService._getEvidenceScore(b.evidence_level);
      if (aEvidence !== bEvidence) return bEvidence - aEvidence;

      return (a.name || '').localeCompare(b.name || '');
    });
  }

  static _getEvidenceScore(level) {
    const scores = {
      A: 5,
      B: 4,
      C: 3,
      D: 2,
      Expert: 1,
    };
    return scores[level] || 0;
  }
}

module.exports = SuggestionService;
