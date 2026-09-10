/**
 * Response Messages
 * Standardized messages for API responses
 * 
 * @module constants/messages
 */

const MESSAGES = {
  // ============================================
  // SUCCESS MESSAGES
  // ============================================
  SUCCESS: {
    operation: 'Operation successful',
    created: 'Resource created successfully',
    updated: 'Resource updated successfully',
    deleted: 'Resource deleted successfully',
    retrieved: 'Resource retrieved successfully',
    loggedIn: 'Logged in successfully',
    loggedOut: 'Logged out successfully',
    passwordChanged: 'Password changed successfully',
    profileUpdated: 'Profile updated successfully',
    dataFetched: 'Data fetched successfully',
    imported: 'Data imported successfully',
    exported: 'Data exported successfully',
  },

  // ============================================
  // ERROR MESSAGES - VALIDATION
  // ============================================
  VALIDATION: {
    required: (field) => `${field} is required`,
    invalid: (field) => `${field} is invalid`,
    minLength: (field, length) => `${field} must be at least ${length} characters`,
    maxLength: (field, length) => `${field} must be at most ${length} characters`,
    email: 'Please provide a valid email address',
    phone: 'Please provide a valid phone number',
    password: 'Password must contain uppercase, lowercase, number and special character',
    passwordMismatch: 'Passwords do not match',
    numeric: (field) => `${field} must be a number`,
    unique: (field) => `${field} already exists`,
    date: (field) => `${field} must be a valid date`,
    url: 'Please provide a valid URL',
    file: {
      required: 'File is required',
      maxSize: (size) => `File size must not exceed ${size}MB`,
      invalidType: 'Invalid file type',
      corrupted: 'File is corrupted or invalid',
    },
  },

  // ============================================
  // ERROR MESSAGES - AUTHENTICATION
  // ============================================
  AUTH: {
    unauthorized: 'Unauthorized access',
    forbidden: 'Access forbidden',
    invalidCredentials: 'Invalid email or password',
    invalidToken: 'Invalid or expired token',
    tokenExpired: 'Token has expired',
    tokenRequired: 'Authentication token is required',
    sessionExpired: 'Your session has expired, please login again',
    alreadyLoggedIn: 'You are already logged in',
    loginRequired: 'Please login to continue',
    passwordIncorrect: 'Current password is incorrect',
    accountLocked: 'Account is locked. Please try again later',
    accountSuspended: 'Account has been suspended',
    accountDeleted: 'Account has been deleted',
  },

  // ============================================
  // ERROR MESSAGES - RESOURCE
  // ============================================
  RESOURCE: {
    notFound: (resource) => `${resource} not found`,
    alreadyExists: (resource) => `${resource} already exists`,
    cannotDelete: (resource) => `Cannot delete ${resource}`,
    cannotUpdate: (resource) => `Cannot update ${resource}`,
    inUse: (resource) => `${resource} is in use and cannot be deleted`,
    accessDenied: (resource) => `Access denied for this ${resource}`,
    archived: (resource) => `${resource} has been archived`,
    restored: (resource) => `${resource} has been restored`,
  },

  // ============================================
  // ERROR MESSAGES - BUSINESS LOGIC
  // ============================================
  BUSINESS: {
    insufficientBalance: 'Insufficient balance',
    paymentFailed: 'Payment processing failed',
    quotaExceeded: 'Quota exceeded',
    duplicateEntry: 'This entry already exists',
    conflictingData: 'Conflicting data detected',
    operationFailed: 'Operation failed',
    unsupportedOperation: 'This operation is not supported',
    dataConflict: 'Data conflict detected',
  },

  // ============================================
  // ERROR MESSAGES - SERVER
  // ============================================
  SERVER: {
    internalError: 'Internal server error',
    serviceUnavailable: 'Service temporarily unavailable',
    databaseError: 'Database error occurred',
    externalApiError: 'External API error',
    timeout: 'Request timeout',
    rateLimited: 'Too many requests, please try again later',
  },

  // ============================================
  // INFORMATIONAL MESSAGES
  // ============================================
  INFO: {
    noData: 'No data found',
    emptyList: 'No results found',
    pending: 'Operation is pending',
    processing: 'Processing your request',
    completed: 'Operation completed',
    inProgress: 'Operation in progress',
    queued: 'Request has been queued',
  },
};

module.exports = MESSAGES;
