const { getDb } = require('../config/db');

// Helper: normalize value to JSON string or null
function toJsonString(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { JSON.parse(val); return val; } catch { return JSON.stringify(val); }
  }
  try { return JSON.stringify(val); } catch { return null; }
}

function safeJsonParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch (_e) {
    return fallback;
  }
}

// GET /api/prescription-templates
// Return active prescription templates
async function getAllTemplates(req, res) {
  try {
    const db = getDb();
    const [templates] = await db.execute(
      `SELECT 
         id,
         template_name,
         category,
         description,
         symptoms,
         diagnoses AS diagnosis,
         medications,
         investigations,
         precautions,
         diet_restrictions,
         activities,
         advice,
         follow_up_days,
         duration_days,
         is_active,
         created_at
       FROM prescription_templates
       WHERE is_active = 1
       ORDER BY category, template_name`
    );

    // Parse JSON fields
    const parsedTemplates = templates.map(template => ({
      ...template,
      symptoms: safeJsonParse(template.symptoms, []),
      diagnosis: safeJsonParse(template.diagnosis || template.diagnoses, []),
      medications: safeJsonParse(template.medications, [])
    }));

    res.json({ templates: parsedTemplates });
  } catch (error) {
    console.error('Error fetching prescription templates:', error);
    res.status(500).json({ error: 'Failed to fetch prescription templates' });
  }
}

