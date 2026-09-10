/**
 * Medications Controller (schema-aligned)
 *
 * Rewritten to use actual schema tables:
 *  - medicines
 *  - dosage_references
 *  - icd_medication_mapping
 *  - symptom_medication_mapping
 *  - prescription_items
 */

const { getDb } = require('../config/db');

// In-memory search cache for medicine queries (medicines rarely change)
const medSearchCache = new Map();
const MED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
function getCachedMedSearch(key) {
  const cached = medSearchCache.get(key);
  if (cached && Date.now() - cached.ts < MED_CACHE_TTL) return cached.data;
  return null;
}
function setCachedMedSearch(key, data) {
  // Limit cache size to 200 entries
  if (medSearchCache.size >= 200) {
    const firstKey = medSearchCache.keys().next().value;
    medSearchCache.delete(firstKey);
  }
  medSearchCache.set(key, { data, ts: Date.now() });
}

/**
 * Helper: pick one best dosage record for given med name/form/strength
 */
async function pickBestDosage(db, name, form, strength) {
  const [rows] = await db.execute(
    `SELECT standard_dosage, max_daily_dose, recommended_frequency, recommended_duration,
            route_of_administration, notes
       FROM dosage_references
      WHERE medication_name = ?
        AND (dosage_form = ? OR ? IS NULL)
        AND (strength = ? OR ? IS NULL)
      ORDER BY FIELD(age_group,'Adult','All','Adolescent','Geriatric','Child','Infant','Neonate') ASC,
               evidence_level ASC
      LIMIT 1`,
    [name, form, form, strength, strength]
  );
  return rows && rows[0] ? rows[0] : null;
}

/**
 * Search medications by name or brand from consolidated database (all Indian brands)
 * GET /api/medications/search?q=paracetamol&limit=20&type=TABLETS
 * Supports searching from medicines_consolidated table with 765,000+ medicines
 */
