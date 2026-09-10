const { getDb } = require('../config/db');

// Get all symptoms templates
async function getAllTemplates(req, res) {
  try {
    const db = getDb();
    const [templates] = await db.execute(
      `SELECT id, name, symptoms, description, category, is_active, created_by, clinic_id, created_at, updated_at
       FROM symptoms_templates
       WHERE is_active = 1
       ORDER BY category, name`
    );

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching symptoms templates:', error);
    // If table doesn't exist, return empty array
    if (error.message && error.message.includes('symptoms_templates')) {
      return res.json({ templates: [] });
    }
    res.status(500).json({ error: 'Failed to fetch symptoms templates' });
  }
}

// Get a single template by ID
async function getTemplateById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      `SELECT * FROM symptoms_templates WHERE id = ?`,
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

// Create a new symptoms template
async function createTemplate(req, res) {
  try {
    const { name, symptoms, description, category } = req.body;
    const userId = req.user?.id;
    const clinicId = req.user?.clinic_id;

    if (!name || !symptoms) {
      return res.status(400).json({ error: 'Name and symptoms are required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO symptoms_templates (name, symptoms, description, category, created_by, clinic_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, symptoms, description || null, category || null, userId || null, clinicId || null]
    );

    res.status(201).json({
      message: 'Template created successfully',
      templateId: result.insertId
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

// Update a symptoms template
async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { name, symptoms, description, category } = req.body;

    if (!name || !symptoms) {
      return res.status(400).json({ error: 'Name and symptoms are required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `UPDATE symptoms_templates
       SET name = ?, symptoms = ?, description = ?, category = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, symptoms, description || null, category || null, id]
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

// Delete a symptoms template (soft delete)
async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [result] = await db.execute(
      `UPDATE symptoms_templates SET is_active = 0, updated_at = NOW() WHERE id = ?`,
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

// Get templates by category
async function getTemplatesByCategory(req, res) {
  try {
    const { category } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      `SELECT * FROM symptoms_templates WHERE category = ? AND is_active = 1 ORDER BY name`,
      [category]
    );

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates by category:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

module.exports = require('./symptomsTemplatesController_refactored');
