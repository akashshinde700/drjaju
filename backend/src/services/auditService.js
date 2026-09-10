const { getDb } = require('../config/db');

class AuditService {
  static async log(userId, action, entity, entityId, details = null, req = null) {
    try {
      const db = getDb();

      // Get additional context from request if available
      let ipAddress = null;
      let userAgent = null;

      if (req) {
        ipAddress = req.ip || req.connection.remoteAddress;
        userAgent = req.get('User-Agent');
      }

      const auditData = {
        user_id: userId,
        action: action,
        entity: entity,
        entity_id: entityId ? entityId.toString() : null,
        details: details ? (typeof details === 'object' ? JSON.stringify(details) : details) : null,
        ip_address: ipAddress,
        user_agent: userAgent
      };

      await db.execute(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          auditData.user_id,
          auditData.action,
          auditData.entity,
          auditData.entity_id,
          auditData.details,
          auditData.ip_address,
          auditData.user_agent
        ]
      );
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  static async logUserAction(req, action, entity, entityId, details = null) {
    const userId = req.user?.id;
    if (!userId) return;

    await this.log(userId, action, entity, entityId, details, req);
  }

  static async getAuditLogs(filters = {}) {
    try {
      const db = getDb();
      let query = 'SELECT al.*, u.name as username, u.email FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1';
      const params = [];

      if (filters.userId) {
        query += ' AND al.user_id = ?';
        params.push(filters.userId);
      }

      if (filters.action) {
        query += ' AND al.action = ?';
        params.push(filters.action);
      }

      if (filters.entity) {
        query += ' AND al.entity = ?';
        params.push(filters.entity);
      }

      if (filters.entityId) {
        query += ' AND al.entity_id = ?';
        params.push(filters.entityId);
      }

      if (filters.startDate) {
        query += ' AND al.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND al.created_at <= ?';
        params.push(filters.endDate);
      }

      const auditLimit = parseInt(filters.limit, 10) || 100;
      const auditOffset = parseInt(filters.offset, 10) || 0;
      query += ` ORDER BY al.created_at DESC LIMIT ${auditLimit} OFFSET ${auditOffset}`;

      const [logs] = await db.execute(query, params);
      return logs;
    } catch (error) {
      console.error('Get audit logs error:', error);
      return [];
    }
  }

  static async getAuditLogById(id) {
    try {
      const db = getDb();
      const [logs] = await db.execute(
        'SELECT al.*, u.name as username, u.email FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.id = ?',
        [id]
      );
      return logs[0] || null;
    } catch (error) {
      console.error('Get audit log error:', error);
      return null;
    }
  }
}

module.exports = AuditService;