exports.searchMedications = async (req, res) => {
  try {
    const { q, limit = 20, offset = 0, type } = req.query;

    if (!q || q.trim().length < 3) {
      return res.json({ medications: [] });
    }

    // Check cache first
    const cacheKey = `${q.trim().toLowerCase()}|${type || ''}|${limit}|${offset}`;
    const cachedResult = getCachedMedSearch(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const db = getDb();
    const searchTermLike = `%${q}%`;
    const searchTermStartsWith = `${q.trim()}%`;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);
    const fetchLimit = limitNum + 1;

    // UNION query: consolidated uses prefix-only matching (name LIKE 'term%') for index usage
    // Medicines table (small) uses contains matching
    let query = `
      (
        SELECT 
          mc.id,
          mc.name,
          mc.salt_composition AS generic,
          mc.manufacturer_name AS brand,
          mc.pack_size_label AS strength,
          mc.type AS form,
          mc.price,
          mc.type AS medicine_type,
          mc.short_composition1,
          mc.short_composition2,
          mc.chemical_class,
          mc.action_class,
          mc.manufacturer_name,
          'consolidated' as source
        FROM medicines_consolidated mc
        WHERE mc.is_discontinued = 0
          AND mc.name LIKE ?
      )
      UNION
      (
        SELECT 
          m.id,
          m.name,
          m.generic_name AS generic,
          m.brand,
          m.strength,
          m.dosage_form AS form,
          NULL as price,
          m.category AS medicine_type,
          NULL as short_composition1,
          NULL as short_composition2,
          m.category AS chemical_class,
          m.therapeutic_class AS action_class,
          m.manufacturer AS manufacturer_name,
          'medicines' as source
        FROM medicines m
        WHERE m.is_active = 1
          AND (
            m.name LIKE ? 
            OR m.generic_name LIKE ? 
            OR m.brand LIKE ?
          )
      )
      ORDER BY 
        CASE WHEN name LIKE ? THEN 0 ELSE 1 END,
        LENGTH(name) ASC
      LIMIT ? OFFSET ?
    `;

    let params = [
      searchTermStartsWith,
      searchTermLike, searchTermLike, searchTermLike,
      searchTermStartsWith, fetchLimit, offsetNum
    ];

    if (type && type.trim()) {
      query = `
        (
          SELECT 
            mc.id,
            mc.name,
            mc.salt_composition AS generic,
            mc.manufacturer_name AS brand,
            mc.pack_size_label AS strength,
            mc.type AS form,
            mc.price,
            mc.type AS medicine_type,
            mc.short_composition1,
            mc.short_composition2,
            mc.chemical_class,
            mc.action_class,
            mc.manufacturer_name,
            'consolidated' as source
          FROM medicines_consolidated mc
          WHERE mc.is_discontinued = 0
            AND UPPER(TRIM(mc.type)) = UPPER(?)
            AND mc.name LIKE ?
        )
        UNION
        (
          SELECT 
            m.id,
            m.name,
            m.generic_name AS generic,
            m.brand,
            m.strength,
            m.dosage_form AS form,
            NULL as price,
            m.category AS medicine_type,
            NULL as short_composition1,
            NULL as short_composition2,
            m.category AS chemical_class,
            m.therapeutic_class AS action_class,
            m.manufacturer AS manufacturer_name,
            'medicines' as source
          FROM medicines m
          WHERE m.is_active = 1
            AND (
              m.name LIKE ? 
              OR m.generic_name LIKE ? 
              OR m.brand LIKE ?
            )
        )
        ORDER BY 
          CASE WHEN name LIKE ? THEN 0 ELSE 1 END,
          LENGTH(name) ASC
        LIMIT ? OFFSET ?
      `;
      params = [
        type.trim(), searchTermStartsWith,
        searchTermLike, searchTermLike, searchTermLike,
        searchTermStartsWith, fetchLimit, offsetNum
      ];
    }

    const [medications] = await db.execute(query, params);

    // Use LIMIT+1 trick to determine hasMore without expensive COUNT query
    const hasMoreResults = medications.length > limitNum;
    if (hasMoreResults) medications.pop();

    // Helper: extract dosage form from medicine name
    const extractDosageForm = (name, formField) => {
      if (!name) return formField || '';
      const n = name.toUpperCase();
      if (n.includes('TABLET') || n.includes(' TAB ') || n.endsWith(' TAB')) return 'tablet';
      if (n.includes('CAPSULE') || n.includes(' CAP ') || n.endsWith(' CAP')) return 'capsule';
      if (n.includes('SYRUP') || n.includes('SUSPENSION') || n.includes('ORAL SOLUTION')) return 'syrup';
      if (n.includes('INJECTION') || n.includes(' INJ') || n.includes('INFUSION')) return 'injection';
      if (n.includes('EYE DROP') || n.includes('EAR DROP') || n.includes(' DROPS')) return 'drops';
      if (n.includes('INHALER') || n.includes('ROTACAP') || n.includes('RESPULE')) return 'inhaler';
      if (n.includes('CREAM') || n.includes('OINTMENT') || n.includes(' GEL') || n.includes('LOTION')) return 'cream';
      if (n.includes('SACHET') || n.includes('POWDER')) return 'sachet';
      if (n.includes('MOUTH WASH') || n.includes('MOUTHWASH')) return 'mouth wash';
      if (n.includes('SPRAY')) return 'spray';
      return formField || '';
    };

    // Transform response to match expected format
    const transformedMedications = medications.map(med => {
      const composition = [med.short_composition1, med.short_composition2]
        .map(c => (c || '').trim()).filter(Boolean).join(' + ');
      return {
        id: med.id,
        name: med.name,
        generic: med.generic,
        brand: med.brand,
        strength: med.strength,
        form: med.form,
        dosage_form: extractDosageForm(med.name, med.form),
        type: med.medicine_type,
        price: med.price,
        composition: composition || med.generic || '',
        short_composition1: (med.short_composition1 || '').trim(),
        short_composition2: (med.short_composition2 || '').trim(),
        manufacturer_name: med.manufacturer_name,
        category: med.chemical_class,
        therapeutic_class: med.action_class,
        source: med.source // 'consolidated' or 'medicines'
      };
    });

    const result = {
      medications: transformedMedications,
      total: transformedMedications.length + offsetNum + (hasMoreResults ? 1 : 0),
      limit: limitNum,
      offset: offsetNum,
      hasMore: hasMoreResults
    };
    setCachedMedSearch(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Search medications error:', error);
    res.status(500).json({ 
      error: 'Failed to search medications',
      details: error.message 
    });
  }
};

/**
 * Get medications by diagnosis (ICD code)
 * GET /api/medications/by-diagnosis?icd_code=I10&limit=10
 */
exports.getMedicationsByDiagnosis = async (req, res) => {
  try {
    const { icd_code, limit = 10 } = req.query;
    if (!icd_code) return res.status(400).json({ error: 'ICD code is required' });

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    const [medications] = await db.execute(
      `SELECT DISTINCT
         m.medication_name           AS name,
         m.generic_name              AS generic,
         m.dosage_form               AS form,
         m.strength                  AS strength,
         m.recommended_frequency     AS frequency,
         m.recommended_duration      AS duration,
         m.recommended_route         AS route,
         m.evidence_level            AS evidence_level,
         dr.standard_dosage          AS dosage,
         dr.max_daily_dose           AS max_dose
       FROM icd_medication_mapping m
       LEFT JOIN dosage_references dr
         ON dr.medication_name = m.medication_name
        AND (dr.dosage_form = m.dosage_form OR m.dosage_form IS NULL)
        AND (dr.strength = m.strength OR m.strength IS NULL)
       WHERE m.icd_code = ?
       ORDER BY m.is_first_line DESC, m.priority ASC, m.medication_name ASC
       LIMIT ?`,
      [icd_code, limitNum]
    );

    res.json({ icd_code, medications, count: medications.length });
  } catch (error) {
    console.error('Get medications by diagnosis error:', error);
    res.status(500).json({ error: 'Failed to get medications', details: error.message });
  }
};

/**
 * Get medications by symptom
 * GET /api/medications/by-symptom?symptom=fever&limit=10
 */
exports.getMedicationsBySymptom = async (req, res) => {
  try {
    const { symptom, limit = 10 } = req.query;
    if (!symptom) return res.status(400).json({ error: 'Symptom is required' });

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    const [medications] = await db.execute(
      `SELECT DISTINCT 
         smm.medication_name AS name,
         dr.dosage_form      AS form,
         dr.strength         AS strength,
         dr.recommended_frequency AS frequency,
         dr.recommended_duration  AS duration,
         dr.route_of_administration AS route,
         smm.severity_level,
         smm.recommendation_priority AS priority
       FROM symptom_medication_mapping smm
       LEFT JOIN dosage_references dr
         ON dr.medication_name = smm.medication_name
       WHERE LOWER(smm.symptom_name) = LOWER(?)
       ORDER BY smm.recommendation_priority ASC, smm.medication_name ASC
       LIMIT ?`,
      [symptom, limitNum]
    );

    res.json({ symptom, medications, count: medications.length });
  } catch (error) {
    console.error('Get medications by symptom error:', error);
    res.status(500).json({ error: 'Failed to get medications', details: error.message });
  }
};

/**
 * Get treatment protocol for specific condition (category)
 * GET /api/medications/protocol/:type
 */
exports.getMedicationProtocol = async (req, res) => {
  try {
    const { type } = req.params;
    if (!type) return res.status(400).json({ error: 'Protocol type is required' });

    const db = getDb();

    const [medications] = await db.execute(
      `SELECT DISTINCT
         dr.medication_name AS name,
         dr.dosage_form     AS form,
         dr.strength        AS strength,
         dr.route_of_administration AS route,
         dr.recommended_frequency AS frequency,
         dr.recommended_duration  AS duration,
         dr.standard_dosage       AS dosage,
         dr.max_daily_dose        AS max_dose,
         dr.notes,
         dr.therapeutic_category  AS category
       FROM dosage_references dr
       WHERE LOWER(dr.therapeutic_category) = LOWER(?) OR LOWER(dr.category) = LOWER(?)
       ORDER BY dr.medication_name ASC`,
      [type, type]
    );

    res.json({ protocol: type, medications, count: medications.length });
  } catch (error) {
    console.error('Get medication protocol error:', error);
    res.status(500).json({ error: 'Failed to get protocol medications', details: error.message });
  }
};

/**
 * Get recommended medications based on patient profile
 * GET /api/medications/recommended?age=30&gender=M&conditions=diabetes,hypertension
 */
exports.getRecommendedMedications = async (req, res) => {
  try {
    const { age, gender, conditions } = req.query;
    const db = getDb();

    const conditionList = conditions ? conditions.split(',').map(c => c.trim()).filter(Boolean) : [];

    let query = `SELECT DISTINCT
                   dr.medication_name AS name,
                   dr.dosage_form     AS form,
                   dr.strength        AS strength,
                   dr.recommended_frequency AS frequency,
                   dr.recommended_duration  AS duration,
                   dr.route_of_administration AS route,
                   dr.therapeutic_category    AS category
                 FROM dosage_references dr
                 WHERE 1=1`;
    const params = [];

    if (age) {
      const ageNum = parseInt(age);
      let ageGroup = 'Adult';
      if (ageNum < 2) ageGroup = 'Infant';
      else if (ageNum < 12) ageGroup = 'Child';
      else if (ageNum < 18) ageGroup = 'Adolescent';
      else if (ageNum > 60) ageGroup = 'Geriatric';
      query += ` AND (dr.age_group = ? OR dr.age_group = 'All' OR dr.age_group = 'General')`;
      params.push(ageGroup);
    }

    if (conditionList.length > 0) {
      const placeholders = conditionList.map(() => '?').join(',');
      query += ` AND dr.therapeutic_category IN (${placeholders})`;
      params.push(...conditionList);
    }

    query += ` ORDER BY dr.medication_name ASC LIMIT 50`;

    const [medications] = await db.execute(query, params);
    res.json({ medications, count: medications.length, filters: { age, gender, conditions: conditionList } });
  } catch (error) {
    console.error('Get recommended medications error:', error);
    res.status(500).json({ error: 'Failed to get recommended medications', details: error.message });
  }
};

/**
 * Get medication alternatives (brands and generics)
 * GET /api/medications/:id/alternatives
 */
exports.getMedicationAlternatives = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Get the original medicine
    const [origRows] = await db.execute(
      `SELECT id, name, generic_name, strength, dosage_form FROM medicines WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!origRows || origRows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }
    const med = origRows[0];

    // Find alternatives by same generic and strength/form
    const [alternatives] = await db.execute(
      `SELECT id, name, brand, generic_name, strength, dosage_form AS form
         FROM medicines
        WHERE is_active = 1
          AND id <> ?
          AND ((generic_name IS NOT NULL AND generic_name = ?) OR (name <> ?))
          AND (strength = ? OR ? IS NULL)
          AND (dosage_form = ? OR ? IS NULL)
        ORDER BY name ASC
        LIMIT 10`,
      [id, med.generic_name, med.name, med.strength, med.strength, med.dosage_form, med.dosage_form]
    );

    res.json({
      original: med,
      alternatives: alternatives || []
    });
  } catch (error) {
    console.error('Get alternatives error:', error);
    res.status(500).json({ error: 'Failed to get alternatives', details: error.message });
  }
};

/**
 * Get recent medications for a patient
 * GET /api/medications/patient/:patientId/recent
 */
exports.getPatientRecentMedications = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;
    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    const [medications] = await db.execute(
      `SELECT DISTINCT
         m.name,
         m.brand,
         m.generic_name AS generic,
         m.strength,
         m.dosage_form AS form,
         pi.dosage,
         pi.frequency,
         COUNT(*) AS usage_count,
         MAX(pi.created_at) AS last_used
       FROM prescription_items pi
       JOIN medicines m ON pi.medicine_id = m.id
       WHERE pi.prescription_id IN (SELECT id FROM prescriptions WHERE patient_id = ?)
       GROUP BY m.id
       ORDER BY last_used DESC, usage_count DESC
       LIMIT ?`,
      [patientId, limitNum]
    );

    res.json({ patientId, medications, count: medications.length });
  } catch (error) {
    console.error('Get patient recent medications error:', error);
    res.status(500).json({ error: 'Failed to get patient medications', details: error.message });
  }
};

/**
 * Get medication details
 * GET /api/medications/:id
 */
exports.getMedicationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Try to get from medicines_consolidated first (has all Indian brands)
    let [rows] = await db.execute(
      `SELECT 
         mc.id,
         mc.name,
         mc.manufacturer_name AS brand,
         mc.salt_composition AS generic,
         mc.pack_size_label AS strength,
         mc.type AS form,
         mc.price,
         mc.short_composition1,
         mc.short_composition2,
         mc.chemical_class,
         mc.action_class,
         mc.medicine_desc,
         mc.side_effects,
         mc.drug_interactions
       FROM medicines_consolidated mc
       WHERE mc.id = ? AND mc.is_discontinued = 0
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) {
      // Fallback to old medicines table if not found in consolidated
      [rows] = await db.execute(
        `SELECT 
           m.id,
           m.name,
           m.brand,
           m.generic_name AS generic,
           m.strength,
           m.dosage_form AS form,
           m.default_dosage,
           m.default_frequency,
           m.default_duration,
           m.default_route,
           m.category,
           m.therapeutic_class,
           m.is_active
         FROM medicines m
         WHERE m.id = ?
         LIMIT 1`,
        [id]
      );
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Medication not found' });
      }
    }

    const med = rows[0];

    res.json({
      id: med.id,
      name: med.name,
      brand: med.brand,
      generic: med.generic,
      strength: med.strength,
      form: med.form,
      price: med.price,
      category: med.category || med.chemical_class,
      therapeutic_class: med.therapeutic_class || med.action_class,
      composition: med.short_composition1 || med.short_composition2,
      description: med.medicine_desc,
      side_effects: med.side_effects,
      drug_interactions: med.drug_interactions,
      is_active: med.is_active !== undefined ? med.is_active : true
    });
  } catch (error) {
    console.error('Get medication details error:', error);
    res.status(500).json({ error: 'Failed to get medication details', details: error.message });
  }
};

