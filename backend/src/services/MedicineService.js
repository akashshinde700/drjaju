const { getDb } = require('../config/db');
const mysql = require('mysql2');
const { ApiError } = require('../utils');

class MedicineService {
  static async searchMedicines({ q, limit = 20, userId }) {
    if (!q || q.trim().length < 1) {
      return { medicines: [], total: 0, query: q };
    }

    const db = getDb();
    const searchTerm = q.trim().toLowerCase();
    // Use raw term (not LOWER'd) for LIKE — MySQL varchar ci collation is case-insensitive
    // so `name LIKE 'c%'` uses B-tree index; LOWER() prevents index usage
    const likeAny = `%${searchTerm}%`;
    const likeStart = `${searchTerm}%`;
    const limitNum = Math.min(parseInt(limit) || 50, 500);

    // FULLTEXT for >= 4 chars (innodb_ft_min_token_size is typically 4)
    const useFulltext = searchTerm.length >= 4;
    const ftTerm = searchTerm.replace(/[+\-><()*~"@]+/g, ' ').trim();
    const ftQuery = ftTerm ? `${ftTerm}*` : searchTerm;
    const shortLikeLimit = 50;

    const dosageFormCase = `CASE
            WHEN name LIKE '%tablet%' THEN 'Tablet'
            WHEN name LIKE '%capsule%' THEN 'Capsule'
            WHEN name LIKE '%syrup%' OR name LIKE '%suspension%' THEN 'Syrup'
            WHEN name LIKE '%injection%' OR name LIKE '%inj%' THEN 'Injection'
            WHEN name LIKE '%cream%' OR name LIKE '%ointment%' THEN 'Topical'
            WHEN name LIKE '%drops%' THEN 'Drops'
            WHEN name LIKE '%inhaler%' THEN 'Inhaler'
            WHEN type IS NOT NULL AND type != '' THEN type
            ELSE pack_size_label
          END as dosage_form`;

    const bigTableCols = (source) => `id, name, name as brand, manufacturer_name, type, price, habit_forming,
          CONCAT(
            COALESCE(TRIM(short_composition1), ''),
            IF(short_composition2 IS NOT NULL AND TRIM(short_composition2) != '',
               CONCAT(' + ', TRIM(short_composition2)), '')
          ) as generic_name,
          pack_size_label as strength,
          ${dosageFormCase},
          short_composition1, short_composition2,
          medicine_desc as description, side_effects, drug_interactions,
          chemical_class, action_class, '${source}' as source`;

    // Run ALL queries in PARALLEL — eliminates sequential 150ms × N round trips
    const [
      [localRows],
      [dosageRows],
      [consolidatedRows],
      [allopathyRows],
      [cMfrRows],
      [aMfrRows],
      [snomedRows],
    ] = await Promise.all([
      // 1. Local medicines (doctor-specific usage data)
      db.query(
        `SELECT m.id, m.name, m.generic_name, m.composition, m.strength, m.dosage_form, m.brand,
          m.default_frequency, m.default_timing, m.default_duration, m.default_instructions,
          m.usage_count as global_usage, COALESCE(fu.usage_count, 0) as doctor_usage, 'local' as source
        FROM medicines m
        LEFT JOIN frequently_used fu ON m.id = fu.item_id
          AND fu.user_id = ${mysql.escape(userId)} AND fu.item_type = 'medicine'
        WHERE m.is_active = 1
          AND (m.name LIKE ${mysql.escape(likeAny)}
            OR m.generic_name LIKE ${mysql.escape(likeAny)}
            OR m.brand LIKE ${mysql.escape(likeAny)}
            OR m.composition LIKE ${mysql.escape(likeAny)}
            OR m.search_text LIKE ${mysql.escape(likeAny)})
        ORDER BY CASE WHEN fu.usage_count IS NOT NULL THEN 0 ELSE 1 END, fu.usage_count DESC,
          CASE WHEN m.name LIKE ${mysql.escape(likeStart)} THEN 0 ELSE 1 END, LENGTH(m.name) ASC
        LIMIT 10`
      ).catch(() => [[]]),

      // 2. Dosage references — use likeStart for short queries to avoid full scan
      db.query(
        useFulltext
          ? `SELECT DISTINCT medication_name as name, dosage_form, strength,
              standard_dosage, recommended_frequency, recommended_duration,
              route_of_administration, active_ingredient as generic_name, 'dosage_ref' as source
            FROM dosage_references
            WHERE medication_name LIKE ${mysql.escape(likeAny)} OR active_ingredient LIKE ${mysql.escape(likeAny)}
            ORDER BY CASE WHEN medication_name LIKE ${mysql.escape(likeStart)} THEN 0 ELSE 1 END, LENGTH(medication_name)
            LIMIT 10`
          : `SELECT DISTINCT medication_name as name, dosage_form, strength,
              standard_dosage, recommended_frequency, recommended_duration,
              route_of_administration, active_ingredient as generic_name, 'dosage_ref' as source
            FROM dosage_references
            WHERE medication_name LIKE ${mysql.escape(likeStart)}
            LIMIT 10`
      ).catch(() => [[]]),

      // 3. medicines_consolidated (FULLTEXT for >=4 chars, LIKE for shorter)
      // FULLTEXT index ft_mc_name_comp is on (name, salt_composition)
      db.query(
        useFulltext
          ? `SELECT ${bigTableCols('consolidated')} FROM medicines_consolidated
             WHERE is_discontinued = 0 AND MATCH(name, salt_composition) AGAINST (${mysql.escape(ftQuery)} IN BOOLEAN MODE)
             ORDER BY CASE WHEN name LIKE ${mysql.escape(likeStart)} THEN 0 ELSE 1 END, manufacturer_name, LENGTH(name)
             LIMIT 10000`
          : `SELECT ${bigTableCols('consolidated')} FROM medicines_consolidated
             WHERE is_discontinued = 0 AND name LIKE ${mysql.escape(likeStart)}
             LIMIT ${shortLikeLimit}`
      ).catch((e) => { console.error('[MedicineService] consolidated failed:', e.message); return [[]]; }),

      // 4. medicines_allopathy
      db.query(
        useFulltext
          ? `SELECT ${bigTableCols('allopathy')} FROM medicines_allopathy
             WHERE is_discontinued = 0 AND MATCH(name) AGAINST (${mysql.escape(ftQuery)} IN BOOLEAN MODE)
             ORDER BY CASE WHEN name LIKE ${mysql.escape(likeStart)} THEN 0 ELSE 1 END, manufacturer_name, LENGTH(name)
             LIMIT 10000`
          : `SELECT ${bigTableCols('allopathy')} FROM medicines_allopathy
             WHERE is_discontinued = 0 AND name LIKE ${mysql.escape(likeStart)}
             LIMIT ${shortLikeLimit}`
      ).catch((e) => { console.error('[MedicineService] allopathy failed:', e.message); return [[]]; }),

      // 5a. Manufacturer search — consolidated (only >=4 chars)
      useFulltext
        ? db.query(
            `SELECT ${bigTableCols('consolidated')} FROM medicines_consolidated
             WHERE is_discontinued = 0 AND manufacturer_name LIKE ${mysql.escape(likeStart)}
             ORDER BY manufacturer_name, LENGTH(name) LIMIT 200`
          ).catch(() => [[]])
        : Promise.resolve([[]]),

      // 5b. Manufacturer search — allopathy (only >=4 chars)
      useFulltext
        ? db.query(
            `SELECT ${bigTableCols('allopathy')} FROM medicines_allopathy
             WHERE is_discontinued = 0 AND manufacturer_name LIKE ${mysql.escape(likeStart)}
             ORDER BY manufacturer_name, LENGTH(name) LIMIT 200`
          ).catch(() => [[]])
        : Promise.resolve([[]]),

      // 6. SNOMED medications — use likeStart for short queries to avoid full scan
      db.query(
        useFulltext
          ? `SELECT snomed_id, medication_name as name, brand_name as brand,
              substance_name as generic_name, dose_form as dosage_form,
              CONCAT(COALESCE(strength_value,''), ' ', COALESCE(strength_unit,'')) as strength,
              route_of_administration, 'snomed' as source
            FROM snomed_medications
            WHERE is_active = 1 AND (
              medication_name LIKE ${mysql.escape(likeAny)}
              OR brand_name LIKE ${mysql.escape(likeAny)}
              OR substance_name LIKE ${mysql.escape(likeAny)}
            )
            ORDER BY CASE WHEN medication_name LIKE ${mysql.escape(likeStart)} THEN 0 ELSE 1 END, LENGTH(medication_name)
            LIMIT ${limitNum}`
          : `SELECT snomed_id, medication_name as name, brand_name as brand,
              substance_name as generic_name, dose_form as dosage_form,
              CONCAT(COALESCE(strength_value,''), ' ', COALESCE(strength_unit,'')) as strength,
              route_of_administration, 'snomed' as source
            FROM snomed_medications
            WHERE is_active = 1 AND medication_name LIKE ${mysql.escape(likeStart)}
            LIMIT 10`
      ).catch(() => [[]]),
    ]);

    const localMeds = localRows || [];
    const dosageMeds = dosageRows || [];
    const consolidatedMeds = consolidatedRows || [];
    const allopathyMeds = allopathyRows || [];
    const manufacturerMeds = [...(cMfrRows || []), ...(aMfrRows || [])];
    const snomedMeds = snomedRows || [];

    // Combine and dedup
    const seenByName = new Set();
    const seenConsolidated = new Set();
    const seenConsolidatedNames = new Set();
    const medicines = [];

    for (const m of localMeds) {
      const key = (m.name || '').toLowerCase().trim();
      if (key && !seenByName.has(key)) { seenByName.add(key); medicines.push(m); }
    }
    for (const m of dosageMeds) {
      const key = (m.name || '').toLowerCase().trim();
      if (key && !seenByName.has(key)) { seenByName.add(key); medicines.push(m); }
    }
    for (const m of [...consolidatedMeds, ...allopathyMeds, ...manufacturerMeds]) {
      const nameKey = (m.name || '').toLowerCase().trim();
      const mfr = (m.manufacturer_name || '').toLowerCase().trim();
      const comboKey = `${nameKey}||${mfr}`;
      if (nameKey && !seenConsolidated.has(comboKey) && !seenByName.has(nameKey)) {
        seenConsolidated.add(comboKey);
        seenConsolidatedNames.add(nameKey);
        medicines.push(m);
      }
    }
    for (const m of snomedMeds) {
      const key = (m.name || '').toLowerCase().trim();
      if (key && !seenByName.has(key) && !seenConsolidatedNames.has(key)) {
        seenByName.add(key); medicines.push(m);
      }
    }

    return { medicines: medicines.slice(0, limitNum), total: medicines.length, query: q };
  }

  static async getDosageInfo({ name }) {
    if (!name || name.trim().length < 1) {
      return { dosage: null };
    }

    const db = getDb();
    const searchName = name.trim().toLowerCase();

    const [rows] = await db.query(
      `SELECT
        medication_name, active_ingredient, dosage_form, strength,
        standard_dosage, max_daily_dose, recommended_frequency, recommended_duration,
        route_of_administration, special_instructions, contraindications, side_effects,
        drug_interactions, age_group, pregnancy_category, category
      FROM dosage_references
      WHERE LOWER(medication_name) LIKE ${mysql.escape('%' + searchName + '%')}
        OR LOWER(active_ingredient) LIKE ${mysql.escape('%' + searchName + '%')}
      ORDER BY
        CASE WHEN LOWER(medication_name) = ${mysql.escape(searchName)} THEN 0
             WHEN LOWER(medication_name) LIKE ${mysql.escape(searchName + '%')} THEN 1
             ELSE 2 END
      LIMIT 5`
    );

    return {
      dosage: rows.length > 0 ? rows[0] : null,
      alternatives: rows.slice(1),
      count: rows.length
    };
  }

  static async getMedicinesForDiagnosis({ icd_code, limit = 8, userId }) {
    if (!icd_code) {
      throw ApiError.badRequest('ICD code required');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 8, 20);

    const [medicines] = await db.execute(
      `SELECT
        dmm.id, dmm.medicine_id, dmm.medicine_name,
        dmm.default_dosage, dmm.default_frequency, dmm.default_duration,
        dmm.priority, dmm.usage_count,
        m.strength, m.dosage_form,
        CASE WHEN dmm.doctor_id = ? THEN 'custom' ELSE 'standard' END as mapping_type
      FROM diagnosis_medicine_mapping dmm
      LEFT JOIN medicines m ON dmm.medicine_id = m.id
      WHERE dmm.icd_code = ?
        AND (dmm.doctor_id = ? OR dmm.doctor_id IS NULL)
      ORDER BY
        CASE WHEN dmm.doctor_id = ? THEN 0 ELSE 1 END,
        dmm.priority DESC,
        dmm.usage_count DESC
      LIMIT ?`,
      [userId, icd_code, userId, userId, limitNum]
    );

    return { medicines, total: medicines.length, icd_code };
  }

  static async getFrequentMedicines({ userId, limit = 12 }) {
    if (!userId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 12, 50);

    const [medicines] = await db.query(
      `SELECT
        fu.item_id as id,
        fu.item_id as medicine_id,
        fu.item_name as name,
        fu.item_name as medicine_name,
        fu.usage_count,
        fu.last_used,
        m.strength, m.dosage_form, m.generic_name
      FROM frequently_used fu
      LEFT JOIN medicines m ON fu.item_id = m.id
      WHERE fu.user_id = ? AND fu.item_type = 'medicine'
      ORDER BY fu.usage_count DESC, fu.last_used DESC
      LIMIT ${limitNum}`,
      [userId]
    );

    return { medicines, total: medicines.length };
  }

  static async getMedicineDefaultsById({ id }) {
    const db = getDb();

    const [[med]] = await db.execute(
      `SELECT name, generic_name, strength, dosage_form FROM medicines WHERE id = ?`,
      [id]
    );

    if (!med) {
      return { defaults: {} };
    }

    const [dosageRows] = await db.query(
      `SELECT standard_dosage, recommended_frequency, recommended_duration, route_of_administration
       FROM dosage_references
       WHERE LOWER(medication_name) LIKE ${mysql.escape('%' + med.name.toLowerCase() + '%')}
         OR LOWER(active_ingredient) LIKE ${mysql.escape('%' + (med.generic_name || '').toLowerCase() + '%')}
       LIMIT 1`
    );

    const dosage = dosageRows[0] || {};

    return {
      defaults: {
        dosage: dosage.standard_dosage || med.strength || '',
        frequency: dosage.recommended_frequency || '1-0-1',
        duration: dosage.recommended_duration || '7 days',
        route: dosage.route_of_administration || ''
      }
    };
  }

  static async getRecentMedicinesForPatient({ patientId, limit = 10 }) {
    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    try {
      const [meds] = await db.query(
        `SELECT DISTINCT medication_name as name, dosage, frequency, duration
         FROM prescription_medications
         WHERE prescription_id IN (
           SELECT id FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10
         )
         LIMIT ${limitNum}`,
        [patientId]
      );
      return { medications: meds };
    } catch (e) {
      return { medications: [] };
    }
  }

  static async createCustomMedicine({ body }) {
    const db = getDb();
    const {
      name, generic_name, composition, strength, dosage_form, manufacturer,
      default_frequency, default_timing, default_duration, default_instructions,
      notes, category, brand
    } = body;

    if (!name || !name.trim()) {
      throw ApiError.badRequest('Medicine name is required');
    }
    if (!generic_name || !generic_name.trim()) {
      throw ApiError.badRequest('Generic name is required');
    }

    const cleanName = name.trim();
    const cleanStrength = (strength || '').trim();

    // Duplicate check: same name + same strength (case-insensitive)
    const [existing] = await db.query(
      `SELECT id FROM medicines
       WHERE LOWER(name) = LOWER(?) AND LOWER(COALESCE(strength,'')) = LOWER(?) LIMIT 1`,
      [cleanName, cleanStrength]
    );

    if (existing.length > 0) {
      return { success: false, message: 'Medicine with same name and strength already exists', id: existing[0].id, duplicate: true };
    }

    const searchText = [cleanName, generic_name.trim(), composition || '', brand || '']
      .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();

    const [result] = await db.query(
      `INSERT INTO medicines
        (name, brand, generic_name, composition, strength, dosage_form, manufacturer,
         default_frequency, default_timing, default_duration, default_instructions,
         notes, search_text, category, is_active, is_custom, usage_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)`,
      [
        cleanName,
        (brand || cleanName).trim(),
        generic_name.trim(),
        (composition || '').trim() || null,
        cleanStrength || null,
        (dosage_form || 'Tablet').trim(),
        (manufacturer || '').trim() || null,
        (default_frequency || '').trim() || null,
        (default_timing || '').trim() || null,
        (default_duration || '').trim() || null,
        (default_instructions || '').trim() || null,
        (notes || '').trim() || null,
        searchText,
        (category || 'General').trim(),
      ]
    );

    return { success: true, id: result.insertId };
  }

  static async updateMedicine({ id, body }) {
    const db = getDb();
    const {
      name, generic_name, composition, strength, dosage_form, manufacturer,
      default_frequency, default_timing, default_duration, default_instructions,
      notes, category, is_active
    } = body;

    if (!name || !name.trim()) {
      throw ApiError.badRequest('Medicine name is required');
    }
    if (!generic_name || !generic_name.trim()) {
      throw ApiError.badRequest('Generic name is required');
    }

    const cleanName = name.trim();
    const cleanStrength = (strength || '').trim();

    // Duplicate check: same name+strength but different id
    const [existing] = await db.query(
      `SELECT id FROM medicines
       WHERE LOWER(name) = LOWER(?) AND LOWER(COALESCE(strength,'')) = LOWER(?) AND id != ? LIMIT 1`,
      [cleanName, cleanStrength, id]
    );
    if (existing.length > 0) {
      return { success: false, message: 'Another medicine with same name and strength already exists', duplicate: true };
    }

    const searchText = [cleanName, generic_name.trim(), composition || '']
      .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();

    await db.query(
      `UPDATE medicines SET
        name = ?, generic_name = ?, composition = ?, strength = ?, dosage_form = ?,
        manufacturer = ?, default_frequency = ?, default_timing = ?, default_duration = ?,
        default_instructions = ?, notes = ?, search_text = ?, category = ?,
        is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        cleanName,
        generic_name.trim(),
        (composition || '').trim() || null,
        cleanStrength || null,
        (dosage_form || 'Tablet').trim(),
        (manufacturer || '').trim() || null,
        (default_frequency || '').trim() || null,
        (default_timing || '').trim() || null,
        (default_duration || '').trim() || null,
        (default_instructions || '').trim() || null,
        (notes || '').trim() || null,
        searchText,
        (category || 'General').trim(),
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ]
    );

    return { success: true };
  }

  static async deleteMedicine({ id }) {
    const db = getDb();
    await db.query(`UPDATE medicines SET is_active = 0, updated_at = NOW() WHERE id = ?`, [id]);
    return { success: true };
  }

  static async listMasterMedicines({ page = 1, limit = 20, search = '' }) {
    const db = getDb();
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    let whereClause = '';
    let params = [];

    if (search && search.trim().length > 0) {
      const s = `%${search.trim()}%`;
      whereClause = `WHERE is_custom = 1 AND is_active = 1 AND (name LIKE ? OR generic_name LIKE ? OR composition LIKE ? OR search_text LIKE ?)`;
      params = [s, s, s, s];
    } else {
      whereClause = `WHERE is_custom = 1 AND is_active = 1`;
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM medicines ${whereClause}`,
      params
    );

    const [medicines] = await db.query(
      `SELECT id, name, generic_name, composition, strength, dosage_form, manufacturer,
              default_frequency, default_timing, default_duration, default_instructions,
              notes, category, is_active, created_at, updated_at
       FROM medicines ${whereClause}
       ORDER BY created_at DESC, name ASC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    return {
      medicines,
      total,
      page: parseInt(page) || 1,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }

  static async saveMedicineDefaults({ doctorId, body }) {
    const { medicine_name, dosage, frequency, duration, timing, instructions, quantity } = body;

    if (!medicine_name || !medicine_name.trim()) {
      throw ApiError.badRequest('Medicine name is required');
    }

    if (!doctorId) {
      throw ApiError.unauthorized('Doctor ID not found');
    }

    const db = getDb();
    try {
      await db.query(
        // MySQL has no table alias in INSERT (that's Postgres syntax) — the
        // stray `AS md` made every one of these statements fail with a syntax
        // error. It was caught and logged as "skipped" below, so nothing broke
        // visibly, but NO prescribing default was ever saved. The row alias on
        // VALUES is the supported form (MySQL 8.0.19+; this server runs 8.4)
        // and the existing row is referenced by the table's own name.
        `INSERT INTO medicine_defaults (doctor_id, medicine_name, dosage, frequency, duration, timing, instructions, quantity, usage_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) AS new_vals
         ON DUPLICATE KEY UPDATE
           dosage = COALESCE(new_vals.dosage, medicine_defaults.dosage),
           frequency = COALESCE(new_vals.frequency, medicine_defaults.frequency),
           duration = COALESCE(new_vals.duration, medicine_defaults.duration),
           timing = COALESCE(new_vals.timing, medicine_defaults.timing),
           instructions = COALESCE(new_vals.instructions, medicine_defaults.instructions),
           quantity = COALESCE(new_vals.quantity, medicine_defaults.quantity),
           usage_count = medicine_defaults.usage_count + 1`,
        [doctorId, medicine_name.trim(), dosage || null, frequency || null, duration || null, timing || null, instructions || null, quantity || null]
      );
    } catch (dbErr) {
      // Table may not exist yet — non-fatal
      console.warn('medicine_defaults save skipped:', dbErr.message);
    }

    return { success: true };
  }

  static async getMyDefaults({ doctorId, name }) {
    if (!name) {
      return { defaults: null };
    }

    if (!doctorId) {
      return { defaults: null };
    }

    const db = getDb();
    try {
      const [rows] = await db.query(
        `SELECT dosage, frequency, duration, timing, instructions, quantity
         FROM medicine_defaults
         WHERE doctor_id = ? AND LOWER(medicine_name) = LOWER(?)
         LIMIT 1`,
        [doctorId, name.trim()]
      );
      return { defaults: rows.length > 0 ? rows[0] : null };
    } catch (dbErr) {
      console.warn('medicine_defaults fetch skipped:', dbErr.message);
      return { defaults: null };
    }
  }
}

module.exports = MedicineService;
