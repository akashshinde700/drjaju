const { getDb } = require('../config/db');

// List all receipt templates for a clinic
async function listReceiptTemplates(req, res) {
  try {
    const { clinic_id } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM receipt_templates WHERE 1=1';
    const params = [];

    if (clinic_id) {
      query += ' AND clinic_id = ?';
      params.push(clinic_id);
    }

    query += ' ORDER BY is_default DESC, created_at DESC';

    const [templates] = await db.execute(query, params);

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('List receipt templates error:', error);
    res.status(500).json({ error: 'Failed to fetch receipt templates' });
  }
}

// Get a single receipt template
async function getReceiptTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      'SELECT * FROM receipt_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      template: templates[0]
    });
  } catch (error) {
    console.error('Get receipt template error:', error);
    res.status(500).json({ error: 'Failed to fetch receipt template' });
  }
}

// Create a new receipt template
async function createReceiptTemplate(req, res) {
  try {
    const {
      clinic_id,
      template_name,
      header_content,
      header_image,
      footer_content,
      footer_image,
      is_default = false
    } = req.body;

    if (!template_name) {
      return res.status(400).json({ error: 'template_name is required' });
    }

    const db = getDb();

    // If this is set as default, unset other defaults for the same clinic
    if (is_default && clinic_id) {
      await db.execute(
        'UPDATE receipt_templates SET is_default = 0 WHERE clinic_id = ?',
        [clinic_id]
      );
    }

    const [result] = await db.execute(
      `INSERT INTO receipt_templates (
        clinic_id, template_name, header_content, header_image, footer_content, footer_image, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clinic_id || null,
        template_name,
        header_content || null,
        header_image || null,
        footer_content || null,
        footer_image || null,
        is_default ? 1 : 0
      ]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Receipt template created successfully'
    });
  } catch (error) {
    console.error('Create receipt template error:', error);
    res.status(500).json({ error: 'Failed to create receipt template' });
  }
}

// Update a receipt template
async function updateReceiptTemplate(req, res) {
  try {
    const { id } = req.params;
    const {
      template_name,
      header_content,
      header_image,
      footer_content,
      footer_image,
      is_default
    } = req.body;

    const db = getDb();

    // Check if template exists
    const [existing] = await db.execute(
      'SELECT clinic_id FROM receipt_templates WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // If this is set as default, unset other defaults for the same clinic
    if (is_default && existing[0].clinic_id) {
      await db.execute(
        'UPDATE receipt_templates SET is_default = 0 WHERE clinic_id = ? AND id != ?',
        [existing[0].clinic_id, id]
      );
    }

    await db.execute(
      `UPDATE receipt_templates SET
        template_name = ?,
        header_content = ?,
        header_image = ?,
        footer_content = ?,
        footer_image = ?,
        is_default = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        template_name,
        header_content || null,
        header_image || null,
        footer_content || null,
        footer_image || null,
        is_default ? 1 : 0,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Receipt template updated successfully'
    });
  } catch (error) {
    console.error('Update receipt template error:', error);
    res.status(500).json({ error: 'Failed to update receipt template' });
  }
}

// Delete a receipt template
async function deleteReceiptTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [result] = await db.execute(
      'DELETE FROM receipt_templates WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Receipt template deleted successfully'
    });
  } catch (error) {
    console.error('Delete receipt template error:', error);
    res.status(500).json({ error: 'Failed to delete receipt template' });
  }
}

// Get default template for a clinic
async function getDefaultTemplate(req, res) {
  try {
    const { clinic_id } = req.query;
    const db = getDb();

    if (!clinic_id) {
      return res.status(400).json({ error: 'clinic_id is required' });
    }

    const [templates] = await db.execute(
      'SELECT * FROM receipt_templates WHERE clinic_id = ? AND is_default = 1 LIMIT 1',
      [clinic_id]
    );

    if (templates.length === 0) {
      return res.json({
        success: true,
        template: null
      });
    }

    res.json({
      success: true,
      template: templates[0]
    });
  } catch (error) {
    console.error('Get default template error:', error);
    res.status(500).json({ error: 'Failed to fetch default template' });
  }
}

module.exports = {
  listReceiptTemplates,
  getReceiptTemplate,
  createReceiptTemplate,
  updateReceiptTemplate,
  deleteReceiptTemplate,
  getDefaultTemplate
};
