const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

class ServicesService {
  static async getServices({ clinic_id }) {
    const db = getDb();

    let query = `
      SELECT s.*, c.name as category_name 
      FROM services s 
      LEFT JOIN service_categories c ON s.category_id = c.id 
      WHERE s.is_active = 1
    `;
    const params = [];

    if (clinic_id) {
      query += ' AND s.clinic_id = ?';
      params.push(clinic_id);
    }

    query += ' ORDER BY s.name ASC';

    const [services] = await db.execute(query, params);
    return { services };
  }

  static async getServiceById({ id }) {
    if (!id) {
      throw ApiError.badRequest('Service id is required');
    }

    const db = getDb();

    const [services] = await db.execute(
      `
      SELECT s.*, c.name as category_name 
      FROM services s 
      LEFT JOIN service_categories c ON s.category_id = c.id 
      WHERE s.id = ? AND s.is_active = 1
    `,
      [id]
    );

    if (services.length === 0) {
      throw ApiError.notFound('Service');
    }

    return { service: services[0] };
  }
}

module.exports = ServicesService;
