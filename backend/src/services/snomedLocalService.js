/**
 * SNOMED CT Local Database Service (schema-aligned)
 *
 * Uses tables from patient_management.sql:
 *  - snomed_concepts
 *  - snomed_descriptions
 *  - snomed_relationships
 *  - snomed_crossreferences
 *  - snomed_medications
 *  - snomed_clinical_findings
 */

const { getDb } = require('../config/db');

function extractSemanticTag(fsn) {
  if (!fsn) return null;
  const i = fsn.lastIndexOf('(');
  const j = fsn.lastIndexOf(')');
  if (i !== -1 && j !== -1 && j > i) {
    return fsn.substring(i + 1, j).trim();
  }
  return null;
}

/**
 * Search SNOMED concepts via LIKE on descriptions
 * Uses db.query instead of db.execute to avoid mysql2 parameter binding issues with LIMIT/OFFSET
 */
async function searchConcepts({ term, limit = 20, offset = 0, semanticTag, activeOnly = true }) {
  if (!term || term.length < 1) {
    return { items: [], total: 0, limit, offset };
  }
  const db = getDb();
  const mysql = require('mysql2');

  const like = `%${term}%`;
  const whereActive = activeOnly ? 'AND c.concept_status = 1 AND d.is_active = 1' : '';
  const tagFilter = semanticTag ? `AND (c.fsn LIKE ${mysql.escape('%(' + semanticTag + ')%')})` : '';
  const lim = parseInt(limit, 10) || 20;
  const off = parseInt(offset, 10) || 0;

  const sql = `SELECT DISTINCT c.snomed_id, c.fsn, c.preferred_term
     FROM snomed_descriptions d
     JOIN snomed_concepts c ON c.snomed_id = d.snomed_id
    WHERE d.description_text LIKE ${mysql.escape(like)}
      ${whereActive} ${tagFilter}
    ORDER BY CASE WHEN c.preferred_term LIKE ${mysql.escape(term + '%')} THEN 0 ELSE 1 END, LENGTH(c.preferred_term)
    LIMIT ${lim} OFFSET ${off}`;

  const [rows] = await db.query(sql).catch(err => {
    console.error('SNOMED searchConcepts SQL error:', err);
    throw err;
  });

  const items = rows.map(r => ({
    conceptId: String(r.snomed_id),
    fsn: { term: r.fsn },
    pt: { term: r.preferred_term || r.fsn },
    semanticTag: extractSemanticTag(r.fsn),
    active: true
  }));

  return { items, total: items.length, limit: lim, offset: off };
}

/**
 * LIKE search for short terms
 */
async function searchConceptsLike({ term, limit = 20, offset = 0, semanticTag, activeOnly = true }) {
  // Same implementation as searchConcepts (both use LIKE now)
  return searchConcepts({ term, limit, offset, semanticTag, activeOnly });
}

/**
 * Concept details
 */
async function getConcept(conceptId) {
  if (!conceptId) throw new Error('conceptId is required');
  const db = getDb();

  const [[c]] = await db.execute(
    `SELECT snomed_id, fsn, preferred_term, concept_status
       FROM snomed_concepts WHERE snomed_id = ? LIMIT 1`,
    [conceptId]
  );
  if (!c) return null;

  const [desc] = await db.execute(
    `SELECT description_id, description_text, description_type, language_code, is_active, effective_time
       FROM snomed_descriptions WHERE snomed_id = ?`,
    [conceptId]
  );

  return {
    conceptId: String(c.snomed_id),
    fsn: { term: c.fsn },
    pt: { term: c.preferred_term || c.fsn },
    semanticTag: extractSemanticTag(c.fsn),
    active: c.concept_status === 1,
    descriptions: desc.map(d => ({
      id: String(d.description_id),
      term: d.description_text,
      type: d.description_type,
      lang: d.language_code,
      active: d.is_active === 1,
      effective_time: d.effective_time
    }))
  };
}

/** Validate concept active */
async function validateConcept(conceptId) {
  if (!conceptId) return false;
  const db = getDb();
  const [[row]] = await db.execute(
    `SELECT 1 FROM snomed_concepts WHERE snomed_id = ? AND concept_status = 1 LIMIT 1`,
    [conceptId]
  );
  return !!row;
}

