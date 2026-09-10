<!-- Constants Directory - Documentation -->

# Constants Management

Complete guide to using the constants system in your Node.js + Express backend.

## 📁 Directory Structure

```
src/
└── constants/
    ├── httpStatus.js      # HTTP status codes (200, 201, 400, 401, etc.)
    ├── messages.js        # Response messages (success, errors, validation)
    ├── pagination.js      # Pagination defaults and utilities
    ├── roles.js           # User roles and permissions
    ├── index.js           # Central export point
    ├── USAGE_EXAMPLES.js  # Code examples (remove in production)
    └── README.md          # This file
```

## 🚀 Quick Start

### Importing Constants

```javascript
// Import all constants
const {
  HTTP_STATUS,
  MESSAGES,
  PAGINATION,
  ROLES,
  PERMISSIONS,
  hasPermission
} = require('./constants');

// Or import specific ones
const { HTTP_STATUS } = require('./constants');
const { MESSAGES } = require('./constants');
```

## 📋 HTTP Status Codes (httpStatus.js)

### Available Codes

```javascript
HTTP_STATUS.OK              // 200
HTTP_STATUS.CREATED         // 201
HTTP_STATUS.BAD_REQUEST     // 400
HTTP_STATUS.UNAUTHORIZED    // 401
HTTP_STATUS.FORBIDDEN       // 403
HTTP_STATUS.NOT_FOUND       // 404
HTTP_STATUS.CONFLICT        // 409
HTTP_STATUS.INTERNAL_SERVER_ERROR  // 500
// ... and more
```

### Usage Example

```javascript
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.RESOURCE.notFound('User')
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.retrieved,
      data: user
    });
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER.internalError
    });
  }
};
```

## 💬 Response Messages (messages.js)

### Message Categories

#### Success Messages
```javascript
MESSAGES.SUCCESS.operation      // "Operation successful"
MESSAGES.SUCCESS.created        // "Resource created successfully"
MESSAGES.SUCCESS.updated        // "Resource updated successfully"
MESSAGES.SUCCESS.deleted        // "Resource deleted successfully"
```

#### Validation Messages
```javascript
MESSAGES.VALIDATION.required('Email')        // "Email is required"
MESSAGES.VALIDATION.invalid('Phone')         // "Phone is invalid"
MESSAGES.VALIDATION.minLength('Password', 8) // "Password must be at least 8 characters"
MESSAGES.VALIDATION.email                    // "Please provide a valid email address"
MESSAGES.VALIDATION.unique('Username')       // "Username already exists"
```

#### Authentication Messages
```javascript
MESSAGES.AUTH.unauthorized          // "Unauthorized access"
MESSAGES.AUTH.forbidden             // "Access forbidden"
MESSAGES.AUTH.invalidCredentials    // "Invalid email or password"
MESSAGES.AUTH.tokenExpired          // "Token has expired"
MESSAGES.AUTH.sessionExpired        // "Your session has expired, please login again"
```

#### Resource Messages
```javascript
MESSAGES.RESOURCE.notFound('User')       // "User not found"
MESSAGES.RESOURCE.alreadyExists('Email') // "Email already exists"
MESSAGES.RESOURCE.inUse('Record')        // "Record is in use and cannot be deleted"
```

#### Server Messages
```javascript
MESSAGES.SERVER.internalError    // "Internal server error"
MESSAGES.SERVER.serviceUnavailable  // "Service temporarily unavailable"
MESSAGES.SERVER.databaseError    // "Database error occurred"
```

### Usage Example

```javascript
const createUser = async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.VALIDATION.required('Email')
    });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.VALIDATION.email
    });
  }

  try {
    const user = new User({ email, password });
    await user.save();

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.SUCCESS.created,
      data: user
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: MESSAGES.VALIDATION.unique('Email')
      });
    }
    
    throw error;
  }
};
```

## 📄 Pagination (pagination.js)

### Default Values

```javascript
PAGINATION.DEFAULT_PAGE          // 1
PAGINATION.DEFAULT_LIMIT         // 10
PAGINATION.MAX_LIMIT             // 100
PAGINATION.MIN_LIMIT             // 1
PAGINATION.DEFAULT_SORT_BY       // 'createdAt'
PAGINATION.DEFAULT_SORT_ORDER    // 'desc'
```

### Helper Methods

#### validate(page, limit)
Validates and sanitizes pagination parameters.

```javascript
const { page, limit } = PAGINATION.validate(req.query.page, req.query.limit);
// Returns: { page: 1, limit: 10 } (with safe values)
```

#### getOffset(page, limit)
Calculates offset for database SKIP operation.

```javascript
const offset = PAGINATION.getOffset(2, 10);
// Returns: 10 (for skipping first 10 records)
```

#### formatResponse(data, page, limit, total)
Formats response with pagination metadata.

```javascript
const response = PAGINATION.formatResponse(users, 1, 10, 150);
// Returns:
// {
//   data: [...users],
//   pagination: {
//     page: 1,
//     limit: 10,
//     total: 150,
//     totalPages: 15,
//     hasNextPage: true,
//     hasPrevPage: false
//   }
// }
```

### Usage Example

```javascript
const getUsers = async (req, res) => {
  try {
    // Get and validate pagination
    const { page, limit } = PAGINATION.validate(
      req.query.page,
      req.query.limit
    );

    // Calculate offset
    const offset = PAGINATION.getOffset(page, limit);

    // Fetch data
    const users = await User.find()
      .skip(offset)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    // Format response
    const response = PAGINATION.formatResponse(users, page, limit, total);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.retrieved,
      ...response
    });
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER.internalError
    });
  }
};
```

