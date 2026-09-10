// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils');
const { HTTP_STATUS, MESSAGES, ROLES } = require('../constants');
const env = require('../config/env');

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header and attaches user to req.user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw ApiError.unauthorized(MESSAGES.AUTH.tokenRequired);
  }

  jwt.verify(token, env.jwtSecret || process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.sessionExpired();
      }
      if (err.name === 'JsonWebTokenError') {
        throw ApiError.invalidToken();
      }
      throw ApiError.unauthorized(MESSAGES.AUTH.invalidToken);
    }

    // Attach user to request object
    req.user = user;
    next();
  });
};

/**
 * JWT Authentication Middleware (header OR query token)
 * Scoped for routes that must support direct browser navigation/downloads
 * (e.g. admin backup file downloads) where an Authorization header can't be set.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateTokenOrQuery = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    throw ApiError.unauthorized(MESSAGES.AUTH.tokenRequired);
  }

  jwt.verify(token, env.jwtSecret || process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.sessionExpired();
      }
      if (err.name === 'JsonWebTokenError') {
        throw ApiError.invalidToken();
      }
      throw ApiError.unauthorized(MESSAGES.AUTH.invalidToken);
    }

    req.user = user;
    next();
  });
};

/**
 * Optional Authentication Middleware
 * Populates req.user if token present, but doesn't block if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token - continue without user context
    return next();
  }

  jwt.verify(token, env.jwtSecret || process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Invalid token - continue without user context
      return next();
    }
    req.user = user;
    next();
  });
};

/**
 * Role-based Authorization Middleware
 * Accepts multiple roles and checks if user has any of the required roles
 * @param {...string} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware function
 * @example
 * // Single role
 * router.get('/admin', authenticateToken, authorize(ROLES.ADMIN), adminHandler);
 * 
 * // Multiple roles
 * router.get('/dashboard', authenticateToken, authorize(ROLES.ADMIN, ROLES.DOCTOR), dashboardHandler);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      throw ApiError.unauthorized(MESSAGES.AUTH.loginRequired);
    }

    // Normalize roles for case-insensitive comparison
    const userRole = String(req.user.role).toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(role => String(role).toLowerCase());

    // Check if user has any of the allowed roles
    if (!normalizedAllowedRoles.includes(userRole)) {
      throw ApiError.forbidden(MESSAGES.AUTH.forbidden);
    }

    next();
  };
};

/**
 * Alternative name for authorize middleware for backward compatibility
 * Accepts multiple roles and checks if user has any of the required roles
 */
const requireRole = authorize;

/**
 * Permission-based Authorization Middleware
 * Checks if user has specific permission based on their role
 * @param {...string} requiredPermissions - Array of required permissions
 * @returns {Function} Express middleware function
 * @example
 * router.get('/reports', authenticateToken, requirePermission(PERMISSIONS.REPORTS.VIEW), reportsHandler);
 */
const requirePermission = (...requiredPermissions) => {
  const { hasAnyPermission } = require('../constants');
  
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      throw ApiError.unauthorized(MESSAGES.AUTH.loginRequired);
    }

    const userRole = req.user.role;
    
    // Check if user has any of the required permissions
    if (!hasAnyPermission(userRole, requiredPermissions)) {
      throw ApiError.forbidden(MESSAGES.AUTH.forbidden);
    }

    next();
  };
};

/**
 * Check if user is the owner of the resource or has admin privileges
 * @param {string} resourceUserId - User ID of the resource owner
 * @returns {Function} Express middleware function
 */
const requireOwnershipOrAdmin = (resourceUserId) => {
  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      throw ApiError.unauthorized(MESSAGES.AUTH.loginRequired);
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Allow if user is the owner or has admin privileges
    if (userId === resourceUserId || [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(userRole)) {
      return next();
    }

    throw ApiError.forbidden(MESSAGES.AUTH.forbidden);
  };
};

module.exports = {
  authenticateToken,
  authenticateTokenOrQuery,
  optionalAuth,
  authorize,
  requireRole, // Backward compatibility
  requirePermission,
  requireOwnershipOrAdmin,
};