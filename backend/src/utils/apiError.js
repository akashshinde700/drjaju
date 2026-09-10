/**
 * @file ApiError - Custom Error Handler for APIs
 * @description Provides standardized error responses with predefined error types
 * @version 1.0.0
 */

const { HTTP_STATUS, MESSAGES } = require('../constants');

/**
 * @class ApiError
 * @extends Error
 * @description Custom error class for API exception handling with standardized error formatting
 * @example
 * // Throw custom errors
 * throw ApiError.badRequest(MESSAGES.VALIDATION.required('Email'));
 * throw ApiError.unauthorized();
 * throw ApiError.notFound('User');
 * throw ApiError.conflict('Email already registered');
 * throw ApiError.internal('Database connection failed');
 */
class ApiError extends Error {
  /**
   * @constructor
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Array} [errors] - Additional error details
   * @param {string} [stack] - Error stack trace
   */
  constructor(statusCode, message = MESSAGES.SERVER.internalError, errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.success = false;
    this.timestamp = new Date().toISOString();

    // Capture actual stack trace
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * @static
   * @method badRequest
   * @param {string} [message] - Custom message
   * @param {Array} [errors] - Validation errors
   * @returns {ApiError} Bad request error (400)
   * @example
   * throw ApiError.badRequest('Invalid email format', ['email']);
   */
  static badRequest(message = MESSAGES.VALIDATION.required('Input'), errors = []) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, errors);
  }

  /**
   * @static
   * @method unauthorized
   * @param {string} [message] - Custom message
   * @returns {ApiError} Unauthorized error (401)
   * @example
   * throw ApiError.unauthorized('Please login to continue');
   */
  static unauthorized(message = MESSAGES.AUTH.unauthorized) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, []);
  }

  /**
   * @static
   * @method forbidden
   * @param {string} [message] - Custom message
   * @returns {ApiError} Forbidden error (403)
   * @example
   * throw ApiError.forbidden('You do not have permission to access this resource');
   */
  static forbidden(message = MESSAGES.AUTH.forbidden) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, []);
  }

  /**
   * @static
   * @method notFound
   * @param {string} [resource] - Resource name
   * @param {string} [field] - Specific field that was not found
   * @returns {ApiError} Not found error (404)
   * @example
   * throw ApiError.notFound('User', 'id');
   * throw ApiError.notFound('Patient');
   */
  static notFound(resource = 'Resource', field = null) {
    const message = field
      ? `${resource} with specified ${field} not found`
      : `${resource} not found`;
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, []);
  }

  /**
   * @static
   * @method conflict
   * @param {string} [message] - Custom message
   * @param {string} [field] - Field that caused conflict
   * @returns {ApiError} Conflict error (409)
   * @example
   * throw ApiError.conflict('This email is already registered', 'email');
   * throw ApiError.conflict('Doctor already has appointment at this time');
   */
  static conflict(message = MESSAGES.RESOURCE.alreadyExists, field = null) {
    const fullMessage = field ? `${message} (${field})` : message;
    return new ApiError(HTTP_STATUS.CONFLICT, fullMessage, []);
  }

  /**
   * @static
   * @method unprocessableEntity
   * @param {string} [message] - Custom message
   * @param {Array} [errors] - Detailed validation errors
   * @returns {ApiError} Unprocessable entity error (422)
   * @example
   * throw ApiError.unprocessableEntity('Validation failed', ['field1', 'field2']);
   */
  static unprocessableEntity(message = MESSAGES.VALIDATION.invalidCredentials, errors = []) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, errors);
  }

  /**
   * @static
   * @method tooManyRequests
   * @param {string} [message] - Custom message
   * @returns {ApiError} Too many requests error (429)
   * @example
   * throw ApiError.tooManyRequests('Too many login attempts. Try again later.');
   */
  static tooManyRequests(message = MESSAGES.SERVER.rateLimited) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message, []);
  }

  /**
   * @static
   * @method internal
   * @param {string} [message] - Custom message
   * @param {Array} [errors] - Additional error context
   * @returns {ApiError} Internal server error (500)
   * @example
   * throw ApiError.internal('Failed to query database');
   * throw ApiError.internal('External API failed', ['payment_gateway_down']);
   */
  static internal(message = MESSAGES.SERVER.internalError, errors = []) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, errors);
  }

  /**
   * @static
   * @method serviceUnavailable
   * @param {string} [message] - Custom message
   * @returns {ApiError} Service unavailable error (503)
   * @example
   * throw ApiError.serviceUnavailable('Database is temporarily unavailable');
   */
  static serviceUnavailable(message = MESSAGES.SERVER.serviceUnavailable) {
    return new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, message, []);
  }

  /**
   * @static
   * @method invalidToken
   * @returns {ApiError} Invalid/expired token error
   * @example
   * throw ApiError.invalidToken();
   */
  static invalidToken() {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.invalidToken, []);
  }

  /**
   * @static
   * @method sessionExpired
   * @returns {ApiError} Session expired error
   * @example
   * throw ApiError.sessionExpired();
   */
  static sessionExpired() {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.sessionExpired, []);
  }

  /**
   * @static
   * @method accountLocked
   * @returns {ApiError} Account locked error
   * @example
   * throw ApiError.accountLocked();
   */
  static accountLocked() {
    return new ApiError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.accountLocked, []);
  }

  /**
   * @static
   * @method accountSuspended
   * @returns {ApiError} Account suspended error
   * @example
   * throw ApiError.accountSuspended();
   */
  static accountSuspended() {
    return new ApiError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.accountSuspended, []);
  }

  /**
   * @method toJSON
   * @description Converts error to JSON for API responses
   * @returns {Object} Serialized error object
   */
  toJSON() {
    return {
      statusCode: this.statusCode,
      success: this.success,
      message: this.message,
      errors: this.errors.length > 0 ? this.errors : undefined,
      timestamp: this.timestamp,
    };
  }
}

module.exports = ApiError;
