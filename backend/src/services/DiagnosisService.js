const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class DiagnosisService {
  static async searchDiagnoses({ query, limit = 20, offset = 0, doctorId, version }) {
    const db = getDb();
    const searchTerm = `%${query.toLowerCase()}%`;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    const v = (version || 'icd10').toLowerCase();
    const includeIcd10 = v === 'icd10' || v === 'all';
    const includeIcd11 = v === 'icd11' || v === 'all';

    const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
    let diagnoses = [];
    let total = 0;

    if (includeIcd11 && includeIcd10) {
      try {
        const queryStr = `
          SELECT * FROM (
            SELECT DISTINCT
              icd_code AS code,
              primary_description AS diagnosis_name,
              secondary_description AS description,
              chapter_code,
              'icd10' AS version
            FROM icd_codes
            WHERE (LOWER(primary_description) LIKE ?
              OR LOWER(secondary_description) LIKE ?
              OR LOWER(icd_code) LIKE ?)

            UNION ALL

            SELECT DISTINCT
              icd11_code AS code,
              preferred_label AS diagnosis_name,
              short_definition AS description,
              chapter_code,
              'icd11' AS version
            FROM icd11_codes
            WHERE (LOWER(preferred_label) LIKE ?
              OR LOWER(full_title) LIKE ?
              OR LOWER(icd11_code) LIKE ?)
          ) x
          ORDER BY x.diagnosis_name ASC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;

        const [rows] = await db.execute(queryStr, params);
        diagnoses = rows || [];

        const countQuery = `
          SELECT
            (
              SELECT COUNT(*)
              FROM icd_codes
              WHERE (LOWER(primary_description) LIKE ?
                OR LOWER(secondary_description) LIKE ?
                OR LOWER(icd_code) LIKE ?)
            )
            +
            (
              SELECT COUNT(*)
              FROM icd11_codes
              WHERE (LOWER(preferred_label) LIKE ?
                OR LOWER(full_title) LIKE ?
                OR LOWER(icd11_code) LIKE ?)
            ) AS total
        `;
        const [countResult] = await db.execute(countQuery, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);
        total = countResult[0]?.total || 0;
      } catch (e) {
        const queryStr = `
          SELECT DISTINCT
            icd_code as code,
            primary_description as diagnosis_name,
            secondary_description as description,
            chapter_code,
            'icd10' as version
          FROM icd_codes
          WHERE (LOWER(primary_description) LIKE ?
            OR LOWER(secondary_description) LIKE ?
            OR LOWER(icd_code) LIKE ?)
          ORDER BY primary_description ASC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
        const [rows] = await db.execute(queryStr, [searchTerm, searchTerm, searchTerm]);
        diagnoses = rows || [];

        const countQuery = `
          SELECT COUNT(*) as total FROM icd_codes
          WHERE (LOWER(primary_description) LIKE ?
            OR LOWER(secondary_description) LIKE ?
            OR LOWER(icd_code) LIKE ?)
        `;
        const [countResult] = await db.execute(countQuery, [searchTerm, searchTerm, searchTerm]);
        total = countResult[0]?.total || 0;
      }
    } else if (includeIcd11) {
      try {
        const queryStr = `
          SELECT DISTINCT
            icd11_code AS code,
            preferred_label AS diagnosis_name,
            short_definition AS description,
            chapter_code,
            'icd11' AS version
          FROM icd11_codes
          WHERE (LOWER(preferred_label) LIKE ?
            OR LOWER(full_title) LIKE ?
            OR LOWER(icd11_code) LIKE ?)
          ORDER BY preferred_label ASC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
        const [rows] = await db.execute(queryStr, [searchTerm, searchTerm, searchTerm]);
        diagnoses = rows || [];

        const countQuery = `
          SELECT COUNT(*) as total FROM icd11_codes
          WHERE (LOWER(preferred_label) LIKE ?
            OR LOWER(full_title) LIKE ?
            OR LOWER(icd11_code) LIKE ?)
        `;
        const [countResult] = await db.execute(countQuery, [searchTerm, searchTerm, searchTerm]);
        total = countResult[0]?.total || 0;
      } catch (e) {
        diagnoses = [];
        total = 0;
      }
    } else {
      const queryStr = `
        SELECT DISTINCT
          icd_code as code,
          primary_description as diagnosis_name,
          secondary_description as description,
          chapter_code,
          'icd10' as version
        FROM icd_codes
        WHERE (LOWER(primary_description) LIKE ?
          OR LOWER(secondary_description) LIKE ?
          OR LOWER(icd_code) LIKE ?)
        ORDER BY primary_description ASC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      const [rows] = await db.execute(queryStr, [searchTerm, searchTerm, searchTerm]);
      diagnoses = rows || [];

      const countQuery = `
        SELECT COUNT(*) as total FROM icd_codes
        WHERE (LOWER(primary_description) LIKE ?
          OR LOWER(secondary_description) LIKE ?
          OR LOWER(icd_code) LIKE ?)
      `;
      const [countResult] = await db.execute(countQuery, [searchTerm, searchTerm, searchTerm]);
      total = countResult[0]?.total || 0;
    }

    // Also search doctor's custom diagnoses (highest priority)
    let doctorDiagnoses = [];
    try {
      if (doctorId) {
        const [rows] = await db.query(
          `SELECT diagnosis_name, icd_code, usage_count
           FROM doctor_diagnoses
           WHERE doctor_id = ? AND LOWER(diagnosis_name) LIKE ?
           ORDER BY usage_count DESC
           LIMIT 10`,
          [doctorId, searchTerm]
        );
        doctorDiagnoses = rows;
      }
    } catch (e) { /* table may not exist */ }

    // Prepend doctor's custom diagnoses
    const customItems = doctorDiagnoses.map(d => ({
      code: d.icd_code || 'CUSTOM',
      diagnosis_name: d.diagnosis_name,
      description: 'Custom diagnosis',
      version: 'custom',
      usage_count: d.usage_count
    }));
    
    // Dedup: remove from diagnoses if already in custom
    const customNames = new Set(customItems.map(c => c.diagnosis_name.toLowerCase()));
    const filteredDiagnoses = diagnoses.filter(d => !customNames.has((d.diagnosis_name || '').toLowerCase()));

    return {
      diagnoses: [...customItems, ...filteredDiagnoses],
      total: total + customItems.length,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < total
    };
  }

  static async suggestDiagnosesBySymptoms({ symptoms = '', limit = 10 }) {
    const db = getDb();
    const tokens = symptoms.split(',').map(s => s.trim()).filter(Boolean);

    if (tokens.length === 0) {
      return { diagnoses: [], total: 0 };
    }

    const limitNum = Math.min(parseInt(limit) || 10, 50);

    // 1) ICD from snomed_clinical_findings
    const placeholders = tokens.map(() => '?').join(',');
    const likeClauses = tokens.map(() => 'LOWER(clinical_term) LIKE LOWER(?)').join(' OR ');
    const likeParams = tokens.map(t => `%${t}%`);

    const [icdFromFindings] = await db.execute(
      `SELECT icd_code, COUNT(*) AS hits
         FROM snomed_clinical_findings
        WHERE icd_code IS NOT NULL AND (${likeClauses})
        GROUP BY icd_code
        ORDER BY hits DESC
        LIMIT ${limitNum}`,
      likeParams
    );

    // 2) ICD via meds overlap: symptoms -> meds -> ICD meds mapping
    const [medsFromSymptoms] = await db.execute(
      `SELECT DISTINCT medication_name
         FROM symptom_medication_mapping
        WHERE ${tokens.map(() => 'LOWER(symptom_name) = LOWER(?)').join(' OR ')}`,
      tokens
    );
    const medNames = medsFromSymptoms.map(m => m.medication_name);

    let icdFromMeds = [];
    if (medNames.length > 0) {
      const medPlace = medNames.map(() => '?').join(',');
      const [rows] = await db.execute(
        `SELECT icd_code, COUNT(*) AS hits
           FROM icd_medication_mapping
          WHERE medication_name IN (${medPlace})
          GROUP BY icd_code
          ORDER BY hits DESC
          LIMIT ${limitNum}`,
        medNames
      );
      icdFromMeds = rows;
    }

    // Combine and rank
    const score = new Map();
    for (const r of icdFromFindings) {
      if (!r.icd_code) continue;
      score.set(r.icd_code, (score.get(r.icd_code) || 0) + r.hits * 2);
    }
    for (const r of icdFromMeds) {
      if (!r.icd_code) continue;
      score.set(r.icd_code, (score.get(r.icd_code) || 0) + r.hits);
    }

    const ranked = Array.from(score.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitNum)
      .map(([icd_code, weight]) => ({ icd_code, weight }));

    // Fetch ICD labels
    let diagnoses = [];
    if (ranked.length > 0) {
      const codes = ranked.map(r => r.icd_code);
      const placeholders2 = codes.map(() => '?').join(',');
      const [labels] = await db.execute(
        `SELECT icd_code, primary_description
           FROM icd_codes
          WHERE icd_code IN (${placeholders2})`,
        codes
      );
      const labelMap = new Map(labels.map(l => [l.icd_code, l.primary_description]));
      diagnoses = ranked.map(r => ({
        icd_code: r.icd_code,
        diagnosis_name: labelMap.get(r.icd_code) || r.icd_code,
        score: r.weight
      }));
    }

    return { diagnoses, total: diagnoses.length, symptoms: tokens };
  }

  static async getMedicationsByDiagnosis({ icd_code, limit = 20 }) {
    if (!icd_code) {
      throw ApiError.badRequest('ICD code is required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    // Detect if this is ICD-11 code
    let isIcd11 = false;
    try {
      const [exists11] = await db.execute(
        'SELECT 1 FROM icd11_codes WHERE icd11_code = ? LIMIT 1',
        [icd_code]
      );
      isIcd11 = Array.isArray(exists11) && exists11.length > 0;
    } catch (e) {
      isIcd11 = false;
    }

    if (isIcd11) {
      const [rows] = await db.execute(
        `SELECT DISTINCT
           m.medication_name as name,
           m.dosage_form as form,
           m.strength,
           m.recommended_frequency as frequency,
           m.recommended_duration as duration,
           m.indication,
           m.evidence_level,
           m.guideline_source,
           m.is_first_line,
           m.priority,
           dr.standard_dosage,
           dr.max_daily_dose
         FROM icd11_medication_mapping m
         LEFT JOIN dosage_references dr
           ON dr.medication_name = m.medication_name
          AND (dr.dosage_form = m.dosage_form OR m.dosage_form IS NULL)
          AND (dr.strength = m.strength OR m.strength IS NULL)
         WHERE m.icd11_code = ?
         ORDER BY m.is_first_line DESC, m.priority ASC, m.medication_name ASC
         LIMIT ?`,
        [icd_code, limitNum]
      );

      return {
        icd_code,
        medications: rows || [],
        count: rows ? rows.length : 0
      };
    }

    // Get medications from diagnosis_medication_mapping
    const query = `
      SELECT DISTINCT
        d.medication_name as name,
        d.dosage_form as form,
        d.strength,
        d.frequency,
        d.duration,
        d.indication,
        d.evidence_level,
        d.alternative_medications as alternatives
      FROM diagnosis_medication_mapping d
      WHERE d.icd_code = ?
      ORDER BY d.medication_name ASC
      LIMIT ${limitNum}
    `;

    const params = [icd_code];
    const [medications] = await db.execute(query, params);

    // Also get suggestions from dosage_references if mapping is empty
    let suggestedMeds = medications;
    if (medications.length === 0) {
      // Get from ICD-medication mapping
      const icdMedQuery = `
        SELECT DISTINCT
          m.medication_name as name,
          m.dosage_form as form,
          m.strength,
          m.recommended_frequency as frequency,
          m.recommended_duration as duration,
          m.notes as indication
        FROM dosage_references m
        WHERE m.icd_code = ?
        LIMIT ${limitNum}
      `;
      const [icdMeds] = await db.execute(icdMedQuery, [icd_code]);
      suggestedMeds = icdMeds;
    }

    return {
      icd_code,
      medications: suggestedMeds || [],
      count: suggestedMeds ? suggestedMeds.length : 0
    };
  }

  static async getDiagnosisDetails({ icd_code }) {
    if (!icd_code) {
      throw ApiError.badRequest('ICD code is required');
    }

    const db = getDb();

    // Detect ICD-11
    let isIcd11 = false;
    try {
      const [exists11] = await db.execute(
        'SELECT 1 FROM icd11_codes WHERE icd11_code = ? LIMIT 1',
        [icd_code]
      );
      isIcd11 = Array.isArray(exists11) && exists11.length > 0;
    } catch (e) {
      isIcd11 = false;
    }

    if (isIcd11) {
      const [results] = await db.execute(
        `SELECT
           icd11_code as code,
           preferred_label as diagnosis_name,
           short_definition as description,
           chapter_code,
           block_code,
           linearization,
           classification_status,
           created_at
         FROM icd11_codes
         WHERE icd11_code = ?
         LIMIT 1`,
        [icd_code]
      );

      if (!results || results.length === 0) {
        throw ApiError.notFound('Diagnosis');
      }

      return results[0];
    }

    const query = `
      SELECT
        icd_code as code,
        primary_description as diagnosis_name,
        secondary_description as description,
        chapter_code,
        group_code,
        code_type,
        created_at
      FROM icd_codes
      WHERE icd_code = ?
    `;

    const [results] = await db.execute(query, [icd_code]);

    if (results.length === 0) {
      throw ApiError.notFound('Diagnosis');
    }

    return results[0];
  }

  static async saveCustomDiagnosis({ diagnosis_name, icd_code, doctorId }) {
    if (!diagnosis_name || !diagnosis_name.trim()) {
      throw ApiError.badRequest('Diagnosis name is required');
    }

    const db = getDb();
    await db.query(
      `INSERT INTO doctor_diagnoses (doctor_id, diagnosis_name, icd_code, usage_count)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE usage_count = usage_count + 1, icd_code = COALESCE(VALUES(icd_code), icd_code)`,
      [doctorId, diagnosis_name.trim(), icd_code || null]
    );

    return { success: true };
  }

  static async getFrequentlyUsedDiagnoses({ doctorId, limit = 10 }) {
    if (!doctorId) return { diagnoses: [] };
    const db = getDb();
    const limitNum = Math.min(parseInt(limit, 10) || 10, 20);
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS doctor_diagnoses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          doctor_id INT NOT NULL,
          icd_code VARCHAR(20) DEFAULT NULL,
          diagnosis_name VARCHAR(255) NOT NULL,
          usage_count INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_doctor_diag (doctor_id, icd_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (_) { /* ignore if table already exists */ }

    const [rows] = await db.execute(
      `SELECT diagnosis_name, icd_code, usage_count
       FROM doctor_diagnoses
       WHERE doctor_id = ?
       ORDER BY usage_count DESC, created_at DESC
       LIMIT ${limitNum}`,
      [doctorId]
    );
    return { diagnoses: rows || [] };
  }

  /**
   * Auto-find ICD code for a diagnosis name
   * Searches icd_codes table for matching diagnosis name
   * Returns the best matching ICD code or null
   */
  static async autoFindIcdCode({ diagnosis_name }) {
    if (!diagnosis_name || !diagnosis_name.trim()) {
      return null;
    }

    const db = getDb();
    const searchTerm = diagnosis_name.trim().toLowerCase();

    try {
      // First try exact match on primary_description
      const [exactMatch] = await db.execute(
        `SELECT icd_code FROM icd_codes 
         WHERE LOWER(primary_description) = ?
         LIMIT 1`,
        [searchTerm]
      );

      if (exactMatch && exactMatch.length > 0) {
        return exactMatch[0].icd_code;
      }

      // Try partial match (starts with)
      const [partialMatch] = await db.execute(
        `SELECT icd_code FROM icd_codes 
         WHERE LOWER(primary_description) LIKE ?
         LIMIT 1`,
        [`${searchTerm}%`]
      );

      if (partialMatch && partialMatch.length > 0) {
        return partialMatch[0].icd_code;
      }

      // Try keywords match (word contains)
      const [keywordMatch] = await db.execute(
        `SELECT icd_code FROM icd_codes 
         WHERE LOWER(primary_description) LIKE ? 
            OR LOWER(secondary_description) LIKE ?
         LIMIT 1`,
        [`%${searchTerm}%`, `%${searchTerm}%`]
      );

      if (keywordMatch && keywordMatch.length > 0) {
        return keywordMatch[0].icd_code;
      }

      return null;
    } catch (err) {
      console.error('Error auto-finding ICD code:', err.message);
      return null;
    }
  }
}

module.exports = DiagnosisService;