/** Parents (Is-A) */
async function getParents(conceptId, { limit = 50 } = {}) {
  const db = getDb();
  const IS_A = 116680003;
  const lim = parseInt(limit, 10) || 50;
  const [rows] = await db.query(
    `SELECT c.snomed_id, c.fsn, c.preferred_term
       FROM snomed_relationships r
       JOIN snomed_concepts c ON c.snomed_id = r.target_id
      WHERE r.source_id = ? AND r.relationship_type_id = ? AND r.is_active = 1
      LIMIT ${lim}`,
    [conceptId, IS_A]
  );
  return rows.map(r => ({
    conceptId: String(r.snomed_id),
    fsn: { term: r.fsn },
    pt: { term: r.preferred_term || r.fsn },
    semanticTag: extractSemanticTag(r.fsn)
  }));
}

/** Children (Is-A) */
async function getChildren(conceptId, { limit = 50 } = {}) {
  const db = getDb();
  const IS_A = 116680003;
  const lim = parseInt(limit, 10) || 50;
  const [rows] = await db.query(
    `SELECT c.snomed_id, c.fsn, c.preferred_term
       FROM snomed_relationships r
       JOIN snomed_concepts c ON c.snomed_id = r.source_id
      WHERE r.target_id = ? AND r.relationship_type_id = ? AND r.is_active = 1
      LIMIT ${lim}`,
    [conceptId, IS_A]
  );
  return rows.map(r => ({
    conceptId: String(r.snomed_id),
    fsn: { term: r.fsn },
    pt: { term: r.preferred_term || r.fsn },
    semanticTag: extractSemanticTag(r.fsn)
  }));
}

/** Search drugs (snomed_medications) */
async function searchDrugs({ term, limit = 20, offset = 0 }) {
  if (!term || term.length < 1) return { items: [], total: 0, limit, offset };
  const db = getDb();
  const mysql = require('mysql2');
  const like = `%${term}%`;
  const lim = parseInt(limit, 10) || 20;
  const off = parseInt(offset, 10) || 0;

  // First try medicines_consolidated (761K Indian brands) ← PRIORITY
  // Uses prefix matching (name LIKE 'dol%') to leverage indexes on 761K rows
  const startsWith = `${term}%`;
  let consolidatedRows = [];
  try {
    const [rows] = await db.query(
      `(
        SELECT id as snomed_id, name as medication_name, manufacturer_name as brand_name, 
               salt_composition as substance_name, pack_size_label as strength, type as dose_form,
               'consolidated' as source
        FROM medicines_consolidated
        WHERE is_discontinued = 0 AND name LIKE ${mysql.escape(startsWith)}
        ORDER BY LENGTH(name)
        LIMIT ${lim}
      )
      UNION
      (
        SELECT id as snomed_id, name as medication_name, manufacturer_name as brand_name, 
               salt_composition as substance_name, pack_size_label as strength, type as dose_form,
               'consolidated' as source
        FROM medicines_consolidated
        WHERE is_discontinued = 0
          AND name NOT LIKE ${mysql.escape(startsWith)}
          AND (salt_composition LIKE ${mysql.escape(startsWith)}
            OR manufacturer_name LIKE ${mysql.escape(startsWith)})
        ORDER BY LENGTH(name)
        LIMIT ${lim}
      )
      ORDER BY CASE WHEN medication_name LIKE ${mysql.escape(startsWith)} THEN 0 ELSE 1 END, LENGTH(medication_name)
      LIMIT ${lim} OFFSET ${off}`
    );
    consolidatedRows = rows;
  } catch (e) {
    console.error('Consolidated drugs search error:', e);
  }

  // Then snomed_medications (47K SNOMED drugs)
  let snomedRows = [];
  try {
    const [rows] = await db.query(
      `SELECT snomed_id, medication_name, brand_name, substance_name, 
              CONCAT(COALESCE(strength_value,''), ' ', COALESCE(strength_unit,'')) as strength, 
              dose_form,
              'snomed' as source
       FROM snomed_medications
       WHERE is_active = 1 AND (
             medication_name LIKE ${mysql.escape(like)} 
             OR brand_name LIKE ${mysql.escape(like)} 
             OR substance_name LIKE ${mysql.escape(like)}
       )
       ORDER BY CASE WHEN medication_name LIKE ${mysql.escape(term + '%')} THEN 0 ELSE 1 END, LENGTH(medication_name)
       LIMIT ${lim} OFFSET ${off}`
    );
    snomedRows = rows;
  } catch (e) {
    console.error('SNOMED drugs search error:', e);
  }

  // Combine results (no dedup - show both sources)
  const allRows = [...consolidatedRows, ...snomedRows];
  
  return {
    items: allRows.map(r => ({
      conceptId: String(r.snomed_id),
      drugName: r.medication_name,
      brandName: r.brand_name,
      genericName: r.substance_name,
      strength: r.strength ? r.strength.trim() : null,
      dosageForm: r.dose_form,
      source: r.source || 'snomed'
    })),
    total: allRows.length, 
    limit: lim, 
    offset: off
  };
}

