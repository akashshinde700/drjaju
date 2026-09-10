/**
 * @file asyncHandler - Wrapper for async/await error handling in controllers
 * @description Eliminates need for try-catch blocks in async route handlers
 * @version 1.0.0
 */

const ApiError = require('./apiError');

/**
 * @function asyncHandler
 * @description Higher-order function that wraps async route handlers and catches errors
 * Automatically passes errors to Express error handler middleware
 * Eliminates boilerplate try-catch blocks in controllers
 * @param {Function} requestHandler - Async controller function
 * @returns {Function} Express middleware function
 *
 * @example
 * // BEFORE (with try-catch)
 * router.get('/user/:id', (req, res, next) => {
 *   try {
 *     const user = await User.findById(req.params.id);
 *     if (!user) throw ApiError.notFound('User');
 *     res.json(new ApiResponse(200, user));
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 *
 * // AFTER (using asyncHandler)
 * router.get('/user/:id', asyncHandler(async (req, res, next) => {
 *   const user = await User.findById(req.params.id);
 *   if (!user) throw ApiError.notFound('User');
 *   res.json(new ApiResponse(200, user));
 * }));
 *
 * @example
 * // With parameter validation
 * router.post('/user', asyncHandler(async (req, res) => {
 *   const { email, name } = req.body;
 *   if (!email) throw ApiError.badRequest('Email is required');
 *   if (!name) throw ApiError.badRequest('Name is required');
 *
 *   const user = await User.create({ email, name });
 *   res.status(201).json(new ApiResponse(201, user, 'User created'));
 * }));
 *
 * @example
 * // With authorization check
 * router.get('/admin/dashboard', asyncHandler(async (req, res) => {
 *   if (req.user.role !== 'admin') {
 *     throw ApiError.forbidden('Admin access required');
 *   }
 *   const data = await getDashboardData();
 *   res.json(new ApiResponse(200, data));
 * }))
 */
const asyncHandler = (requestHandler) => {
  return async (req, res, next) => {
    try {
      await requestHandler(req, res, next);
    } catch (error) {
      // Pass error to Express error handling middleware
      next(error);
    }
  };
};

module.exports = asyncHandler;
