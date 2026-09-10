/**
 * ICD Controller
 * Handles ICD code search, lookup, and related data endpoints
 */

const {
  searchICD11,
  getICD11Code,
  searchICD10Local,
  getICD10CodeLocal,
  searchICD11Local,
  getICD11CodeLocal,
  searchICDAll,
} = require('../services/icdService');
const { getDb } = require('../config/db');
const axios = require('axios');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHelper');

/**
 * GET /api/icd/search?q=fever&version=icd11&chapter=mms&linearization=2024-01
 * For ICD-10, use version=icd10 (searches local DB)
 * For ICD-11 local, use version=icd11local (searches local DB)
 * For all (both ICD-10 and ICD-11 local), use version=all
 */
async function searchICD(req, res) {
  try {
    const { q, chapter, linearization, version = 'icd10', limit, offset } = req.query;

    if (!q || !String(q).trim()) {
      return sendValidationError(res, 'Query text (q) is required for ICD search');
    }

    // Search all local ICD data (ICD-10 and ICD-11)
    if (version === 'all') {
      const data = await searchICDAll(q, { limit: limit ? parseInt(limit, 10) : 20, offset: offset ? parseInt(offset, 10) : 0 });
      return sendSuccess(res, data, 'ICD search completed');
    }

    // Search ICD-10 local database
    if (version === 'icd10') {
      const data = await searchICD10Local(q, { limit: limit ? parseInt(limit, 10) : 20, offset: offset ? parseInt(offset, 10) : 0 });
      return sendSuccess(res, data, 'ICD-10 search completed');
    }

    // Search ICD-11 local database
    if (version === 'icd11local') {
      const data = await searchICD11Local(q, { limit: limit ? parseInt(limit, 10) : 20, offset: offset ? parseInt(offset, 10) : 0 });
      return sendSuccess(res, data, 'ICD-11 local search completed');
    }

    // Search ICD-11 via WHO API
    const data = await searchICD11(q, {
      chapter,
      linearization,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    sendSuccess(res, data, 'ICD-11 search completed');
  } catch (err) {
    sendError(res, err.message || 'ICD search failed', err.status || 500, err.message);
  }
}

/**
 * GET /api/icd/code/:id?version=icd11|icd10|icd11local
 */
async function getICDCode(req, res) {
  try {
    const { id } = req.params;
    const { version = 'icd11', chapter, linearization } = req.query;

    if (version === 'icd10') {
      const data = await getICD10CodeLocal(id);
      return sendSuccess(res, { data }, 'ICD-10 code retrieved');
    }

    if (version === 'icd11local') {
      const data = await getICD11CodeLocal(id);
      return sendSuccess(res, { data }, 'ICD-11 local code retrieved');
    }

    const data = await getICD11Code(id, { chapter, linearization });
    sendSuccess(res, { data }, 'ICD-11 code retrieved');
  } catch (err) {
    sendError(res, err.message || 'ICD code lookup failed', err.status || 500, err.message);
  }
}

/**
 * Admin-only bulk refresh of ICD dataset
 * POST /api/icd/admin/refresh?version=icd10|icd11
 */
async function refreshICDData(req, res) {
  const { version } = req.query;
  if (!version || !['icd10', 'icd11'].includes(version)) {
    return sendValidationError(res, "version query param required: 'icd10' | 'icd11'");
  }

  try {
    const sourceUrl = version === 'icd10' ? process.env.ICD10_SOURCE_URL : process.env.ICD11_SOURCE_URL;
    if (!sourceUrl) {
      return sendError(res, `Missing ${version.toUpperCase()} source URL in env`, 500);
    }

    // Download dataset (JSON array or { items: [...] })
    const response = await axios.get(sourceUrl, { timeout: 120000 });
    let items = [];
    const data = response.data;
    if (Array.isArray(data)) {
      items = data;
    } else if (data && Array.isArray(data.items)) {
      items = data.items;
    } else if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) { items = data[k]; break; }
      }
    }

    if (!items || items.length === 0) {
      return sendValidationError(res, 'Dataset empty or unrecognized format');
    }

    const db = getDb();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS icd_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(10) NOT NULL,
        code VARCHAR(64) NOT NULL,
        title TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_version_code (version, code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    let inserted = 0, updated = 0, skipped = 0, errors = 0;
    for (const it of items) {
      const code = (it.code || it.id || '').toString().trim();
      const title = (it.title || it.bestTitle || it.name || '').toString().trim();
      if (!code) { skipped++; continue; }
      try {
        const [result] = await db.execute(
          `INSERT INTO icd_codes (version, code, title) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = CURRENT_TIMESTAMP`,
          [version, code, title]
        );
        if (result.affectedRows === 1) inserted++; else updated++;
      } catch (e) {
        errors++;
      }
    }

    sendSuccess(res, { version, count: items.length, inserted, updated, skipped, errors }, 'ICD data refresh completed');
  } catch (err) {
    sendError(res, err.message || 'ICD refresh failed', 500, err.message);
  }
}

/**
 * Get related symptoms, diagnoses, and medications for an ICD code (DB-driven)
 * GET /api/icd/:code/related?limit=20
 */
