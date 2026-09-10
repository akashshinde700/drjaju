const snomedService = require('../services/snomedService');
const { getDb } = require('../config/db');

exports.search = async (req, res, next) => {
  try {
    const { q, limit, offset, lang, semanticTag, ecl } = req.query;
    if (!q || !String(q).trim()) {
      return res.status(400).json({ success: false, error: 'Query text (q) is required for SNOMED search' });
    }
    const data = await snomedService.searchConcepts({
      term: q,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      language: lang || 'en',
      semanticFilter: semanticTag,
      ecl,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getConcept = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lang } = req.query;
    const data = await snomedService.getConcept(id, { language: lang || 'en' });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.validate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isValid = await snomedService.validateConcept(id);
    res.json({ id, valid: isValid });
  } catch (err) {
    next(err);
  }
};

exports.mapToICD10 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await snomedService.mapToICD10(id);

    // Cache to local DB for faster future lookups
    try {
      const db = getDb();
      for (const m of data) {
        if (!m.code) continue;
        await db.execute(
          `INSERT INTO snomed_icd10_map (snomed_concept_id, icd10_code, map_group, map_priority, map_rule, map_advice, correlation_id, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE
             map_group = VALUES(map_group),
             map_priority = VALUES(map_priority),
             map_rule = VALUES(map_rule),
             map_advice = VALUES(map_advice),
             correlation_id = VALUES(correlation_id),
             is_active = 1`,
          [
            id,
            m.code,
            m.mapGroup || 1,
            m.mapPriority || 1,
            m.mapRule || null,
            m.mapAdvice || null,
            m.correlationId || null
          ]
        );
      }
    } catch (e) {
      // non-fatal
      console.warn('ICD10 map caching failed:', e.message);
    }

    res.json({ success: true, items: data });
  } catch (err) {
    next(err);
  }
};

exports.ecl = async (req, res, next) => {
  try {
    const { ecl, limit, offset } = req.query;
    if (!ecl || !String(ecl).trim()) {
      return res.status(400).json({ success: false, error: 'ECL expression (ecl) is required' });
    }
    const data = await snomedService.eclQuery(ecl, { limit: limit ? parseInt(limit, 10) : 50, offset: offset ? parseInt(offset, 10) : 0 });
    res.json(data);
  } catch (err) {
    next(err);
  }
};
