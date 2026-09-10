const { getDb } = require('../config/db');
const mysql = require('mysql2');
const { ApiError } = require('../utils');

class SymptomsService {
  static async searchSymptoms({ q, limit = 25, offset = 0, doctorId }) {
    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 25, 50);

    // When no query — return doctor's custom symptoms + top popular symptoms
    if (!q || q.trim().length < 1) {
      const seen = new Set();
      const symptoms = [];

      // Doctor's frequently used symptoms first
      if (doctorId) {
        try {
          const [rows] = await db.query(
            `SELECT symptom_name as symptom, usage_count
             FROM doctor_symptoms
             WHERE doctor_id = ?
             ORDER BY usage_count DESC, symptom_name ASC
             LIMIT 20`,
            [doctorId]
          );
          for (const r of rows) {
            const key = (r.symptom || '').toLowerCase();
            if (key && !seen.has(key)) {
              seen.add(key);
              symptoms.push({ symptom: r.symptom, source: 'custom', usage_count: r.usage_count });
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Top symptoms from mapping table
      try {
        const [rows] = await db.query(
          `SELECT symptom_name as symptom, COUNT(*) as medication_count
           FROM symptom_medication_mapping
           GROUP BY symptom_name
           ORDER BY medication_count DESC
           LIMIT 30`
        );
        for (const r of rows) {
          const key = (r.symptom || '').toLowerCase();
          if (key && !seen.has(key)) {
            seen.add(key);
            symptoms.push({ symptom: r.symptom, source: 'mapping', medication_count: r.medication_count });
          }
        }
      } catch (e) { /* ignore */ }

      return { symptoms: symptoms.slice(0, limitNum), total: symptoms.length, query: '' };
    }

    const searchTerm = q.trim();
    const like = `${searchTerm}%`;

    // Run all queries in parallel for speed
    // Note: collation is utf8mb4_unicode_ci (case-insensitive) so no LOWER() needed

    const [mappingPromise, snomedPromise, icdPromise, doctorPromise] = await Promise.allSettled([
      // 1. symptom_medication_mapping — small table, very fast
      db.query(
        `SELECT symptom_name as symptom,
          MIN(severity_level) as severity_level,
          MIN(recommendation_priority) as recommendation_priority,
          COUNT(*) as medication_count
         FROM symptom_medication_mapping
         WHERE symptom_name LIKE ?
         GROUP BY symptom_name
         ORDER BY medication_count DESC
         LIMIT 15`,
        [like]
      ),

      // 2. snomed_clinical_findings — uses composite index (is_active, finding_type, clinical_term)
      db.query(
        `SELECT clinical_term, finding_type, snomed_id, icd_code
         FROM snomed_clinical_findings
         WHERE is_active = 1
           AND finding_type IN ('Symptom', 'Sign', 'Finding')
           AND clinical_term LIKE ?
         ORDER BY
           CASE WHEN finding_type = 'Symptom' THEN 0 WHEN finding_type = 'Sign' THEN 1 ELSE 2 END,
           LENGTH(clinical_term)
         LIMIT ${limitNum}`,
        [like]
      ),

      // 3. ICD-10 R-chapter symptoms — uses prefix + contains for full coverage
      db.query(
        `SELECT primary_description as symptom, icd_code
         FROM icd_codes
         WHERE icd_code LIKE 'R%'
           AND (primary_description LIKE ? OR primary_description LIKE ?)
         ORDER BY
           CASE WHEN primary_description LIKE ? THEN 0 ELSE 1 END,
           LENGTH(primary_description)
         LIMIT 15`,
        [like, `%${searchTerm}%`, like]
      ),

      // 4. Doctor custom symptoms
      doctorId
        ? db.query(
            `SELECT symptom_name as symptom, usage_count
             FROM doctor_symptoms
             WHERE doctor_id = ? AND symptom_name LIKE ?
             ORDER BY usage_count DESC, symptom_name ASC
             LIMIT 10`,
            [doctorId, like]
          )
        : Promise.resolve([[]])
    ]);

    const mappingResults = mappingPromise.status === 'fulfilled' ? mappingPromise.value[0] : [];
    const snomedResults  = snomedPromise.status  === 'fulfilled' ? snomedPromise.value[0]  : [];
    const icdSymptoms    = icdPromise.status     === 'fulfilled' ? icdPromise.value[0]     : [];
    const doctorSymptoms = doctorPromise.status  === 'fulfilled' ? doctorPromise.value[0]  : [];

    // Combine with dedup — doctor custom first, then mapping, snomed, icd
    const seen = new Set();
    const symptoms = [];

    for (const r of doctorSymptoms) {
      const key = (r.symptom || '').toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); symptoms.push({ symptom: r.symptom, source: 'custom', usage_count: r.usage_count }); }
    }
    for (const r of mappingResults) {
      const key = (r.symptom || '').toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); symptoms.push({ symptom: r.symptom, source: 'mapping', medication_count: r.medication_count, severity_level: r.severity_level }); }
    }
    for (const r of snomedResults) {
      const key = (r.clinical_term || '').toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); symptoms.push({ symptom: r.clinical_term, source: 'snomed', finding_type: r.finding_type, snomed_id: r.snomed_id, icd_code: r.icd_code }); }
    }
    for (const r of icdSymptoms) {
      const key = (r.symptom || '').toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); symptoms.push({ symptom: r.symptom, source: 'icd', icd_code: r.icd_code }); }
    }

    return {
      symptoms: symptoms.slice(0, limitNum),
      total: symptoms.length,
      query: q
    };
  }

  static async getMedicationsBySymptom({ symptom, limit = 20 }) {
    if (!symptom) {
      throw ApiError.badRequest('Symptom is required');
    }

    const decoded = decodeURIComponent(symptom);
    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    const [medications] = await db.query(
      `SELECT
        medication_name as name,
        dosage_form as form,
        strength,
        frequency,
        duration,
        severity_level,
        recommendation_priority,
        evidence_based,
        notes
      FROM symptom_medication_mapping
      WHERE LOWER(symptom_name) = LOWER(?)
      ORDER BY recommendation_priority ASC, medication_name ASC
      LIMIT ${limitNum}`,
      [decoded]
    );

    return {
      symptom: decoded,
      medications: medications || [],
      count: medications ? medications.length : 0
    };
  }

  static async getRelatedDiagnoses({ symptom, limit = 10 }) {
    if (!symptom) {
      throw ApiError.badRequest('Symptom is required');
    }

    const decoded = decodeURIComponent(symptom);
    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 10, 50);
    const searchTerm = `%${decoded}%`;

    const [relatedDiagnoses] = await db.query(
      `SELECT
        icd_code as code,
        primary_description as diagnosis,
        secondary_description as description
      FROM icd_codes
      WHERE LOWER(primary_description) LIKE ${mysql.escape(searchTerm.toLowerCase())}
        OR LOWER(secondary_description) LIKE ${mysql.escape(searchTerm.toLowerCase())}
      LIMIT ${limitNum}`
    );

    return {
      symptom: decoded,
      related_diagnoses: relatedDiagnoses || [],
      count: relatedDiagnoses ? relatedDiagnoses.length : 0
    };
  }

  static async saveCustomSymptom({ symptom_name, doctorId }) {
    if (!symptom_name || !symptom_name.trim()) {
      throw ApiError.badRequest('Symptom name is required');
    }

    if (!doctorId) {
      throw ApiError.unauthorized('Doctor ID not found');
    }

    const db = getDb();
    await db.query(
      `INSERT INTO doctor_symptoms (doctor_id, symptom_name, usage_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
      [doctorId, symptom_name.trim()]
    );

    return { success: true };
  }
}

module.exports = SymptomsService;
