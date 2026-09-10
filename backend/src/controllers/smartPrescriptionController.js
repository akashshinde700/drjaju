const { getDb } = require('../config/db');

/**
 * Get smart medicine suggestions based on diagnosis, symptoms, and patient history
 * GET /api/smart-prescription/suggestions?patientId=&diagnosis=&symptoms=&age=&weight=
 */
const getSmartSuggestions = async (req, res) => {
  try {
    const { patientId, diagnosis, symptoms, age, weight } = req.query;
    const db = getDb();
    const startTime = Date.now();
    const MAX_TIME = 8000; // 8 second hard timeout to avoid 15s frontend timeout

    const suggestions = {
      medicines: [],
      injections: [],
      diagnoses: [],
      investigations: [],
      frequentlyUsed: [],
      interactions: []
    };

    const isTimeoutExceeded = () => (Date.now() - startTime) > MAX_TIME;

    // Comprehensive symptom mapping for all sections
    const symptomMapping = {
      'Dizziness': ['dizziness', 'vertigo', 'lightheadedness'],
      'Fatigue': ['weakness', 'fatigue', 'exhaustion', 'tiredness', 'asthenia'],
      'Weakness': ['weakness', 'asthenia', 'muscle weakness'],
      'Tired': ['fatigue', 'tiredness', 'exhaustion'],
      'Exhausted': ['fatigue', 'exhaustion', 'tiredness'],
      'Nausea': ['nausea', 'vomiting', 'queasiness'],
      'Vomiting': ['vomiting', 'nausea', 'emesis'],
      'Headache': ['headache', 'migraine', 'cephalgia', 'head pain'],
      'Head Pain': ['headache', 'cephalgia', 'head pain'],
      'Migraine': ['migraine', 'headache', 'vascular headache'],
      'Fever': ['fever', 'pyrexia', 'temperature', 'hyperthermia'],
      'Temperature': ['fever', 'pyrexia', 'hyperthermia'],
      'Cough': ['cough', 'tussis', 'dry cough', 'productive cough'],
      'Cold': ['cold', 'rhinitis', 'nasal congestion', 'upper respiratory infection'],
      'Pain': ['pain', 'ache', 'discomfort', 'painful'],
      'Body Ache': ['body ache', 'myalgia', 'muscle pain', 'arthralgia'],
      'Chest Pain': ['chest pain', 'angina', 'thoracic pain', 'cardiac pain'],
      'Breathlessness': ['breathlessness', 'dyspnea', 'shortness of breath'],
      'Abdominal Pain': ['abdominal pain', 'stomach pain', 'abdominal discomfort']
    };

    // 1. Get frequently used medicines for this patient (SKIP if timeout)
    if (patientId && !isTimeoutExceeded()) {
      try {
        const [freqMeds] = await db.execute(
          `SELECT m.name, m.brand, m.strength, COUNT(*) as usage_count
           FROM medicines m
           JOIN frequently_used fu ON m.name = fu.item_name
           WHERE fu.user_id = ? AND fu.item_type = 'medicine'
           GROUP BY m.id, m.name, m.brand, m.strength
           ORDER BY usage_count DESC
           LIMIT 10`,
          [req.user?.id]
        ).catch(err => {
          console.warn('Smart suggestions frequently_used query failed (non-blocking):', err.message);
          return [[]];
        });
        suggestions.frequentlyUsed = freqMeds || [];
      } catch (e) {
        console.warn('Error fetching frequently used medicines:', e.message);
      }
    }

    // 2. Diagnosis-based suggestions (LIMITED - skip if timeout)
    const isLikelyIcdCode = (s) => {
      const v = String(s || '').trim();
      if (!v) return false;
      if (/^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/i.test(v)) return true;
      if (/^[0-9A-Z]{2,10}(\.[0-9A-Z]{1,10})+$/i.test(v)) return true;
      return false;
    };

    if (diagnosis && !isTimeoutExceeded()) {
      const diagnosisCodesRaw = Array.isArray(diagnosis) ? diagnosis : String(diagnosis).split(',').map(d => d.trim());
      const diagnosisCodes = diagnosisCodesRaw.filter(isLikelyIcdCode).slice(0, 3); // REDUCED from 8 to 3

      for (const code of diagnosisCodes) {
        if (isTimeoutExceeded()) break;
        
        try {
          // Try ICD11 first
          const [icd11Meds] = await db.execute(
            `SELECT m.name, m.brand, m.strength, m.dosage_form, 'icd11' as source, 'A' as evidence_level
             FROM medicines m
             WHERE m.id IN (
               SELECT DISTINCT medication_id FROM icd11_medication_mapping WHERE icd11_code = ?
             ) LIMIT 8`,
            [code]
          ).catch(() => [[]]);

          if ((icd11Meds || []).length > 0) {
            suggestions.medicines.push(...(icd11Meds || []).map(m => ({
              ...m,
              instructions: 'Take as prescribed by doctor',
              original_symptom: null
            })));
            continue;
          }

          // Fallback to plain medicines search
          const [icdMeds] = await db.execute(
            `SELECT DISTINCT name, brand, strength, dosage_form
             FROM medicines
             WHERE LOWER(name) LIKE ?
             LIMIT 8`,
            [code.slice(0, 3) + '%']
          ).catch(() => [[]]);
          
          if ((icdMeds || []).length > 0) {
            suggestions.medicines.push(...(icdMeds || []).map(m => ({
              ...m,
              source: 'search',
              instructions: 'Take as prescribed by doctor',
              original_symptom: null
            })));
          }
        } catch (e) {
          console.warn(`Error fetching medicines for diagnosis ${code}:`, e.message);
        }
      }
    }

    // 3. Symptom-based suggestions (SIMPLIFIED - skip if timeout)
    if (symptoms && !isTimeoutExceeded()) {
      const symptomList = Array.isArray(symptoms) ? symptoms : String(symptoms).split(',').map(s => s.trim());
      const mapped = [];
      for (const symptom of symptomList) {
        const xs = symptomMapping[symptom] || [String(symptom || '').toLowerCase()];
        for (const x of xs) mapped.push(String(x || '').trim());
      }
      const uniq = [...new Set(mapped.map(s => s.toLowerCase()).filter(Boolean))].slice(0, 10); // REDUCED from 25

      if (uniq.length > 0) {
        try {
          // Simple query instead of complex mapping
          const [symptomMeds] = await db.execute(
            `SELECT DISTINCT name, brand, strength, dosage_form, 'symptom' as source
             FROM medicines
             WHERE LOWER(composition) LIKE ? OR LOWER(generic_name) LIKE ?
             LIMIT 15`,
            [uniq[0] + '%', uniq[0] + '%']
          ).catch(() => [[]]);

          if ((symptomMeds || []).length > 0) {
            suggestions.medicines.push(...(symptomMeds || []).map(m => ({
              ...m,
              instructions: 'Take as prescribed by doctor',
              original_symptom: symptomList[0],
              evidence_level: 'C'
            })));
          }
        } catch (e) {
          console.warn('Error fetching medicines for symptoms:', e.message);
        }
      }
    }

    // 4. Remove duplicates and sort
    const uniqueMeds = [];
    const seen = new Set();
    
    const priorityOrder = {
      'frequently_used': 7,
      'icd11': 6,
      'icd10': 5,
      'symptom': 4,
      'search': 2
    };
    
    const allMeds = suggestions.medicines.map(m => ({ 
      ...m, 
      priority: priorityOrder[m.source] || 0 
    }));

    for (const med of allMeds) {
      const key = med.name + (med.strength || '');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMeds.push(med);
      }
    }

    uniqueMeds.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return 0;
    });

    suggestions.medicines = uniqueMeds.slice(0, 20); // REDUCED from 25

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Error in getSmartSuggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch smart suggestions'
    });
  }
};

