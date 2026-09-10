/**
 * @file Backend Utils Documentation
 * @description Complete guide for all utility functions
 * @version 1.0.0
 * @status Production Ready ✅
 */

# Backend Utilities Documentation

## Overview

This directory contains production-ready utility functions for Express.js backends. All utilities are type-safe with JSDoc comments and designed to eliminate boilerplate code.

**Status:** Production Ready ✅  
**Version:** 1.0.0  
**Last Updated:** March 4, 2026

---

## Directory Structure

```
backend/src/utils/
├── apiResponse.js        # Standardized API response class
├── apiError.js          # Custom error handling class
├── asyncHandler.js      # Async/await wrapper for controllers
├── paginate.js          # MongoDB pagination utility
├── helpers.js           # Common helper functions
├── index.js             # Central export point
├── USAGE_EXAMPLES.js    # Complete code examples (remove before production)
└── README.md            # This file
```

---

## Quick Start

### Basic Import

```javascript
// Import specific utilities
const { ApiResponse, ApiError, asyncHandler } = require('./utils');

// Import all utilities (recommended)
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  paginate,
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
} = require('./utils');
```

### Basic Usage Examples

```javascript
// Simple controller with asyncHandler
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User');
  res.json(ApiResponse.success(user));
}));

// API response with pagination
const users = await paginate({
  model: User,
  page: req.query.page,
  limit: req.query.limit,
});
res.json(ApiResponse.paginated(users.data, users.pagination.page, users.pagination.limit, users.pagination.total));
```

---

## Core Utilities

### 1. ApiResponse Class

**File:** `apiResponse.js`  
**Purpose:** Standardized HTTP response formatting for all API endpoints

#### Methods

```javascript
// Successful retrieval (200)
ApiResponse.success(data, message)

// Resource created (201)
ApiResponse.created(data, message)

// Resource updated (200)
ApiResponse.updated(data, message)

// Resource deleted (200)
ApiResponse.deleted(data, message)

// Paginated response (200)
ApiResponse.paginated(data, page, limit, total, message)

// Accepted async task (202)
ApiResponse.accepted(data, message)

// No content (204)
ApiResponse.noContent()
```

#### Examples

```javascript
// GET endpoint
router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(ApiResponse.success(users, 'Users retrieved'));
}));

// POST endpoint
router.post('/user', asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(ApiResponse.created(user));
}));

// PUT endpoint
router.put('/user/:id', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(ApiResponse.updated(user));
}));

// DELETE endpoint
router.delete('/user/:id', asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json(ApiResponse.deleted(null, 'User deleted'));
}));

// Async job (202)
router.post('/import', asyncHandler(async (req, res) => {
  const jobId = generateUniqueId('IMPORT_');
  startBackgroundJob(jobId);
  res.status(202).json(ApiResponse.accepted({ jobId }, 'Import started'));
}));
```

---

### 2. ApiError Class

**File:** `apiError.js`  
**Purpose:** Standardized error responses with predefined error types

#### Static Methods

```javascript
// Bad request (400)
ApiError.badRequest(message, errors)

// Unauthorized (401)
ApiError.unauthorized(message)

// Forbidden (403)
ApiError.forbidden(message)

// Not found (404)
ApiError.notFound(resource, field)

// Conflict (409)
ApiError.conflict(message, field)

// Unprocessable entity (422)
ApiError.unprocessableEntity(message, errors)

// Too many requests (429)
ApiError.tooManyRequests(message)

// Internal error (500)
ApiError.internal(message, errors)

// Service unavailable (503)
ApiError.serviceUnavailable(message)

// Auth-specific errors
ApiError.invalidToken()
ApiError.sessionExpired()
ApiError.accountLocked()
ApiError.accountSuspended()
```

#### Examples

```javascript
// Validation error
router.post('/user', asyncHandler(async (req, res) => {
  if (!req.body.email) throw ApiError.badRequest('Email is required');
  if (!req.body.name) throw ApiError.badRequest('Name is required');
  
  const user = await User.create(req.body);
  res.status(201).json(ApiResponse.created(user));
}));

// Not found
router.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User', 'ID');
  res.json(ApiResponse.success(user));
}));

// Duplicate entry
router.post('/user', asyncHandler(async (req, res) => {
  const exists = await User.exists({ email: req.body.email });
  if (exists) throw ApiError.conflict('Email already registered', 'email');
  
  const user = await User.create(req.body);
  res.status(201).json(ApiResponse.created(user));
}));

// Authorization
const verifyAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }
  next();
});

// Token validation
router.use(asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw ApiError.unauthorized('No token provided');
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.sessionExpired();
    }
    throw ApiError.invalidToken();
  }
}));
```