// GET /api/prescription-templates/:id
async function getTemplateById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [rows] = await db.execute(
      `SELECT 
         id,
         template_name,
         category,
         description,
         symptoms,
         diagnoses,
         medications,
         investigations,
         precautions,
         diet_restrictions,
         activities,
         advice,
         follow_up_days,
         duration_days,
         is_active,
         created_at,
         updated_at
       FROM prescription_templates
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const tpl = rows[0];
    // Normalize and parse fields
    const template = {
      ...tpl,
      symptoms: safeJsonParse(tpl.symptoms, []),
      diagnosis: safeJsonParse(tpl.diagnoses || tpl.diagnosis, []),
      medications: safeJsonParse(tpl.medications, [])
    };

    res.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

// POST /api/prescription-templates
async function createTemplate(req, res) {
  try {
    const {
      template_name,
      name, // fallback
      category,
      description,
      symptoms,
      diagnosis,
      diagnoses,
      medications,
      advice,
      follow_up_days,
      duration_days,
      investigations,
      precautions,
      diet_restrictions,
      activities
    } = req.body;

    const userId = req.user?.id || null;
    const clinicId = req.user?.clinic_id || null;

    const finalName = template_name || name;
    if (!finalName) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const symptomsJson = toJsonString(symptoms);
    const diagnosesJson = toJsonString(diagnoses || (diagnosis ? [diagnosis] : null));
    const medicationsJson = toJsonString(medications);

    const db = getDb();
    const params = [
      finalName,
      category || null,
      description || null,
      symptomsJson,
      diagnosesJson,
      medicationsJson,
      investigations || null,
      precautions || null,
      diet_restrictions || null,
      activities || null,
      advice || null,
      follow_up_days || null,
      duration_days || 7,
      clinicId,
      userId
    ];

    const insertFull = () => db.execute(
      `INSERT INTO prescription_templates (
         template_name, category, description, symptoms, diagnoses, medications,
         investigations, precautions, diet_restrictions, activities,
         advice, follow_up_days, duration_days, is_active, doctor_id, clinic_id, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      params
    );

    const insertFullAltDiagnosisColumn = () => db.execute(
      `INSERT INTO prescription_templates (
         template_name, category, description, symptoms, diagnosis, medications,
         investigations, precautions, diet_restrictions, activities,
         advice, follow_up_days, duration_days, is_active, doctor_id, clinic_id, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      params
    );

    const insertMinimal = (useDiagnosisColumn) => {
      const paramsMin = [
        finalName,
        category || null,
        description || null,
        symptomsJson,
        diagnosesJson,
        medicationsJson,
        advice || null,
        follow_up_days || null,
        duration_days || 7
      ];

      if (useDiagnosisColumn) {
        return db.execute(
          `INSERT INTO prescription_templates (
             template_name, category, description, symptoms, diagnosis, medications,
             advice, follow_up_days, duration_days, is_active
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          paramsMin
        );
      }

      return db.execute(
        `INSERT INTO prescription_templates (
           template_name, category, description, symptoms, diagnoses, medications,
           advice, follow_up_days, duration_days, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        paramsMin
      );
    };

    let result;
    try {
      [result] = await insertFull();
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      const isUnknownCol = e?.code === 'ER_BAD_FIELD_ERROR' || msg.includes('unknown column');
      if (!isUnknownCol) throw e;

      // Retry if schema uses `diagnosis` instead of `diagnoses`
      if (msg.includes('diagnoses')) {
        try {
          [result] = await insertFullAltDiagnosisColumn();
        } catch (e2) {
          const msg2 = String(e2?.message || '').toLowerCase();
          const isUnknownCol2 = e2?.code === 'ER_BAD_FIELD_ERROR' || msg2.includes('unknown column');
          if (!isUnknownCol2) throw e2;
          [result] = await insertMinimal(true);
        }
      } else {
        // Generic minimal retry (still using diagnoses)
        [result] = await insertMinimal(false);
      }
    }

    // Return created template id for frontend convenience
    res.status(201).json({
      message: 'Template created successfully',
      templateId: result.insertId
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      details: error.message,
      sqlMessage: error.sqlMessage || null,
      sqlState: error.sqlState || null,
      code: error.code || null
    });
  }
}

// PUT /api/prescription-templates/:id
async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const {
      template_name,
      name,
      category,
      description,
      symptoms,
      diagnosis,
      diagnoses,
      medications,
      advice,
      follow_up_days,
      duration_days,
      investigations,
      precautions,
      diet_restrictions,
      activities
    } = req.body;

    const finalName = template_name || name || null;

    const symptomsJson = toJsonString(symptoms);
    const diagnosesJson = toJsonString(diagnoses || (diagnosis ? [diagnosis] : null));
    const medicationsJson = toJsonString(medications);

    const db = getDb();
    const [result] = await db.execute(
      `UPDATE prescription_templates
       SET template_name = COALESCE(?, template_name),
           category = COALESCE(?, category),
           description = COALESCE(?, description),
           symptoms = COALESCE(?, symptoms),
           diagnoses = COALESCE(?, diagnoses),
           medications = COALESCE(?, medications),
           investigations = COALESCE(?, investigations),
           precautions = COALESCE(?, precautions),
           diet_restrictions = COALESCE(?, diet_restrictions),
           activities = COALESCE(?, activities),
           advice = COALESCE(?, advice),
           follow_up_days = COALESCE(?, follow_up_days),
           duration_days = COALESCE(?, duration_days),
           updated_at = NOW()
       WHERE id = ?`,
      [
        finalName,
        category || null,
        description || null,
        symptomsJson,
        diagnosesJson,
        medicationsJson,
        investigations || null,
        precautions || null,
        diet_restrictions || null,
        activities || null,
        advice || null,
        follow_up_days || null,
        duration_days || null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
}

// DELETE /api/prescription-templates/:id (soft delete)
async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [result] = await db.execute(
      `UPDATE prescription_templates SET is_active = 0, updated_at = NOW() WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}

// POST /api/prescription-templates/:id/use (no-op increment to avoid 500s if called)
async function incrementUsage(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // No usage_count column in schema; update timestamp as a harmless side-effect
    await db.execute(
      `UPDATE prescription_templates SET updated_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ message: 'Template usage recorded' });
  } catch (error) {
    console.error('Error updating template usage:', error);
    res.status(500).json({ error: 'Failed to update usage' });
  }
}

// GET /api/prescription-templates/category/:category
async function getTemplatesByCategory(req, res) {
  try {
    const { category } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      `SELECT 
         id,
         template_name,
         category,
         description,
         symptoms,
         diagnoses AS diagnosis,
         medications,
         investigations,
         precautions,
         diet_restrictions,
         activities,
         advice,
         follow_up_days,
         duration_days,
         is_active,
         created_at
       FROM prescription_templates
       WHERE category = ? AND is_active = 1
       ORDER BY template_name`,
      [category]
    );

    // Parse JSON fields
    const parsedTemplates = templates.map(template => ({
      ...template,
      symptoms: safeJsonParse(template.symptoms, []),
      diagnosis: safeJsonParse(template.diagnosis || template.diagnoses, []),
      medications: safeJsonParse(template.medications, [])
    }));

    res.json({ templates: parsedTemplates });
  } catch (error) {
    console.error('Error fetching templates by category:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  incrementUsage,
  getTemplatesByCategory
};
