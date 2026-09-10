const { getDb } = require('../config/db');

async function listLabTemplates(req, res) {
  try {
    const { category, search, is_active } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM lab_templates WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (test_name LIKE ? OR test_code LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY test_name';

    const [templates] = await db.execute(query, params);
    res.json({ templates });
  } catch (error) {
    console.error('List lab templates error:', error);
    res.status(500).json({ error: 'Failed to fetch lab templates' });
  }
}

async function getLabTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [templates] = await db.execute(
      'SELECT * FROM lab_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Lab template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Get lab template error:', error);
    res.status(500).json({ error: 'Failed to fetch lab template' });
  }
}

async function createLabTemplate(req, res) {
  try {
    const {
      test_name,
      test_code,
      description,
      sample_type,
      category,
      unit,
      reference_range,
      special_instructions
    } = req.body;

    if (!test_name) {
      return res.status(400).json({ error: 'Test name is required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO lab_templates (
        test_name, test_code, description, sample_type, category,
        unit, reference_range, special_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        test_name,
        test_code || null,
        description || null,
        sample_type || null,
        category || null,
        unit || null,
        reference_range || null,
        special_instructions || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Lab template created successfully'
    });
  } catch (error) {
    console.error('Create lab template error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Template with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create lab template' });
  }
}

async function updateLabTemplate(req, res) {
  try {
    const { id } = req.params;
    const {
      test_name,
      test_code,
      description,
      sample_type,
      category,
      unit,
      reference_range,
      special_instructions,
      is_active
    } = req.body;

    const db = getDb();
    const updateFields = [];
    const params = [];

    if (test_name) { updateFields.push('test_name = ?'); params.push(test_name); }
    if (test_code !== undefined) { updateFields.push('test_code = ?'); params.push(test_code); }
    if (description !== undefined) { updateFields.push('description = ?'); params.push(description); }
    if (sample_type !== undefined) { updateFields.push('sample_type = ?'); params.push(sample_type); }
    if (category !== undefined) { updateFields.push('category = ?'); params.push(category); }
    if (unit !== undefined) { updateFields.push('unit = ?'); params.push(unit); }
    if (reference_range !== undefined) { updateFields.push('reference_range = ?'); params.push(reference_range); }
    if (special_instructions !== undefined) { updateFields.push('special_instructions = ?'); params.push(special_instructions); }
    if (is_active !== undefined) { updateFields.push('is_active = ?'); params.push(is_active); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.execute(
      `UPDATE lab_templates SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Lab template updated successfully' });
  } catch (error) {
    console.error('Update lab template error:', error);
    res.status(500).json({ error: 'Failed to update lab template' });
  }
}

async function deleteLabTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute('DELETE FROM lab_templates WHERE id = ?', [id]);

    res.json({ message: 'Lab template deleted successfully' });
  } catch (error) {
    console.error('Delete lab template error:', error);
    res.status(500).json({ error: 'Failed to delete lab template' });
  }
}

async function getLabTemplateParameters(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [parameters] = await db.execute(
      'SELECT * FROM lab_template_parameters WHERE lab_template_id = ? ORDER BY sequence_order, parameter_name',
      [id]
    );

    res.json({ parameters });
  } catch (error) {
    console.error('Get lab template parameters error:', error);
    res.status(500).json({ error: 'Failed to fetch lab template parameters' });
  }
}

module.exports = {
  listLabTemplates,
  getLabTemplate,
  getLabTemplateParameters,
  createLabTemplate,
  updateLabTemplate,
  deleteLabTemplate
};