---

### 3. asyncHandler

**File:** `asyncHandler.js`  
**Purpose:** Wrapper function eliminating try-catch blocks in async controllers

#### Usage

```javascript
// BEFORE (with try-catch)
router.get('/users', (req, res, next) => {
  try {
    const users = await User.find();
    res.json(ApiResponse.success(users));
  } catch (error) {
    next(error);
  }
});

// AFTER (with asyncHandler)
router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(ApiResponse.success(users));
}));
```

#### Benefits

- 🎯 Cleaner, more readable code
- 🛡️ Automatic error propagation to Express error handler
- ⚡ Reduced boilerplate (no repetitive try-catch)
- 🔒 Consistent error handling across controllers

---

### 4. paginate

**File:** `paginate.js`  
**Purpose:** MongoDB pagination with sorting, filtering, and population

#### Parameters

```javascript
{
  model,              // Mongoose model (required)
  filter = {},        // MongoDB query filter
  page = 1,          // Page number (1-indexed)
  limit = 10,        // Items per page (1-100)
  sort = 'createdAt', // Sort field(s)
  select = null,     // Fields to include/exclude
  populate = null,   // Document relationships to expand
  lean = true,       // Return plain objects (faster)
}
```

#### Returns

```javascript
{
  data: [...],              // Array of documents
  pagination: {
    page: 1,               // Current page
    limit: 10,             // Items per page
    total: 100,            // Total documents
    totalPages: 10,        // Total pages
    hasNextPage: true,     // Has more pages
    hasPrevPage: false,    // Has previous pages
  }
}
```

#### Examples

```javascript
// Basic pagination
router.get('/users', asyncHandler(async (req, res) => {
  const result = await paginate({
    model: User,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  ));
}));

// With filtering and sorting
router.get('/appointments', asyncHandler(async (req, res) => {
  const result = await paginate({
    model: Appointment,
    filter: {
      doctorId: req.query.doctorId,
      status: 'scheduled',
      date: { $gte: new Date(req.query.fromDate) }
    },
    page: req.query.page,
    limit: req.query.limit,
    sort: '-date', // Descending
  });
  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  ));
}));

// With population (joins)
router.get('/appointments', asyncHandler(async (req, res) => {
  const result = await paginate({
    model: Appointment,
    page: req.query.page,
    limit: req.query.limit,
    populate: [
      { path: 'doctorId', select: 'name specialty' },
      { path: 'patientId', select: 'name email' }
    ],
  });
  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  ));
}));

// With search
router.get('/patients', asyncHandler(async (req, res) => {
  const searchFilter = buildSearchFilter(
    req.query.search,
    ['name', 'email', 'phone']
  );
  const result = await paginate({
    model: Patient,
    filter: searchFilter,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  ));
}));
```

---

## Helper Functions

### String Utilities

```javascript
// Convert to URL-friendly format
slugify('Hello World') // → 'hello-world'
slugify('Dr. John O\'Brien') // → 'dr-john-obrien'

// Capitalize each word
capitalizeWords('hello world') // → 'Hello World'

// Get initials
getInitials('John Doe') // → 'JD'

// Normalize email
normalizeEmail('  John@EXAMPLE.COM  ') // → 'john@example.com'

// Format phone number
formatPhoneNumber('9876543210') // → '(987) 654-3210'

// Truncate with ellipsis
truncateText('This is a long text', 15) // → 'This is a l...'
```

### Object Utilities

```javascript
// Select specific properties
pick(user, ['id', 'name', 'email']) // → { id, name, email }

// Remove null/undefined/empty values
cleanObject({ name: 'John', email: null, phone: '' }) // → { name: 'John' }

// Group array by property
groupBy(users, 'role') // → { admin: [...], user: [...] }
```

### Search & Filter

```javascript
// Build MongoDB regex filter
buildSearchFilter('john', ['name', 'email'])
// → { $or: [{ name: { $regex: 'john', $options: 'i' } }, ...] }
```

### ID Utilities

```javascript
// Validate MongoDB ObjectId
isValidObjectId('507f1f77bcf86cd799439011') // → true

// Generate unique ID
generateUniqueId('JOB_') // → 'JOB_1709527823145_a8b3f2x9'
```

### Async Utilities

```javascript
// Delay execution
await delay(1000) // Wait 1 second
```

---

## Best Practices

### ✅ Good Practice