/**
 * Get all medication categories and types (TABLETS, INJECTIONS, CAPSULES, etc.)
 * GET /api/medications/categories
 */
let _categoriesCache = null;
let _categoriesCacheTime = 0;
const CATEGORIES_CACHE_TTL = 10 * 60 * 1000;

exports.getMedicationCategories = async (req, res) => {
  try {
    // Cache categories for 10 minutes (expensive GROUP BY on 761K rows)
    if (_categoriesCache && Date.now() - _categoriesCacheTime < CATEGORIES_CACHE_TTL) {
      return res.json(_categoriesCache);
    }

    const db = getDb();
    
    // Run both queries in parallel
    const [typesResult, categoriesResult] = await Promise.all([
      db.execute(
        `SELECT 
           UPPER(TRIM(type)) AS category, 
           COUNT(*) AS count
         FROM medicines_consolidated
         WHERE type IS NOT NULL AND type <> '' AND is_discontinued = 0
         GROUP BY UPPER(TRIM(type))
         ORDER BY count DESC`
      ),
      db.execute(
        `SELECT category, COUNT(*) AS count
           FROM medicines
          WHERE is_active = 1 AND category IS NOT NULL AND category <> ''
          GROUP BY category
          ORDER BY category ASC`
      )
    ]);

    const [types] = typesResult;
    const [categories] = categoriesResult;

    // Combine both, preferring medicine types
    const allCategories = [
      ...types.map(t => ({ type: 'medicine_type', name: t.category, count: t.count })),
      ...categories.map(c => ({ type: 'category', name: c.category, count: c.count }))
    ];

    const responseData = { 
      categories: allCategories,
      medicineTypes: types,
      tradionalCategories: categories,
      count: types.length 
    };

    _categoriesCache = responseData;
    _categoriesCacheTime = Date.now();

    res.json(responseData);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories', details: error.message });
  }
};