/**
 * Check for drug interactions
 * POST /api/smart-prescription/check-interactions
 * Body: { medicines: [{ name, composition }] }
 */
const checkDrugInteractions = async (req, res) => {
  try {
    const { medicines } = req.body;
    
    if (!medicines || !Array.isArray(medicines)) {
      return res.status(400).json({
        success: false,
        error: 'Medicines array is required'
      });
    }

    const db = getDb();
    const interactions = [];
    const warnings = [];

    // Check pairwise interactions
    for (let i = 0; i < medicines.length; i++) {
      for (let j = i + 1; j < medicines.length; j++) {
        const med1 = medicines[i];
        const med2 = medicines[j];

        try {
          const [interactionRows] = await db.execute(
            `SELECT severity, description, recommendation
             FROM drug_interactions
             WHERE (medicine1 = ? AND medicine2 = ?) OR (medicine1 = ? AND medicine2 = ?)`,
            [med1.name, med2.name, med2.name, med1.name]
          );

          if (interactionRows.length > 0) {
            interactions.push({
              medicine1: med1.name,
              medicine2: med2.name,
              ...interactionRows[0]
            });
          }
        } catch (e) {
          console.warn('Error checking drug interactions:', e.message);
        }
      }
    }

    // Check for common warnings (e.g., pediatric, pregnancy, renal)
    for (const med of medicines) {
      try {
        const [warningRows] = await db.execute(
          `SELECT warning_type, message, action
           FROM medicine_warnings
           WHERE medicine_name = ?`,
          [med.name]
        );

        warnings.push(...warningRows.map(w => ({ ...w, medicine: med.name })));
      } catch (e) {
        console.warn('Error checking medicine warnings:', e.message);
      }
    }

    res.json({
      success: true,
      data: {
        interactions,
        warnings,
        totalInteractions: interactions.length,
        totalWarnings: warnings.length
      }
    });

  } catch (error) {
    console.error('Error in checkDrugInteractions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check drug interactions'
    });
  }
};

