/**
 * @file index - Central Export for All Utility Functions
 * @description Single import point for all backend utility functions
 * @version 1.0.0
 */

const ApiResponse = require('./apiResponse');
const ApiError = require('./apiError');
const asyncHandler = require('./asyncHandler');
const paginate = require('./paginate');
const {
  slugify,
  pick,
  cleanObject,
  buildSearchFilter,
  formatPhoneNumber,
  normalizeEmail,
  generateUniqueId,
  isValidObjectId,
  getInitials,
  truncateText,
  capitalizeWords,
  delay,
  groupBy,
  resolveClinicIdForPatient,
} = require('./helpers');

/**
 * @module utils
 * @description Centralized utility functions for backend development
 *
 * @example
 * // Import all utilities
 * const { ApiResponse, ApiError, asyncHandler, paginate, slugify, pick, ...helpers } = require('./utils');
 *
 * @example
 * // Import specific utilities
 * const { ApiResponse, ApiError, asyncHandler } = require('./utils');
 * const { slugify, pick } = require('./utils');
 *
 * @example
 * // Destructured import
 * const {
 *   ApiResponse,
 *   ApiError,
 *   asyncHandler,
 *   paginate,
 *   slugify,
 *   pick,
 *   cleanObject,
 *   buildSearchFilter,
 * } = require('./utils');
 */

module.exports = {
  // Error handling
  ApiError,
  AsyncError: ApiError, // Alias for backward compatibility

  // Response handling
  ApiResponse,

  // Middleware/Helpers
  asyncHandler,
  paginate,

  // String utilities
  slugify,
  capitalizeWords,
  truncateText,
  getInitials,
  normalizeEmail,
  formatPhoneNumber,

  // Object utilities
  pick,
  cleanObject,
  groupBy,
  resolveClinicIdForPatient,

  // Search/Filter utilities
  buildSearchFilter,

  // ID utilities
  generateUniqueId,
  isValidObjectId,

  // Async utilities
  delay,
};