## 👥 Roles & Permissions (roles.js)

### Available Roles

```javascript
ROLES.SUPER_ADMIN      // 'super_admin'
ROLES.ADMIN            // 'admin'
ROLES.DOCTOR           // 'doctor'
ROLES.RECEPTIONIST     // 'receptionist'
ROLES.PATIENT          // 'patient'
ROLES.STAFF            // 'staff'
ROLES.MODERATOR        // 'moderator'
ROLES.GUEST            // 'guest'
```

### Permission Categories

```javascript
PERMISSIONS.USER        // User management permissions
PERMISSIONS.PATIENT     // Patient management permissions
PERMISSIONS.DOCTOR      // Doctor management permissions
PERMISSIONS.APPOINTMENT // Appointment permissions
PERMISSIONS.BILLING     // Billing & payment permissions
PERMISSIONS.REPORTS     // Report permissions
PERMISSIONS.SETTINGS    // Settings permissions
PERMISSIONS.SYSTEM      // System administration permissions
```

### Helper Functions

#### hasPermission(userRole, permission)
Check if a user role has a specific permission.

```javascript
if (hasPermission(user.role, PERMISSIONS.USER.DELETE)) {
  // Allow user deletion
}
```

#### hasAnyPermission(userRole, permissions)
Check if user has ANY of the specified permissions.

```javascript
if (hasAnyPermission(user.role, [
  PERMISSIONS.USER.CREATE,
  PERMISSIONS.USER.UPDATE
])) {
  // Allow user modification
}
```

#### hasAllPermissions(userRole, permissions)
Check if user has ALL of the specified permissions.

```javascript
if (hasAllPermissions(user.role, [
  PERMISSIONS.BILLING.CREATE,
  PERMISSIONS.BILLING.PROCESS_PAYMENT
])) {
  // Allow billing operations
}
```

### Usage Example - Authorization Middleware

```javascript
// Create permission-based middleware
const authorize = (requiredPermission) => {
  return (req, res, next) => {
    if (!hasPermission(req.user.role, requiredPermission)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: MESSAGES.AUTH.forbidden
      });
    }
    next();
  };
};

// Usage in routes
router.post(
  '/users',
  authorize(PERMISSIONS.USER.CREATE),
  createUserController
);

router.delete(
  '/users/:id',
  authorize(PERMISSIONS.USER.DELETE),
  deleteUserController
);
```

## 🔐 Best Practices

### 1. Always Use Status Constants
```javascript
// ✅ Good
res.status(HTTP_STATUS.OK).json(data);

// ❌ Avoid
res.status(200).json(data);
```

### 2. Use Message Constants
```javascript
// ✅ Good
message: MESSAGES.VALIDATION.required('Email')

// ❌ Avoid
message: 'Email is required'
```

### 3. Validate Pagination Always
```javascript
// ✅ Good
const { page, limit } = PAGINATION.validate(req.query.page, req.query.limit);

// ❌ Avoid
const page = req.query.page || 1;
const limit = req.query.limit || 10;
```

### 4. Centralize Permission Checks
```javascript
// ✅ Good - Use helper function
if (!hasPermission(user.role, PERMISSIONS.USER.DELETE)) {
  return res.status(HTTP_STATUS.FORBIDDEN).json(...);
}

// ❌ Avoid - Hardcoded checks
if (user.role !== 'admin') {
  return res.status(403).json(...);
}
```

## 🧪 Testing Tips

### Mock Constants in Tests
```javascript
jest.mock('./constants', () => ({
  HTTP_STATUS: { OK: 200, BAD_REQUEST: 400 },
  MESSAGES: { SUCCESS: { created: 'Created' } },
  // ... other mocks
}));
```

### Test Pagination Helper
```javascript
describe('PAGINATION.validate', () => {
  it('should return default values for invalid input', () => {
    const result = PAGINATION.validate(null, null);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should cap limit to MAX_LIMIT', () => {
    const result = PAGINATION.validate(1, 500);
    expect(result.limit).toBe(100);
  });
});
```

## 📦 Production Deployment

### Remove Usage Examples
Delete `USAGE_EXAMPLES.js` before deploying to production.

### Optimize Imports
```bash
# Good - Import only what you need
const { HTTP_STATUS, MESSAGES } = require('./constants');

# Avoid - Unnecessary full imports
const { HTTP_STATUS, MESSAGES, PAGINATION, ROLES, ... } = require('./constants');
```

## 🔄 Adding New Constants

### When adding new HTTP status codes:
1. Add to `httpStatus.js`
2. Export from `index.js` (if not already)

### When adding new messages:
1. Add to appropriate category in `messages.js`
2. Follow naming conventions

### When adding new roles/permissions:
1. Add to `ROLES` object
2. Add to `PERMISSIONS` object
3. Update `ROLE_PERMISSIONS` mapping
4. Export from `index.js`

## ❓ FAQ

**Q: Can I modify constants at runtime?**
A: No, treat all constants as immutable. Create configuration files if you need runtime values.

**Q: Should I use constants in database models?**
A: Yes, especially for enums like roles and status values.

**Q: How do I handle dynamic messages?**
A: Use functions that return formatted strings (like `VALIDATION.required(field)`).

**Q: Can constants be imported from frontend?**
A: No, keep them backend-only. Create separate constants for frontend if needed.

---

**Last Updated:** March 4, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
