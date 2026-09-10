const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class SymptomsTemplatesService {
  static async getAllTemplates() {
    const db = getDb();

    try {
      const [templates] = await db.execute(
        `SELECT id, name, symptoms, description, category, is_active, created_by, clinic_id, created_at, updated_at
         FROM symptoms_templates
         WHERE is_active = 1
         ORDER BY category, name`
      );

      return { templates };
    } catch (error) {
      if (error?.message && error.message.includes('symptoms_templates')) {
        return { templates: [] };
      }
      throw error;
    }
  }

  static async getTemplateById(id) {
    const db = getDb();

    const [templates] = await db.execute('SELECT * FROM symptoms_templates WHERE id = ?', [id]);

    if (!templates || templates.length === 0) {
      throw ApiError.notFound('Template');
    }

    return { template: templates[0] };
  }

  static async createTemplate({ body, user }) {
    const { name, symptoms, description, category } = body;
    const userId = user?.id;
    const clinicId = user?.clinic_id;

    if (!name || !symptoms) {
      throw ApiError.badRequest('Name and symptoms are required');
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO symptoms_templates (name, symptoms, description, category, created_by, clinic_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, symptoms, description || null, category || null, userId || null, clinicId || null]
    );

    return { templateId: result.insertId };
  }

  static async updateTemplate({ id, body }) {
    const { name, symptoms, description, category } = body;

    if (!name || !symptoms) {
      throw ApiError.badRequest('Name and symptoms are required');
    }

    const db = getDb();
    const [result] = await db.execute(
      `UPDATE symptoms_templates
       SET name = ?, symptoms = ?, description = ?, category = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, symptoms, description || null, category || null, id]
    );

    if (!result || result.affectedRows === 0) {
      throw ApiError.notFound('Template');
    }

    return { updated: true };
  }

  static async deleteTemplate(id) {
    const db = getDb();

    const [result] = await db.execute(
      'UPDATE symptoms_templates SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );

    if (!result || result.affectedRows === 0) {
      throw ApiError.notFound('Template');
    }

    return { deleted: true };
  }

  static async getTemplatesByCategory(category) {
    const db = getDb();
    const [templates] = await db.execute(
      'SELECT * FROM symptoms_templates WHERE category = ? AND is_active = 1 ORDER BY name',
      [category]
    );

    return { templates };
  }
}

module.exports = SymptomsTemplatesService;
