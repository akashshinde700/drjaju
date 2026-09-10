/**
 * User Roles and Permissions
 * Role definitions and permission mappings
 * 
 * @module constants/roles
 */

const ROLES = {
  // Role identifiers
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
  PATIENT: 'patient',
  STAFF: 'staff',
  MODERATOR: 'moderator',
  GUEST: 'guest',
};

const PERMISSIONS = {
  // User Management
  USER: {
    CREATE: 'user:create',
    READ: 'user:read',
    UPDATE: 'user:update',
    DELETE: 'user:delete',
    LIST: 'user:list',
  },

  // Patient Management
  PATIENT: {
    CREATE: 'patient:create',
    READ: 'patient:read',
    UPDATE: 'patient:update',
    DELETE: 'patient:delete',
    LIST: 'patient:list',
    VIEW_RECORDS: 'patient:view-records',
  },

  // Doctor Management
  DOCTOR: {
    CREATE: 'doctor:create',
    READ: 'doctor:read',
    UPDATE: 'doctor:update',
    DELETE: 'doctor:delete',
    LIST: 'doctor:list',
    SCHEDULE: 'doctor:schedule',
  },

  // Appointment Management
  APPOINTMENT: {
    CREATE: 'appointment:create',
    READ: 'appointment:read',
    UPDATE: 'appointment:update',
    DELETE: 'appointment:delete',
    LIST: 'appointment:list',
    RESCHEDULE: 'appointment:reschedule',
    CANCEL: 'appointment:cancel',
  },

  // Billing & Payments
  BILLING: {
    CREATE: 'billing:create',
    READ: 'billing:read',
    UPDATE: 'billing:update',
    DELETE: 'billing:delete',
    LIST: 'billing:list',
    PROCESS_PAYMENT: 'billing:process-payment',
    GENERATE_INVOICE: 'billing:generate-invoice',
  },

  // Reports
  REPORTS: {
    VIEW: 'reports:view',
    GENERATE: 'reports:generate',
    EXPORT: 'reports:export',
    DELETE: 'reports:delete',
  },

  // Settings
  SETTINGS: {
    READ: 'settings:read',
    UPDATE: 'settings:update',
    MANAGE: 'settings:manage',
  },

  // System
  SYSTEM: {
    VIEW_LOGS: 'system:view-logs',
    MANAGE_BACKUPS: 'system:manage-backups',
    VIEW_ANALYTICS: 'system:view-analytics',
    MANAGE_ROLES: 'system:manage-roles',
  },
};

// Role-based permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS).flatMap(p => Object.values(p)),

  [ROLES.ADMIN]: [
    ...Object.values(PERMISSIONS.USER),
    ...Object.values(PERMISSIONS.PATIENT),
    ...Object.values(PERMISSIONS.DOCTOR),
    ...Object.values(PERMISSIONS.APPOINTMENT),
    ...Object.values(PERMISSIONS.BILLING),
    ...Object.values(PERMISSIONS.REPORTS),
    ...Object.values(PERMISSIONS.SETTINGS),
    PERMISSIONS.SYSTEM.VIEW_LOGS,
    PERMISSIONS.SYSTEM.VIEW_ANALYTICS,
  ],

  [ROLES.DOCTOR]: [
    PERMISSIONS.USER.READ,
    PERMISSIONS.USER.UPDATE,
    ...Object.values(PERMISSIONS.PATIENT),
    PERMISSIONS.DOCTOR.READ,
    PERMISSIONS.DOCTOR.UPDATE,
    PERMISSIONS.DOCTOR.SCHEDULE,
    ...Object.values(PERMISSIONS.APPOINTMENT),
    PERMISSIONS.BILLING.READ,
    PERMISSIONS.BILLING.LIST,
    PERMISSIONS.REPORTS.VIEW,
  ],

  [ROLES.RECEPTIONIST]: [
    PERMISSIONS.PATIENT.CREATE,
    PERMISSIONS.PATIENT.READ,
    PERMISSIONS.PATIENT.UPDATE,
    PERMISSIONS.PATIENT.LIST,
    PERMISSIONS.DOCTOR.READ,
    PERMISSIONS.DOCTOR.LIST,
    PERMISSIONS.APPOINTMENT.CREATE,
    PERMISSIONS.APPOINTMENT.READ,
    PERMISSIONS.APPOINTMENT.UPDATE,
    PERMISSIONS.APPOINTMENT.LIST,
    PERMISSIONS.APPOINTMENT.RESCHEDULE,
    PERMISSIONS.APPOINTMENT.CANCEL,
    PERMISSIONS.BILLING.CREATE,
    PERMISSIONS.BILLING.READ,
    PERMISSIONS.BILLING.LIST,
  ],

  [ROLES.PATIENT]: [
    PERMISSIONS.USER.READ,
    PERMISSIONS.USER.UPDATE,
    PERMISSIONS.PATIENT.READ,
    PERMISSIONS.PATIENT.UPDATE,
    PERMISSIONS.PATIENT.VIEW_RECORDS,
    PERMISSIONS.APPOINTMENT.CREATE,
    PERMISSIONS.APPOINTMENT.READ,
    PERMISSIONS.APPOINTMENT.LIST,
    PERMISSIONS.APPOINTMENT.CANCEL,
    PERMISSIONS.BILLING.READ,
    PERMISSIONS.BILLING.LIST,
  ],

  [ROLES.STAFF]: [
    PERMISSIONS.PATIENT.READ,
    PERMISSIONS.PATIENT.LIST,
    PERMISSIONS.APPOINTMENT.READ,
    PERMISSIONS.APPOINTMENT.LIST,
    PERMISSIONS.BILLING.READ,
    PERMISSIONS.BILLING.LIST,
  ],

  [ROLES.MODERATOR]: [
    ...Object.values(PERMISSIONS.USER),
    ...Object.values(PERMISSIONS.REPORTS),
    PERMISSIONS.SYSTEM.VIEW_LOGS,
  ],

  [ROLES.GUEST]: [
    PERMISSIONS.PATIENT.CREATE, // Registration
  ],
};

// Helper functions
const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

const hasPermission = (userRole, requiredPermission) => {
  const permissions = getRolePermissions(userRole);
  return permissions.includes(requiredPermission);
};

const hasAnyPermission = (userRole, requiredPermissions = []) => {
  const permissions = getRolePermissions(userRole);
  return requiredPermissions.some(perm => permissions.includes(perm));
};

const hasAllPermissions = (userRole, requiredPermissions = []) => {
  const permissions = getRolePermissions(userRole);
  return requiredPermissions.every(perm => permissions.includes(perm));
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
};
