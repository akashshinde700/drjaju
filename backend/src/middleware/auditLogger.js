const AuditService = require('../services/auditService');

/**
 * Middleware to automatically log user actions
 * Usage: app.use('/api/some-route', auditLogger('entity_name'), routeHandler)
 */
function auditLogger(entityName, options = {}) {
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;

    // Track if response has been sent
    let responseSent = false;
    let statusCode = 200;
    let action = 'UNKNOWN';

    // Determine action based on HTTP method
    switch (req.method) {
      case 'POST':
        action = 'CREATE';
        break;
      case 'PUT':
      case 'PATCH':
        action = 'UPDATE';
        break;
      case 'DELETE':
        action = 'DELETE';
        break;
      case 'GET':
        // Only log GET for sensitive operations if specified
        if (options.logGet) {
          action = 'READ';
        } else {
          return next(); // Skip logging for GET requests by default
        }
        break;
      default:
        return next();
    }

    // Override res.json to capture response
    res.json = function(data) {
      responseSent = true;
      statusCode = res.statusCode || 200;
      
      // Log the action if successful (2xx status codes)
      if (statusCode >= 200 && statusCode < 300) {
        const entityId = req.params.id || req.body.id || req.params.patientId || req.params.appointmentId || null;
        const details = {
          method: req.method,
          path: req.path,
          statusCode: statusCode,
          ...(req.body && Object.keys(req.body).length > 0 && !options.excludeBody ? { body: sanitizeBody(req.body) } : {})
        };

        // Log asynchronously (don't block response)
        AuditService.logUserAction(req, action, entityName, entityId, details, req).catch(err => {
          console.error('Audit logging error:', err);
        });
      }

      return originalJson.call(this, data);
    };

    // Override res.send
    res.send = function(data) {
      responseSent = true;
      statusCode = res.statusCode || 200;
      return originalSend.call(this, data);
    };

    // Override res.status
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    next();
  };
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body) {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'access_token', 'refresh_token'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
}

/**
 * Manual audit logging function for specific actions
 */
async function logAction(req, action, entity, entityId, details = null) {
  try {
    await AuditService.logUserAction(req, action, entity, entityId, details, req);
  } catch (error) {
    console.error('Manual audit logging error:', error);
  }
}

module.exports = {
  auditLogger,
  logAction
};