/** Search AYUSH medicines */
async function searchAyush({ term, category, limit = 20, offset = 0 }) {
  if (!term || term.length < 1) return { items: [], total: 0, limit, offset };
  const db = getDb();
  const mysql = require('mysql2');
  const like = `%${term}%`;
  const lim = parseInt(limit, 10) || 20;
  const off = parseInt(offset, 10) || 0;

  let catFilter = '';
  if (category) {
    catFilter = `AND category = ${mysql.escape(category)}`;
  }

  const sql = `SELECT id, name, category, composition, usage_description, dosage, side_effects
     FROM ayush_medicines
    WHERE (name LIKE ${mysql.escape(like)} OR composition LIKE ${mysql.escape(like)})
      ${catFilter}
    ORDER BY CASE WHEN name LIKE ${mysql.escape(term + '%')} THEN 0 ELSE 1 END, LENGTH(name)
    LIMIT ${lim} OFFSET ${off}`;

  try {
    const [rows] = await db.query(sql);
    return {
      items: rows.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        composition: r.composition,
        usage: r.usage_description,
        dosage: r.dosage,
        sideEffects: r.side_effects
      })),
      total: rows.length, limit: lim, offset: off
    };
  } catch (err) {
    console.error('AYUSH search error:', err);
    return { items: [], total: 0, limit: lim, offset: off };
  }
}

/** Map SNOMED concept to ICD-10 */
async function mapToICD10(conceptId) {
  const db = getDb();
  const [rows] = await db.execute(
    `SELECT target_code, target_description, mapping_type, correlation
       FROM snomed_crossreferences
      WHERE snomed_id = ? AND target_system = 'ICD-10'`,
    [conceptId]
  );
  return rows.map(r => ({
    code: r.target_code,
    description: r.target_description,
    type: r.mapping_type,
    correlation: r.correlation
  }));
}

/** Get semantic tags */
async function getSemanticTags() {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT DISTINCT
       SUBSTRING(fsn, LOCATE('(', fsn, LENGTH(fsn) - LOCATE('(', REVERSE(fsn))) + 1,
         LOCATE(')', fsn, LENGTH(fsn) - LOCATE(')', REVERSE(fsn))) - LOCATE('(', fsn, LENGTH(fsn) - LOCATE('(', REVERSE(fsn))) - 1
       ) as tag
     FROM snomed_concepts
     WHERE fsn LIKE '%(%)%' AND concept_status = 1
     LIMIT 100`
  );
  return rows.map(r => r.tag).filter(Boolean);
}

/** Import stats */
async function getImportStats() {
  const db = getDb();
  const tables = ['snomed_concepts', 'snomed_descriptions', 'snomed_relationships', 'snomed_crossreferences', 'snomed_medications', 'snomed_clinical_findings'];
  const stats = {};
  for (const t of tables) {
    try {
      const [[row]] = await db.query(`SELECT COUNT(*) as cnt FROM ${t}`);
      stats[t] = row.cnt;
    } catch {
      stats[t] = 0;
    }
  }
  return { tables: stats };
}

module.exports = {
  searchConcepts,
  searchConceptsLike,
  getConcept,
  validateConcept,
  getParents,
  getChildren,
  searchDrugs,
  searchAyush,
  mapToICD10,
  getSemanticTags,
  getImportStats,
};