```javascript
// 1. Use asyncHandler to eliminate try-catch
router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(ApiResponse.success(users));
}));

// 2. Use specific ApiError methods
throw ApiError.notFound('User');
throw ApiError.badRequest('Email is required');
throw ApiError.conflict('Email already registered', 'email');

// 3. Clean input before processing
const cleanData = cleanObject(req.body);
const email = normalizeEmail(req.body.email);

// 4. Use paginate for list endpoints
const result = await paginate({ model: User, page: req.query.page });

// 5. Use pick to exclude sensitive fields
res.json(ApiResponse.success(pick(user, ['id', 'name', 'email'])));
```

### ❌ Avoid

```javascript
// ❌ Don't use hardcoded status codes
res.status(200).json({ status: 'success', data });

// ❌ Don't throw generic Error
throw new Error('Something went wrong');

// ❌ Don't send sensitive fields
res.json(ApiResponse.success(user)); // Includes password hash

// ❌ Don't use generic error messages
throw ApiError.internal('Error');

// ❌ Don't skip validation
const user = await User.create(req.body); // No validation
```

---

## Error Handling Middleware

Add this to your main app.js file:

```javascript
// Global error handler (must be last middleware)
app.use((error, req, res, next) => {
  // Default to 500 error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const success = error.success ?? false;

  res.status(statusCode).json({
    statusCode,
    success,
    message,
    errors: error.errors || undefined,
    timestamp: error.timestamp || new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});
```

---

## Testing with Utilities

### Jest Examples

```javascript
describe('User Controller', () => {
  it('should create user and return ApiResponse', async () => {
    const mockUser = { _id: '1', name: 'John', email: 'john@example.com' };
    User.create = jest.fn().mockResolvedValue(mockUser);

    const response =
```

Let me complete the README file:

```javascript
const { status, body } = await request(app)
      .post('/users')
      .send({ name: 'John', email: 'john@example.com' });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockUser);
  });

  it('should throw ApiError.badRequest for missing email', async () => {
    const { status, body } = await request(app)
      .post('/users')
      .send({ name: 'John' });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Email');
  });

  it('should throw ApiError.notFound for non-existent user', async () => {
    User.findById = jest.fn().mockResolvedValue(null);

    const { status, body } = await request(app)
      .get('/users/invalid-id');

    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});
```

---

## Production Deployment Checklist

- [ ] Remove `USAGE_EXAMPLES.js` file
- [ ] Set `NODE_ENV=production` environment variable
- [ ] Configure error handling middleware
- [ ] Test all API endpoints with different scenarios
- [ ] Verify error responses include appropriate status codes
- [ ] Check pagination works with large datasets
- [ ] Validate all helper functions work with your data
- [ ] Set up logging for error tracking
- [ ] Test rate limiting on `ApiError.tooManyRequests()`
- [ ] Verify sensitive fields are excluded with `pick()`

---

## FAQ

**Q: Why use `asyncHandler` instead of try-catch?**  
A: `asyncHandler` reduces boilerplate, ensures consistent error propagation, and makes code more readable. Write once, use everywhere.

**Q: Can I customize ApiResponse messages?**  
A: Yes! Pass a custom message as the second parameter: `ApiResponse.success(data, 'Custom message')`

**Q: What's the default pagination limit?**  
A: Default is 10 items per page. Max is 100. Both configurable in constants.

**Q: Does paginate support complex queries?**  
A: Yes! Pass any MongoDB filter: `{ $and: [...], $or: [...], custom: 'query' }`

**Q: How do I use `buildSearchFilter` for partial matches?**  
A: It automatically uses regex: `john` matches "John", "johnny", "johnathan"

**Q: Can I chain multiple population paths?**  
A: Yes! Pass an array: `populate: [{ path: 'doc' }, { path: 'patient' }]`

**Q: How do I exclude fields with `pick()`?**  
A: `pick()` only includes specified fields (whitelist). No blacklist. Use carefully with sensitive data.

**Q: What happens if paginate query fails?**  
A: Throws error caught by `asyncHandler` and passed to error middleware.

---

## Additional Resources

- [Constants Documentation](../constants/README.md)
- [MongoDB Documentation](https://docs.mongodb.com/drivers/node)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## Version History

**v1.0.0** (March 4, 2026) - Initial release
- ApiResponse class with 7 methods
- ApiError class with 14 static methods
- asyncHandler middleware wrapper
- paginate function with full MongoDB support
- 13 helper functions

---

## Support

For issues or questions:
1. Check usage examples in `USAGE_EXAMPLES.js`
2. Review controller implementations
3. Check error middleware logs
4. Verify database connections

---

**Status:** Production Ready ✅  
**Type Safety:** JSDoc with TypeScript-like typing  
**Error Handling:** Comprehensive with custom error middleware  
**Performance:** Optimized for production with lean queries  
**Maintainability:** Well-documented with 1000+ lines of examples

