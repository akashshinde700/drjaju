const AuditService = require('../services/auditService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const {
    userId,
    action,
    entity,
    entityId,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  } = req.query;

  // Check if user has admin or sub_admin role
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }

  const filters = {
    userId: userId ? parseInt(userId) : null,
    action,
    entity,
    entityId,
    startDate,
    endDate,
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  const logs = await AuditService.getAuditLogs(filters);
  res.json(ApiResponse.success({ logs }, 'Audit logs retrieved successfully'));
});

exports.getAuditLogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }

  const log = await AuditService.getAuditLogById(id);

  if (!log) {
    return res.status(404).json({ error: 'Audit log not found' });
  }

  res.json(ApiResponse.success({ log }, 'Audit log retrieved successfully'));
});
