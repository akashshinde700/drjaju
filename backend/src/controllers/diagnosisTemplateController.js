const { getDb } = require('../config/db');

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

/**
 * Get all diagnosis templates
 * GET /api/diagnosis-templates
 */
const getAllTemplates = async (req, res) => {
  try {
    const { doctor_id, category } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM diagnosis_templates WHERE is_active = 1';
    const params = [];

    if (doctor_id) {
      query += ' AND (doctor_id = ? OR doctor_id IS NULL)';
      params.push(doctor_id);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const [templates] = await db.execute(query, params);

    // Parse JSON diagnoses field
    const parsedTemplates = templates.map(template => ({
      ...template,
      diagnoses: safeJsonParse(template.diagnoses, [])
    }));

    res.json({ templates: parsedTemplates });
  } catch (error) {
    console.error('Error fetching diagnosis templates:', error);
    res.status(500).json({
      error: 'Failed to fetch diagnosis templates',
      details: error.message
    });
  }
};

/**
 * Get diagnosis template by ID
 * GET /api/diagnosis-templates/:id
 */
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      'SELECT * FROM diagnosis_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = {
      ...templates[0],
      diagnoses: safeJsonParse(templates[0].diagnoses, [])
    };

    res.json(template);
  } catch (error) {
    console.error('Error fetching diagnosis template:', error);
    res.status(500).json({
      error: 'Failed to fetch diagnosis template',
      details: error.message
    });
  }
};

/**
 * Create new diagnosis template
 * POST /api/diagnosis-templates
 */
const createTemplate = async (req, res) => {
  try {
    const { name, category, description, diagnoses, doctor_id } = req.body;

    if (!name || !diagnoses) {
      return res.status(400).json({
        error: 'Name and diagnoses are required'
      });
    }

    const db = getDb();

    // Convert diagnoses array to JSON string
    const diagnosesJson = typeof diagnoses === 'string'
      ? diagnoses
      : JSON.stringify(diagnoses);

    const [result] = await db.execute(
      `INSERT INTO diagnosis_templates (name, category, description, diagnoses, doctor_id)
       VALUES (?, ?, ?, ?, ?)`,
      [name, category || null, description || null, diagnosesJson, doctor_id || null]
    );

    res.status(201).json({
      message: 'Diagnosis template created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating diagnosis template:', error);
    res.status(500).json({
      error: 'Failed to create diagnosis template',
      details: error.message
    });
  }
};

/**
 * Update diagnosis template
 * PUT /api/diagnosis-templates/:id
 */
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, diagnoses } = req.body;
    const db = getDb();

    // Convert diagnoses array to JSON string
    const diagnosesJson = typeof diagnoses === 'string'
      ? diagnoses
      : JSON.stringify(diagnoses);

    await db.execute(
      `UPDATE diagnosis_templates
       SET name = ?, category = ?, description = ?, diagnoses = ?
       WHERE id = ?`,
      [name, category, description, diagnosesJson, id]
    );

    res.json({ message: 'Diagnosis template updated successfully' });
  } catch (error) {
    console.error('Error updating diagnosis template:', error);
    res.status(500).json({
      error: 'Failed to update diagnosis template',
      details: error.message
    });
  }
};

/**
 * Delete diagnosis template
 * DELETE /api/diagnosis-templates/:id
 */
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Soft delete
    await db.execute(
      'UPDATE diagnosis_templates SET is_active = 0 WHERE id = ?',
      [id]
    );

    res.json({ message: 'Diagnosis template deleted successfully' });
  } catch (error) {
    console.error('Error deleting diagnosis template:', error);
    res.status(500).json({
      error: 'Failed to delete diagnosis template',
      details: error.message
    });
  }
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
