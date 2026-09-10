/**
 * @file UserController - HTTP request handlers for User operations
 * @description Controller layer that delegates all business logic to UserService
 * Controllers are THIN - they only handle HTTP requests, validation, and responses
 * All business logic is delegated to the service layer
 * @version 1.0.0
 */

const { ApiResponse, ApiError, asyncHandler } = require('../utils');
const userService = require('../services/UserService');

/**
 * @async
 * @function createUser
 * @description POST /users - Create a new user
 * Delegates validation and user creation to UserService
 * @route POST /users
 * @returns {ApiResponse} 201 - User created successfully
 * @throws {ApiError} 400 - Validation error
 * @throws {ApiError} 409 - User already exists
 *
 * @example
 * POST /users
 * {
 *   "email": "john@example.com",
 *   "password": "SecurePass123",
 *   "name": "John Doe",
 *   "phone": "9876543210",
 *   "role": "patient"
 * }
 * Response: 201 { user: {...}, message: "..." }
 */
exports.createUser = asyncHandler(async (req, res) => {
  // Let UserService handle all validation
  const user = await userService.register(req.body);

  res.status(201).json(
    ApiResponse.created(user, 'User created successfully')
  );
});

/**
 * @async
 * @function getAllUsers
 * @description GET /users - Fetch all users with pagination and filtering
 * Properly handles:
 * - Pagination (page, limit)
 * - Search (by name, email, phone)
 * - Filtering (by role, active status)
 * - Sorting
 * @route GET /users?page=1&limit=10&search=john&role=doctor&sortBy=-created_at
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Search by name, email, or phone
 * @query {string} role - Filter by role
 * @query {string} sortBy - Sort field (prefix - for descending)
 * @returns {ApiResponse} 200 - Paginated users list
 *
 * @example
 * GET /users?page=2&limit=20&role=doctor
 * Response: 200 {
 *   data: [...],
 *   pagination: { page: 2, limit: 20, total: 150, totalPages: 8, ... }
 * }
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  // Extract query parameters
  const { page, limit, search, role, sortBy, is_active } = req.query;

  // Call service with pagination options
  const result = await userService.getAllUsers({
    page,
    limit,
    search,
    role,
    sortBy,
    is_active: is_active !== undefined ? parseInt(is_active, 10) : 1,
  });

  // Return paginated response using ApiResponse utility
  res.json(
    ApiResponse.paginated(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      'Users retrieved successfully'
    )
  );
});

/**
 * @async
 * @function getUserById
 * @description GET /users/:id - Fetch a single user by ID
 * @route GET /users/:id
 * @param {number} id - User ID
 * @returns {ApiResponse} 200 - User object
 * @throws {ApiError} 404 - User not found
 *
 * @example
 * GET /users/5
 * Response: 200 { data: { id: 5, name: "John", email: "john@example.com", ... } }
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Call service to fetch user
  const user = await userService.getUserById(id);

  res.json(
    ApiResponse.success(user, 'User retrieved successfully')
  );
});

/**
 * @async
 * @function updateUser
 * @description PUT /users/:id - Update user information
 * Delegates all validation to UserService:
 * - Email uniqueness check
 * - Password hashing
 * - Field validation
 * @route PUT /users/:id
 * @param {number} id - User ID
 * @body {Object} updateData - Fields to update (all optional)
 * @returns {ApiResponse} 200 - Updated user
 * @throws {ApiError} 404 - User not found
 * @throws {ApiError} 400 - Validation error
 * @throws {ApiError} 409 - Email already in use
 *
 * @example
 * PUT /users/5
 * {
 *   "phone": "9876543210",
 *   "name": "Jane Doe"
 * }
 * Response: 200 { user: { id: 5, name: "Jane Doe", ... } }
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Call service to update user (all validation done in service)
  const user = await userService.updateUser(id, req.body);

  res.json(
    ApiResponse.updated(user, 'User updated successfully')
  );
});

/**
 * @async
 * @function deleteUser
 * @description DELETE /users/:id - Delete/deactivate user
 * Performs soft delete (marks as inactive)
 * Prevents users from deleting their own account
 * @route DELETE /users/:id
 * @param {number} id - User ID to delete
 * @returns {ApiResponse} 200 - Deletion success
 * @throws {ApiError} 404 - User not found
 * @throws {ApiError} 400 - Cannot delete own account
 *
 * @example
 * DELETE /users/5
 * Response: 200 { message: "User deleted successfully" }
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Call service (pass current user ID to prevent self-deletion)
  await userService.deleteUser(id, req.user?.id);

  res.json(
    ApiResponse.deleted(null, 'User deleted successfully')
  );
});

/**
 * @async
 * @function getUserStats
 * @description GET /users/stats/dashboard - Get user statistics
 * Returns aggregated user data by role and status for admin dashboard
 * @route GET /users/stats/dashboard
 * @returns {ApiResponse} 200 - User statistics object
 *
 * @example
 * GET /users/stats/dashboard
 * Response: 200 {
 *   data: {
 *     total: 150,
 *     active: 140,
 *     byRole: {
 *       admin: 2,
 *       doctor: 30,
 *       staff: 45,
 *       patient: 70,
 *       sub_admin: 1
 *     }
 *   }
 * }
 */
exports.getUserStats = asyncHandler(async (req, res) => {
  // Call service to get stats
  const stats = await userService.getUserStats();

  res.json(
    ApiResponse.success(stats, 'User statistics retrieved')
  );
});

/**
 * @module userController
 * @description Thin controller layer that:
 * - Receives HTTP requests
 * - Extracts parameters and body
 * - Delegates to UserService for business logic
 * - Handles errors via asyncHandler
 * - Returns ApiResponse with proper status codes
 *
 * All business logic is in UserService.js
 * Controllers should NEVER contain:
 * - Database queries
 * - Business rule validation
 * - Password hashing
 * - Complex calculations
 */
