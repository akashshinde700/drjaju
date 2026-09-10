/**
 * Constants Index
 * Central export point for all application constants
 * 
 * Usage:
 *   const { HTTP_STATUS, MESSAGES, PAGINATION, ROLES } = require('./constants');
 *   
 *   // Or individual imports:
 *   const { HTTP_STATUS } = require('./constants');
 *   const { MESSAGES } = require('./constants');
 * 
 * @module constants
 */

const HTTP_STATUS = require('./httpStatus');
const MESSAGES = require('./messages');
const PAGINATION = require('./pagination');
const {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} = require('./roles');

module.exports = {
  // HTTP Status Codes
  HTTP_STATUS,

  // Response Messages
  MESSAGES,

  // Pagination
  PAGINATION,

  // Roles and Permissions
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
};