/**
 * Calculate dosage based on age and weight
 * GET /api/smart-prescription/calculate-dosage?medicineName=&age=&weight=&patientType=
 */
const calculateDosage = async (req, res) => {
  try {
    const { medicineName, age, weight, patientType = 'adult' } = req.query;
    
    if (!medicineName) {
      return res.status(400).json({
        success: false,
        error: 'Medicine name is required'
      });
    }

    const db = getDb();
    let dosage = '';
    let matchedReference = null;

    try {
      const mysql = require('mysql2');
      const searchName = String(medicineName || '').trim().toLowerCase();
      const like = `%${searchName}%`;

      const patientAge = age ? parseInt(age, 10) : null;
      const patientWeight = weight ? parseFloat(weight) : null;
      const ageGroup = patientAge === null ? null : patientAge < 18 ? 'Pediatric' : patientAge > 65 ? 'Geriatric' : 'Adult';

      const [rows] = await db.query(
        `SELECT
           medication_name, active_ingredient, dosage_form, strength,
           standard_dosage, max_daily_dose, recommended_frequency, recommended_duration,
           route_of_administration, special_instructions,
           age_group, is_weight_based, dose_per_kg
         FROM dosage_references
         WHERE LOWER(medication_name) LIKE ${mysql.escape(like)}
            OR LOWER(active_ingredient) LIKE ${mysql.escape(like)}
         ORDER BY
           CASE WHEN LOWER(medication_name) = ${mysql.escape(searchName)} THEN 0
                WHEN LOWER(medication_name) LIKE ${mysql.escape(searchName + '%')} THEN 1
                ELSE 2 END,
           CASE WHEN ${ageGroup ? mysql.escape(ageGroup) : 'NULL'} IS NULL THEN 1
                WHEN age_group = ${ageGroup ? mysql.escape(ageGroup) : 'NULL'} THEN 0
                WHEN age_group = 'All' THEN 1
                ELSE 2 END
         LIMIT 5`
      );

      if (rows && rows.length > 0) {
        matchedReference = rows[0];
        const freq = matchedReference.recommended_frequency || '1-0-1';
        const dur = matchedReference.recommended_duration || '';
        const baseDose = matchedReference.standard_dosage || '';

        let computedDose = baseDose;
        if (matchedReference.is_weight_based && patientWeight && matchedReference.dose_per_kg) {
          const mg = Number(matchedReference.dose_per_kg) * patientWeight;
          if (!Number.isNaN(mg)) {
            computedDose = `${matchedReference.dose_per_kg} mg/kg = ${mg.toFixed(2)} mg`;
          }
        }

        const instr = matchedReference.special_instructions || '';
        dosage = [computedDose, freq, dur].filter(Boolean).join(' ').trim();
        if (instr) dosage = `${dosage} - ${instr}`;
      }
    } catch (e) {
      console.warn('Error calculating dosage from dosage_references:', e.message);
    }

    if (!dosage) dosage = 'Standard dosage - Consult reference';

    res.json({
      success: true,
      data: {
        medicine: medicineName,
        dosage,
        reference: matchedReference,
        age: age ? parseInt(age) : null,
        weight: weight ? parseFloat(weight) : null,
        patientType
      }
    });

  } catch (error) {
    console.error('Error in calculateDosage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate dosage'
    });
  }
};

module.exports = {
  getSmartSuggestions,
  checkDrugInteractions,
  calculateDosage
};
