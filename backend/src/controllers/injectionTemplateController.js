const { getDb } = require('../config/db');

/**
 * Get all injection templates
 */
async function getAllInjectionTemplates(req, res) {
  try {
    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let query = `
      SELECT it.*, u.name as created_by_name
      FROM injection_templates it
      LEFT JOIN doctors d ON it.doctor_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE it.is_active = 1
    `;

    const params = [];

    // If doctor, show global templates + their own templates
    if (userRole === 'doctor') {
      query += ` AND (it.doctor_id IS NULL OR it.doctor_id = ?)`;
      params.push(userId);
    }
    // If admin, show all templates
    // If staff, show only global templates
    else if (userRole === 'staff') {
      query += ` AND it.doctor_id IS NULL`;
    }

    query += ` ORDER BY it.usage_count DESC, it.template_name ASC`;

    const [templates] = await db.execute(query, params);

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Get injection templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch injection templates'
    });
  }
}

/**
 * Get injection template by ID
 */
async function getInjectionTemplateById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [templates] = await db.execute(`
      SELECT it.*, u.name as created_by_name
      FROM injection_templates it
      LEFT JOIN doctors d ON it.doctor_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE it.id = ? AND it.is_active = 1
    `, [id]);

    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Injection template not found'
      });
    }

    res.json({
      success: true,
      template: templates[0]
    });
  } catch (error) {
    console.error('Get injection template by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch injection template'
    });
  }
}

/**
 * Create new injection template
 */
async function createInjectionTemplate(req, res) {
  try {
    const {
      template_name,
      injection_name,
      generic_name,
      dose,
      route,
      infusion_rate,
      frequency,
      duration,
      timing,
      instructions
    } = req.body;

    // Validation
    if (!template_name || !injection_name || !dose || !route || !frequency || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Template name, injection name, dose, route, frequency, and duration are required'
      });
    }

    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Determine doctor_id
    let doctorId = null;
    if (userRole === 'doctor') {
      // For doctors, use their own ID
      doctorId = userId;
    } else if (userRole === 'admin') {
      // Admin can create global templates (doctor_id = NULL)
      doctorId = null;
    } else {
      return res.status(403).json({
        success: false,
        error: 'Only doctors and admins can create injection templates'
      });
    }

    const [result] = await db.execute(`
      INSERT INTO injection_templates
      (doctor_id, template_name, injection_name, generic_name, dose, route,
       infusion_rate, frequency, duration, timing, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      doctorId,
      template_name,
      injection_name,
      generic_name,
      dose,
      route,
      infusion_rate,
      frequency,
      duration,
      timing,
      instructions
    ]);

    // Fetch the created template
    const [newTemplate] = await db.execute(`
      SELECT * FROM injection_templates WHERE id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Injection template created successfully',
      template: newTemplate[0]
    });
  } catch (error) {
    console.error('Create injection template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create injection template'
    });
  }
}

/**
 * Update injection template
 */
async function updateInjectionTemplate(req, res) {
  try {
    const { id } = req.params;
    const {
      template_name,
      injection_name,
      generic_name,
      dose,
      route,
      infusion_rate,
      frequency,
      duration,
      timing,
      instructions,
      is_active
    } = req.body;

    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Check if template exists
    const [existing] = await db.execute(`
      SELECT * FROM injection_templates WHERE id = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Injection template not found'
      });
    }

    const template = existing[0];

    // Authorization check
    if (userRole === 'doctor' && template.doctor_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own templates'
      });
    }

    // Admin can update any template

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (template_name !== undefined) {
      updates.push('template_name = ?');
      values.push(template_name);
    }
    if (injection_name !== undefined) {
      updates.push('injection_name = ?');
      values.push(injection_name);
    }
    if (generic_name !== undefined) {
      updates.push('generic_name = ?');
      values.push(generic_name);
    }
    if (dose !== undefined) {
      updates.push('dose = ?');
      values.push(dose);
    }
    if (route !== undefined) {
      updates.push('route = ?');
      values.push(route);
    }
    if (infusion_rate !== undefined) {
      updates.push('infusion_rate = ?');
      values.push(infusion_rate);
    }
    if (frequency !== undefined) {
      updates.push('frequency = ?');
      values.push(frequency);
    }
    if (duration !== undefined) {
      updates.push('duration = ?');
      values.push(duration);
    }
    if (timing !== undefined) {
      updates.push('timing = ?');
      values.push(timing);
    }
    if (instructions !== undefined) {
      updates.push('instructions = ?');
      values.push(instructions);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);

    await db.execute(`
      UPDATE injection_templates
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    // Fetch updated template
    const [updatedTemplate] = await db.execute(`
      SELECT * FROM injection_templates WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Injection template updated successfully',
      template: updatedTemplate[0]
    });
  } catch (error) {
    console.error('Update injection template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update injection template'
    });
  }
}

/**
 * Delete injection template (soft delete)
 */
async function deleteInjectionTemplate(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Check if template exists
    const [existing] = await db.execute(`
      SELECT * FROM injection_templates WHERE id = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Injection template not found'
      });
    }

    const template = existing[0];

    // Authorization check
    if (userRole === 'doctor' && template.doctor_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own templates'
      });
    }

    // Soft delete
    await db.execute(`
      UPDATE injection_templates
      SET is_active = 0
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Injection template deleted successfully'
    });
  } catch (error) {
    console.error('Delete injection template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete injection template'
    });
  }
}

/**
 * Increment usage count when template is used
 */
async function incrementTemplateUsage(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute(`
      UPDATE injection_templates
      SET usage_count = usage_count + 1
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Usage count updated'
    });
  } catch (error) {
    console.error('Increment template usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update usage count'
    });
  }
}

module.exports = {
  getAllInjectionTemplates,
  getInjectionTemplateById,
  createInjectionTemplate,
  updateInjectionTemplate,
  deleteInjectionTemplate,
  incrementTemplateUsage
};
