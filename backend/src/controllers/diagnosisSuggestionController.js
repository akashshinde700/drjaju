const { getDb } = require('../config/db');

/**
 * Get diagnoses suggested by symptoms
 * Uses symptom_diagnosis_mapping if available, otherwise falls back to common patterns
 */
async function getDiagnosesBySymptoms(req, res) {
  try {
    const { symptoms } = req.query;
    
    if (!symptoms) {
      return res.status(400).json({ success: false, error: 'Symptoms parameter required' });
    }

    const symptomList = Array.isArray(symptoms) ? symptoms : symptoms.split(',').map(s => s.trim());
    const db = getDb();
    const results = [];

    for (const symptom of symptomList) {
      try {
        // Try symptom_diagnosis_mapping first (if table exists)
        const [mapped] = await db.execute(
          `SELECT icd_code, diagnosis_name, confidence_score, is_first_line
           FROM symptom_diagnosis_mapping
           WHERE LOWER(symptom_name) = LOWER(?)
           ORDER BY confidence_score DESC, is_first_line DESC
           LIMIT 5`,
          [symptom]
        ).catch(() => []);

        if (mapped.length > 0) {
          results.push(...mapped.map(m => ({
            symptom,
            icd_code: m.icd_code,
            diagnosis_name: m.diagnosis_name,
            confidence: m.confidence_score,
            firstLine: m.is_first_line,
            source: 'mapping'
          })));
        } else {
          // Fallback: search ICD descriptions for symptom keywords
          const [icdMatches] = await db.execute(
            `SELECT icd_code, primary_description as diagnosis_name
             FROM icd_codes
             WHERE LOWER(primary_description) LIKE ?
             LIMIT 3`,
            [`%${symptom.toLowerCase()}%`]
          );

          results.push(...icdMatches.map(m => ({
            symptom,
            icd_code: m.icd_code,
            diagnosis_name: m.diagnosis_name,
            confidence: 0.6,
            firstLine: false,
            source: 'icd_search'
          })));
        }
      } catch (e) {
        console.warn(`Error processing symptom ${symptom}:`, e.message);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('❌ Error in getDiagnosesBySymptoms:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch diagnoses' });
  }
}

/**
 * Get medicines with dosage for given diagnoses (ICD codes)
 */
async function getMedicinesByDiagnoses(req, res) {
  try {
    const { icdCodes, icd11Codes } = req.query;
    const db = getDb();
    const medications = [];

    // Process ICD-10 codes
    if (icdCodes) {
      const codes = Array.isArray(icdCodes) ? icdCodes : icdCodes.split(',');
      for (const code of codes) {
        try {
          const [meds] = await db.execute(
            `SELECT DISTINCT m.name, m.brand, m.strength, m.dosage_form, m.default_dosage, m.default_frequency, m.default_duration
             FROM medicines m
             JOIN icd_medication_mapping imm ON m.name = imm.medication_name
             WHERE imm.icd_code = ?
             LIMIT 5`,
            [code.trim()]
          );
          medications.push(...meds.map(m => ({
            ...m,
            icd_code: code.trim(),
            source: 'icd10'
          })));
        } catch (e) {
          console.warn(`Error fetching ICD-10 meds for ${code}:`, e.message);
        }
      }
    }

    // Process ICD-11 codes
    if (icd11Codes) {
      const codes = Array.isArray(icd11Codes) ? icd11Codes : icd11Codes.split(',');
      for (const code of codes) {
        try {
          const [meds] = await db.execute(
            `SELECT DISTINCT m.name, m.brand, m.strength, m.dosage_form, m.default_dosage, m.default_frequency, m.default_duration
             FROM medicines m
             JOIN icd11_medication_mapping imm ON m.name = imm.medication_name
             WHERE imm.icd11_code = ?
             LIMIT 5`,
            [code.trim()]
          );
          medications.push(...meds.map(m => ({
            ...m,
            icd11_code: code.trim(),
            source: 'icd11'
          })));
        } catch (e) {
          console.warn(`Error fetching ICD-11 meds for ${code}:`, e.message);
        }
      }
    }

    res.json({ success: true, data: medications });
  } catch (error) {
    console.error('Error in getMedicinesByDiagnoses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch medications' });
  }
}

module.exports = { getDiagnosesBySymptoms, getMedicinesByDiagnoses };
