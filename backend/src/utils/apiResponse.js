/**
 * @file ApiResponse - Standardized API Response Handler
 * @description Provides a consistent response structure for all API endpoints
 * @version 1.0.0
 */

const { HTTP_STATUS, MESSAGES } = require('../constants');

/**
 * @class ApiResponse
 * @description Standardized API response class for consistent response formatting
 * @example
 * // In controller
 * res.status(200).json(new ApiResponse(200, data, MESSAGES.SUCCESS.operation));
 * // Or use convenience methods
 * res.status(200).json(ApiResponse.success(data));
 * res.status(201).json(ApiResponse.created(data));
 * res.status(200).json(ApiResponse.paginated(data, page, limit, total));
 */
class ApiResponse {
  /**
   * @constructor
   * @param {number} statusCode - HTTP status code
   * @param {*} data - Response data payload
   * @param {string} message - Response message
   * @param {boolean} success - Success flag (auto-calculated if not provided)
   */
  constructor(statusCode, data, message = MESSAGES.SUCCESS.operation, success = null) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    // Auto-determine success based on statusCode if not explicitly provided
    this.success = success !== null ? success : statusCode >= 200 && statusCode < 300;
    this.timestamp = new Date().toISOString();
  }

  /**
   * @static
   * @method success
   * @param {*} data - Response data
   * @param {string} [message] - Custom message
   * @returns {ApiResponse} Formatted success response (200)
   * @example
   * const response = ApiResponse.success(user);
   * const response = ApiResponse.success(items, 'Items retrieved successfully');
   */
  static success(data, message = MESSAGES.SUCCESS.dataFetched) {
    return new ApiResponse(HTTP_STATUS.OK, data, message, true);
  }

  /**
   * @static
   * @method created
   * @param {*} data - Created resource data
   * @param {string} [message] - Custom message
   * @returns {ApiResponse} Formatted creation response (201)
   * @example
   * const response = ApiResponse.created(newUser, MESSAGES.SUCCESS.created);
   */
  static created(data, message = MESSAGES.SUCCESS.created) {
    return new ApiResponse(HTTP_STATUS.CREATED, data, message, true);
  }

  /**
   * @static
   * @method updated
   * @param {*} data - Updated resource data
   * @param {string} [message] - Custom message
   * @returns {ApiResponse} Formatted update response (200)
   * @example
   * const response = ApiResponse.updated(updatedUser);
   */
  static updated(data, message = MESSAGES.SUCCESS.updated) {
    return new ApiResponse(HTTP_STATUS.OK, data, message, true);
  }

  /**
   * @static
   * @method deleted
   * @param {*} [data] - Deleted resource or count
   * @param {string} [message] - Custom message
   * @returns {ApiResponse} Formatted deletion response (200)
   * @example
   * const response = ApiResponse.deleted(null, MESSAGES.SUCCESS.deleted);
   */
  static deleted(data = null, message = MESSAGES.SUCCESS.deleted) {
    return new ApiResponse(HTTP_STATUS.OK, data, message, true);
  }

  /**
   * @static
   * @method paginated
   * @param {Array} data - Array of items
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} total - Total count
   * @param {string} [message] - Custom message
   * @returns {ApiResponse} Formatted paginated response (200)
   * @example
   * const response = ApiResponse.paginated(users, 1, 10, 100);
   */
  static paginated(data, page, limit, total, message = MESSAGES.SUCCESS.retrieved) {
    const totalPages = Math.ceil(total / limit);
    return new ApiResponse(
      HTTP_STATUS.OK,
      {
        data,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      message,
      true
    );
  }

  /**
   * @static
   * @method accepted
   * @param {*} [data] - Additional data
   * @param {string} [message] - Custom message
   * @returns {ApiResponse} Formatted accepted response (202)
   * @example
   * const response = ApiResponse.accepted(jobId, 'Bulk import started');
   */
  static accepted(data = null, message = 'Request accepted and processing') {
    return new ApiResponse(HTTP_STATUS.ACCEPTED, data, message, true);
  }

  /**
   * @static
   * @method noContent
   * @returns {ApiResponse} No content response (204)
   * @example
   * const response = ApiResponse.noContent();
   */
  static noContent() {
    return new ApiResponse(HTTP_STATUS.NO_CONTENT, null, 'No content', true);
  }

  /**
   * @method toJSON
   * @description Converts response to JSON (automatically called by express)
   * @returns {Object} Serialized response object
   */
  toJSON() {
    return {
      statusCode: this.statusCode,
      success: this.success,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    };
  }
}

module.exports = ApiResponse;
