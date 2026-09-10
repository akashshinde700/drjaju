/**
 * SNOMED CT Local Database Controller
 *
 * API endpoints for SNOMED CT data stored in local MySQL database.
 */

const snomedLocal = require('../services/snomedLocalService');

/**
 * Search SNOMED CT concepts
 * GET /api/snomed-local/search?q=diabetes&limit=20&semanticTag=disorder
 */
exports.search = async (req, res, next) => {
  try {
    const { q, limit, offset, semanticTag, source, mode } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        items: [],
        total: 0,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0
      });
    }

    // Use LIKE search for short terms, fulltext for longer
    const searchFn = mode === 'like' || q.length < 4
      ? snomedLocal.searchConceptsLike
      : snomedLocal.searchConcepts;

    const data = await searchFn({
      term: q,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      semanticTag,
      source
    });

    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get concept by ID
 * GET /api/snomed-local/concepts/:id
 */
exports.getConcept = async (req, res, next) => {
  try {
    const { id } = req.params;

    const data = await snomedLocal.getConcept(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Validate concept exists
 * GET /api/snomed-local/validate/:id
 */
exports.validate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isValid = await snomedLocal.validateConcept(id);

    res.json({
      success: true,
      id,
      valid: isValid
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get parent concepts (Is-A relationships)
 * GET /api/snomed-local/concepts/:id/parents
 */
exports.getParents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    const data = await snomedLocal.getParents(id, {
      limit: limit ? parseInt(limit, 10) : 50
    });

    res.json({
      success: true,
      conceptId: id,
      parents: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get child concepts (Is-A relationships)
 * GET /api/snomed-local/concepts/:id/children
 */
exports.getChildren = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    const data = await snomedLocal.getChildren(id, {
      limit: limit ? parseInt(limit, 10) : 50
    });

    res.json({
      success: true,
      conceptId: id,
      children: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Search Indian drugs
 * GET /api/snomed-local/drugs?q=paracetamol&limit=20
 */
exports.searchDrugs = async (req, res, next) => {
  try {
    const { q, limit, offset } = req.query;

    if (!q || q.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    const data = await snomedLocal.searchDrugs({
      term: q,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0
    });

    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Search AYUSH medicines
 * GET /api/snomed-local/ayush?q=ashwagandha&category=Ayurveda&limit=20
 */
exports.searchAyush = async (req, res, next) => {
  try {
    const { q, category, limit, offset } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters'
      });
    }

    const data = await snomedLocal.searchAyush({
      term: q,
      category,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0
    });

    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Map SNOMED concept to ICD-10
 * GET /api/snomed-local/map/icd10/:id
 */
exports.mapToICD10 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await snomedLocal.mapToICD10(id);

    res.json({
      success: true,
      conceptId: id,
      icd10Mappings: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get available semantic tags
 * GET /api/snomed-local/semantic-tags
 */
exports.getSemanticTags = async (req, res, next) => {
  try {
    const data = await snomedLocal.getSemanticTags();

    res.json({
      success: true,
      tags: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get import statistics
 * GET /api/snomed-local/stats
 */
exports.getImportStats = async (req, res, next) => {
  try {
    const data = await snomedLocal.getImportStats();

    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    next(err);
  }
};