async function getICDRelated(req, res) {
  try {
    const { code } = req.params;
    const { limit = 20 } = req.query;

    if (!code) {
      return sendValidationError(res, 'ICD code is required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    // Heuristic: prefer local ICD-11 if the code exists in icd11_codes
    let isIcd11 = false;
    try {
      const [icd11Exists] = await db.execute(
        'SELECT 1 FROM icd11_codes WHERE icd11_code = ? LIMIT 1',
        [code]
      );
      isIcd11 = Array.isArray(icd11Exists) && icd11Exists.length > 0;
    } catch (e) {
      isIcd11 = false;
    }

    // 1) Diagnosis label for this code (ICD-10 or ICD-11)
    let diagnoses = [];
    if (isIcd11) {
      try {
        const [dxRows] = await db.execute(
          `SELECT preferred_label AS diagnosis_name
             FROM icd11_codes
            WHERE icd11_code = ?
            LIMIT 1`,
          [code]
        );
        diagnoses = (dxRows || []).map(r => r.diagnosis_name).filter(Boolean);
      } catch (e) {
        diagnoses = [];
      }
    } else {
      const [diagnosisRows] = await db.execute(
        `SELECT primary_description AS diagnosis_name
           FROM icd_codes
          WHERE icd_code = ?
          LIMIT 1`,
        [code]
      );
      diagnoses = (diagnosisRows || []).map(r => r.diagnosis_name).filter(Boolean);
    }

    // 2) Symptoms/findings linked via SNOMED clinical findings table (if populated)
    const [symptomRows] = await db.query(
      `SELECT DISTINCT clinical_term
         FROM snomed_clinical_findings
        WHERE icd_code = ?
          AND finding_type IN ('Diagnosis','Symptom','Sign','Finding','Disorder','Disease')
        ORDER BY clinical_term ASC
        LIMIT ${limitNum}`,
      [code]
    );
    const symptoms = symptomRows.map(r => r.clinical_term);

    // 3) Medications mapped to this ICD (ICD-10 vs ICD-11)
    const mappingTable = isIcd11 ? 'icd11_medication_mapping' : 'icd_medication_mapping';
    const codeCol = isIcd11 ? 'icd11_code' : 'icd_code';

    const [medRows] = await db.execute(
      `SELECT DISTINCT
         m.medication_name           AS name,
         m.generic_name              AS generic_name,
         m.dosage_form               AS form,
         m.strength                  AS strength,
         m.recommended_frequency     AS frequency,
         m.recommended_duration      AS duration,
         m.recommended_route         AS route,
         m.evidence_level            AS evidence_level,
         m.guideline_source          AS guideline_source,
         m.is_first_line             AS is_first_line,
         m.priority                  AS priority,
         dr.standard_dosage          AS standard_dosage,
         dr.max_daily_dose           AS max_daily_dose
       FROM ${mappingTable} m
       LEFT JOIN dosage_references dr
         ON dr.medication_name = m.medication_name
        AND (dr.dosage_form = m.dosage_form OR m.dosage_form IS NULL)
        AND (dr.strength = m.strength OR m.strength IS NULL)
       WHERE m.${codeCol} = ?
       ORDER BY m.is_first_line DESC, m.priority ASC, m.medication_name ASC
       LIMIT ${limitNum}`,
      [code]
    );

    sendSuccess(res, {
      icd_code: code,
      symptoms,
      diagnoses,
      medications: medRows,
      counts: {
        symptoms: symptoms.length,
        diagnoses: diagnoses.length,
        medications: medRows.length
      }
    }, 'ICD related data retrieved');
  } catch (error) {
    console.error('Get ICD related data error:', error);
    sendError(res, 'Failed to get related data', 500, error.message);
  }
}

/**
 * Get medications suggested for an ICD code (DB-driven)
 * GET /api/icd/:code/medications
 */
async function getICDMedications(req, res) {
  try {
    const { code } = req.params;
    const { limit = 20 } = req.query;

    if (!code) {
      return sendValidationError(res, 'ICD code is required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    let isIcd11 = false;
    try {
      const [icd11Exists] = await db.execute(
        'SELECT 1 FROM icd11_codes WHERE icd11_code = ? LIMIT 1',
        [code]
      );
      isIcd11 = Array.isArray(icd11Exists) && icd11Exists.length > 0;
    } catch (e) {
      isIcd11 = false;
    }

    const mappingTable = isIcd11 ? 'icd11_medication_mapping' : 'icd_medication_mapping';
    const codeCol = isIcd11 ? 'icd11_code' : 'icd_code';

    const [rows] = await db.execute(
      `SELECT DISTINCT
         m.medication_name           AS name,
         m.generic_name              AS generic_name,
         m.dosage_form               AS form,
         m.strength                  AS strength,
         m.recommended_frequency     AS frequency,
         m.recommended_duration      AS duration,
         m.recommended_route         AS route,
         m.evidence_level            AS evidence_level,
         m.guideline_source          AS guideline_source,
         m.is_first_line             AS is_first_line,
         m.priority                  AS priority,
         dr.standard_dosage          AS standard_dosage,
         dr.max_daily_dose           AS max_daily_dose
       FROM ${mappingTable} m
       LEFT JOIN dosage_references dr
         ON dr.medication_name = m.medication_name
        AND (dr.dosage_form = m.dosage_form OR m.dosage_form IS NULL)
        AND (dr.strength = m.strength OR m.strength IS NULL)
       WHERE m.${codeCol} = ?
       ORDER BY m.is_first_line DESC, m.priority ASC, m.medication_name ASC
       LIMIT ${limitNum}`,
      [code]
    );

    sendSuccess(res, {
      icd_code: code,
      medications: rows,
      count: rows.length
    }, 'ICD medications retrieved');
  } catch (error) {
    console.error('Get medications for ICD error:', error);
    sendError(res, 'Failed to get medications', 500, error.message);
  }
}

module.exports = {
  searchICD,
  getICDCode,
  refreshICDData,
  getICDRelated,
  getICDMedications
};
