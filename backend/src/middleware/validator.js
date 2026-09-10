// Input validation middleware using express-validator pattern
// Simple validation without external dependencies

/**
 * Validate required fields in request body
 */
function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];
    
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Validate email format
 */
function validateEmail(field = 'email') {
  return (req, res, next) => {
    if (req.body[field] && req.body[field].trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body[field])) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Invalid email format for field: ${field}`
        });
      }
    }
    next();
  };
}

/**
 * Validate phone number (Indian format)
 */
function validatePhone(field = 'phone') {
  return (req, res, next) => {
    if (req.body[field] && req.body[field].trim() !== '') {
      // Remove common formatting characters
      const phone = req.body[field].replace(/\s+/g, '').replace(/\+/g, '').replace(/^91/, '').replace(/^0/, '');
      
      // Check if it's a valid 10-digit number
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Invalid phone number format for field: ${field}. Expected 10-digit mobile number.`
        });
      }
    }
    next();
  };
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function validateDate(field = 'date') {
  return (req, res, next) => {
    if (req.body[field]) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(req.body[field])) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Invalid date format for field: ${field}. Expected YYYY-MM-DD.`
        });
      }
      
      const date = new Date(req.body[field]);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Invalid date value for field: ${field}`
        });
      }
    }
    next();
  };
}

/**
 * Validate time format (HH:MM)
 */
function validateTime(field = 'time') {
  return (req, res, next) => {
    if (req.body[field]) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(req.body[field])) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Invalid time format for field: ${field}. Expected HH:MM (24-hour format).`
        });
      }
    }
    next();
  };
}

/**
 * Validate ID - supports both numeric IDs and alphanumeric patient IDs
 * Examples: 1, 123, "P882724640", "PAT001"
 */
function validateId(field = 'id') {
  return (req, res, next) => {
    const id = req.params[field] || req.body[field];
    
    // If no ID provided, skip validation (let the controller handle it)
    if (!id) {
      return next();
    }
    
    // Convert to string for validation
    const idStr = String(id).trim();

    // Check for invalid values
    if (idStr === '' || idStr === 'undefined' || idStr === 'null') {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid ID format for field: ${field}. ID cannot be empty.`
      });
    }

    // Normalize possible suffix-style IDs (e.g., 11084:1 or 11084/1)
    const normalizedId = idStr.split(':')[0].split('/')[0].trim();

    if (!normalizedId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid ID format for field: ${field}. ID cannot be empty after normalization.`
      });
    }

    // Check if it's a valid numeric ID (positive integer)
    const isNumericId = /^\d+$/.test(normalizedId) && parseInt(normalizedId, 10) > 0;

    // Check if it's a valid alphanumeric ID (like patient_id: P882724640)
    // Pattern: starts with letter, followed by letters or numbers, 2-50 chars total
    const isAlphanumericId = /^[A-Za-z][A-Za-z0-9_-]{1,49}$/.test(normalizedId);
    
    if (!isNumericId && !isAlphanumericId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid ID format for field: ${field}. Must be a positive number or valid alphanumeric ID.`
      });
    }
    
    next();
  };
}

/**
 * Validate strictly numeric ID (for tables that only use auto-increment IDs)
 */
function validateNumericId(field = 'id') {
  return (req, res, next) => {
    const id = req.params[field] || req.body[field];
    
    if (!id) {
      return next();
    }
    
    if (isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid ID format for field: ${field}. Must be a positive number.`
      });
    }
    next();
  };
}

/**
 * Validate patient ID specifically (supports P123456, PAT-001, etc.)
 */
function validatePatientId(field = 'id') {
  return (req, res, next) => {
    const id = req.params[field] || req.body[field];
    
    if (!id) {
      return next();
    }
    
    const idStr = String(id).trim();
    
    // Check for invalid values
    if (idStr === '' || idStr === 'undefined' || idStr === 'null') {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid patient ID for field: ${field}`
      });
    }
    
    // Normalize possible suffix-style IDs (e.g., 11084:1 or 11084/1)
    const normalizedId = idStr.split(':')[0].split('/')[0].trim();

    if (!normalizedId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid patient ID for field: ${field}`
      });
    }

    // Allow numeric ID (database primary key)
    const isNumericId = /^\d+$/.test(normalizedId) && parseInt(normalizedId, 10) > 0;

    // Allow alphanumeric patient_id (P882724640, PAT001, PATIENT-123, etc.)
    const isPatientId = /^[A-Za-z][A-Za-z0-9_-]*$/.test(normalizedId);

    if (!isNumericId && !isPatientId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid patient ID format for field: ${field}`
      });
    }
    
    next();
  };
}

/**
 * Validate string length
 */
function validateLength(field, min = 0, max = Infinity) {
  return (req, res, next) => {
    if (req.body[field] !== undefined) {
      const value = String(req.body[field]);
      if (value.length < min || value.length > max) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Field ${field} must be between ${min} and ${max} characters.`
        });
      }
    }
    next();
  };
}

/**
 * Validate enum values
 */
function validateEnum(field, allowedValues) {
  return (req, res, next) => {
    const value = req.body[field];
    
    if (value && !allowedValues.includes(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid value for ${field}. Allowed values: ${allowedValues.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Sanitize input - remove HTML tags and trim whitespace
 */
function sanitizeInput(req, res, next) {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/<[^>]*>/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
}

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validateDate,
  validateTime,
  validateId,
  validateNumericId,
  validatePatientId,
  validateLength,
  validateEnum,
  sanitizeInput
};