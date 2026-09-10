/**
 * Standardized Response Helper
 * Ensures consistent API response format across all endpoints
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message (optional)
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  const response = {
    success: true,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {*} details - Additional error details (optional)
 * @param {string} code - Error code for frontend handling (optional)
 */
function sendError(res, message = 'Internal server error', statusCode = 500, details = null, code = null) {
  const response = {
    success: false,
    error: message
  };
  
  if (details !== null) {
    response.details = details;
  }
  
  if (code !== null) {
    response.code = code;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Send validation error response (400)
 * @param {Object} res - Express response object
 * @param {string} message - Validation error message
 * @param {*} details - Validation details (optional)
 */
function sendValidationError(res, message = 'Validation failed', details = null) {
  return sendError(res, message, 400, details, 'VALIDATION_ERROR');
}

/**
 * Send not found error response (404)
 * @param {Object} res - Express response object
 * @param {string} message - Not found message
 */
function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, 404, null, 'NOT_FOUND');
}

/**
 * Send conflict error response (409)
 * @param {Object} res - Express response object
 * @param {string} message - Conflict message
 * @param {*} details - Conflict details (optional)
 */
function sendConflict(res, message = 'Resource conflict', details = null) {
  return sendError(res, message, 409, details, 'CONFLICT');
}

/**
 * Send created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Creation message
 */
function sendCreated(res, data = null, message = 'Resource created successfully') {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Unauthorized message
 */
function sendUnauthorized(res, message = 'Unauthorized access') {
  return sendError(res, message, 401, null, 'UNAUTHORIZED');
}

/**
 * Send forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Forbidden message
 */
function sendForbidden(res, message = 'Access forbidden') {
  return sendError(res, message, 403, null, 'FORBIDDEN');
}

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendConflict,
  sendCreated,
  sendUnauthorized,
  sendForbidden
};
