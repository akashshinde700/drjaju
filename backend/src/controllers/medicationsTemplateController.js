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
 * Get all medications templates
 * GET /api/medications-templates
 */
const getAllTemplates = async (req, res) => {
  try {
    const { doctor_id, category } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM medications_templates WHERE is_active = 1';
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

    // Parse JSON medications field
    const parsedTemplates = templates.map(template => ({
      ...template,
      medications: safeJsonParse(template.medications, [])
    }));

    res.json({ templates: parsedTemplates });
  } catch (error) {
    console.error('Error fetching medications templates:', error);
    res.status(500).json({
      error: 'Failed to fetch medications templates',
      details: error.message
    });
  }
};

/**
 * Get medications template by ID
 * GET /api/medications-templates/:id
 */
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      'SELECT * FROM medications_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = {
      ...templates[0],
      medications: safeJsonParse(templates[0].medications, [])
    };

    res.json(template);
  } catch (error) {
    console.error('Error fetching medications template:', error);
    res.status(500).json({
      error: 'Failed to fetch medications template',
      details: error.message
    });
  }
};

/**
 * Create new medications template
 * POST /api/medications-templates
 */
const createTemplate = async (req, res) => {
  try {
    const { name, category, description, medications, doctor_id } = req.body;

    if (!name || !medications) {
      return res.status(400).json({
        error: 'Name and medications are required'
      });
    }

    const db = getDb();

    // Convert medications array to JSON string
    const medicationsJson = typeof medications === 'string'
      ? medications
      : JSON.stringify(medications);

    const [result] = await db.execute(
      `INSERT INTO medications_templates (name, category, description, medications, doctor_id)
       VALUES (?, ?, ?, ?, ?)`,
      [name, category || null, description || null, medicationsJson, doctor_id || null]
    );

    res.status(201).json({
      message: 'Medications template created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating medications template:', error);
    res.status(500).json({
      error: 'Failed to create medications template',
      details: error.message
    });
  }
};

/**
 * Update medications template
 * PUT /api/medications-templates/:id
 */
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, medications } = req.body;
    const db = getDb();

    // Convert medications array to JSON string
    const medicationsJson = typeof medications === 'string'
      ? medications
      : JSON.stringify(medications);

    await db.execute(
      `UPDATE medications_templates
       SET name = ?, category = ?, description = ?, medications = ?
       WHERE id = ?`,
      [name, category, description, medicationsJson, id]
    );

    res.json({ message: 'Medications template updated successfully' });
  } catch (error) {
    console.error('Error updating medications template:', error);
    res.status(500).json({
      error: 'Failed to update medications template',
      details: error.message
    });
  }
};

/**
 * Delete medications template
 * DELETE /api/medications-templates/:id
 */
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Soft delete
    await db.execute(
      'UPDATE medications_templates SET is_active = 0 WHERE id = ?',
      [id]
    );

    res.json({ message: 'Medications template deleted successfully' });
  } catch (error) {
    console.error('Error deleting medications template:', error);
    res.status(500).json({
      error: 'Failed to delete medications template',
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
