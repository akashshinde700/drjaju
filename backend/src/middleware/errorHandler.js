// Comprehensive error handler
let logger;
try {
  logger = require('../services/logger');
} catch (e) {
  // Fallback simple logger if service not found
  logger = {
    error: (msg, err, ctx) => console.error('[ERROR]', msg, err?.message || err, ctx),
    critical: (msg, err, ctx) => console.error('[CRITICAL]', msg, err?.message || err, ctx)
  };
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log error with context
  const errorContext = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    user: req.user?.id || 'anonymous',
    code: err.code,
    sqlMessage: err.sqlMessage,
    statusCode: err.statusCode,
    isOperational: err.isOperational
  };

  logger.error('Request error', err, errorContext);

  // Log critical errors
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
    logger.critical('Database connection error', err, errorContext);
  }

  // Handle custom ApiError class
  if (err.constructor.name === 'ApiError' || err.statusCode) {
    const response = {
      success: false,
      error: err.message,
      statusCode: err.statusCode,
      timestamp: err.timestamp || new Date().toISOString()
    };

    // Add errors array if present
    if (err.errors && err.errors.length > 0) {
      response.errors = err.errors;
    }

    // Include stack trace only in development for ApiError
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  // MySQL validation errors
  if (err.code === 'ER_BAD_NULL_ERROR') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Required field is missing',
      field: err.sqlMessage?.match(/Column '([^']+)'/)?.[1] || 'unknown'
    });
  }

  if (err.code === 'ER_DATA_TOO_LONG') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Data exceeds maximum allowed length',
      field: err.sqlMessage?.match(/Column '([^']+)'/)?.[1] || 'unknown'
    });
  }

  if (err.code === 'ER_NO_DEFAULT_FOR_FIELD') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Missing required field value',
      field: err.sqlMessage?.match(/Column '([^']+)'/)?.[1] || 'unknown'
    });
  }

  if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
    return res.status(400).json({
      success: false,
      error: 'Invalid data type',
      message: 'Invalid value for field',
      field: err.sqlMessage?.match(/Column '([^']+)'/)?.[1] || 'unknown'
    });
  }

  // MySQL duplicate key errors
  if (err.code === 'ER_DUP_ENTRY') {
    const fieldMatch = err.sqlMessage?.match(/for key '([^']+)'/);
    const field = fieldMatch ? fieldMatch[1] : 'unique field';
    
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      message: `A record with this ${field} already exists`,
      field
    });
  }

  // MySQL foreign key errors
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference',
      message: 'Referenced record does not exist'
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(400).json({
      success: false,
      error: 'Referenced record',
      message: 'Cannot delete record that is referenced by other records'
    });
  }

  // MySQL connection errors
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Invalid field in query'
    });
  }

  if (err.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
    return res.status(503).json({
      success: false,
      error: 'Database timeout',
      message: 'Database operation timed out. Please try again.'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Authentication token is invalid or malformed'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      message: 'Authentication token has expired. Please login again.',
      expiredAt: err.expiredAt
    });
  }

  if (err.name === 'NotBeforeError') {
    return res.status(401).json({
      success: false,
      error: 'Token not active',
      message: 'Authentication token is not yet active'
    });
  }

  // Invalid ID format errors
  if (err.message && err.message.includes('Invalid ID format')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      message: 'ID must be a valid number or UUID'
    });
  }

  // Joi validation errors
  if (err.name === 'ValidationError' && err.isJoi) {
    const errors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Request validation failed',
      errors
    });
  }

  // General validation errors
  if (err.name === 'ValidationError' || err.status === 400) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message || 'Request validation failed',
      ...(process.env.NODE_ENV === 'development' && { details: err.details })
    });
  }

  // Authorization errors
  if (err.status === 401) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: err.message || 'Authentication required'
    });
  }

  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: err.message || 'You do not have permission to access this resource'
    });
  }

  // Not found errors
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: err.message || 'The requested resource was not found'
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: err.message || 'Rate limit exceeded. Please try again later.'
    });
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  const response = {
    success: false,
    error: status === 500 ? 'Internal server error' : (err.message || 'An error occurred'),
    message: status === 500 ? 'Something went wrong on our end. Please try again later.' : undefined
  };

  // Include stack trace and details only in non-production
  if ((process.env.NODE_ENV || 'development').toLowerCase().trim() !== 'production') {
    response.stack = err.stack;
    response.details = {
      name: err.name,
      code: err.code,
      sqlMessage: err.sqlMessage,
      sqlState: err.sqlState,
      index: err.index
    };
  }

  res.status(status).json(response);
}

module.exports = errorHandler;

