/**
 * @file paginate - MongoDB Pagination Utility
 * @description Handles query pagination for MongoDB with optional sorting and population
 * @version 1.0.0
 */

const { PAGINATION } = require('../constants');

/**
 * @async
 * @function paginate
 * @description Paginates MongoDB query with sorting, filtering, and field population
 * Automatically calculates pagination metadata and validates input parameters
 * Supports nested population for document relationships
 *
 * @param {Object} options - Pagination options
 * @param {Model} options.model - Mongoose model to query
 * @param {Object} [options.filter={}] - MongoDB filter/query conditions
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.limit=10] - Documents per page
 * @param {string|Object} [options.sort='createdAt'] - Sort field(s), prefix - for descending
 * @param {string|Array} [options.select] - Fields to include/exclude
 * @param {string|Array} [options.populate] - Paths to populate (nested documents)
 * @param {Object} [options.lean=true] - Return plain JavaScript objects (faster)
 *
 * @returns {Promise<Object>} Pagination result object
 * @returns {Array} result.data - Array of documents
 * @returns {Object} result.pagination - Pagination metadata
 * @returns {number} result.pagination.page - Current page
 * @returns {number} result.pagination.limit - Documents per page
 * @returns {number} result.pagination.total - Total document count
 * @returns {number} result.pagination.totalPages - Total pages
 * @returns {boolean} result.pagination.hasNextPage - Has next page
 * @returns {boolean} result.pagination.hasPrevPage - Has previous page
 *
 * @throws {Error} If database query fails
 *
 * @example
 * // Basic pagination
 * const result = await paginate({
 *   model: User,
 *   page: 1,
 *   limit: 10
 * });
 * // Returns: { data: [...], pagination: { page: 1, limit: 10, total: 45, ... } }
 *
 * @example
 * // With filtering and sorting
 * const result = await paginate({
 *   model: Appointment,
 *   filter: { doctorId: '123', status: 'completed' },
 *   page: 1,
 *   limit: 20,
 *   sort: '-createdAt' // descending by createdAt
 * });
 *
 * @example
 * // With population (join data)
 * const result = await paginate({
 *   model: Appointment,
 *   filter: { status: 'scheduled' },
 *   page: 1,
 *   limit: 15,
 *   sort: 'appointmentDate',
 *   populate: ['doctorId', 'patientId'],
 *   select: 'appointmentDate doctorId patientId status'
 * });
 *
 * @example
 * // With nested population
 * const result = await paginate({
 *   model: Appointment,
 *   populate: [
 *     {
 *       path: 'doctorId',
 *       select: 'name specialty',
 *       populate: { path: 'departmentId', select: 'name' }
 *     },
 *     { path: 'patientId', select: 'name email' }
 *   ],
 *   page: 2,
 *   limit: 25
 * });
 *
 * @example
 * // Complex filter with sorting
 * const result = await paginate({
 *   model: Patient,
 *   filter: {
 *     $or: [
 *       { name: { $regex: searchTerm, $options: 'i' } },
 *       { email: { $regex: searchTerm, $options: 'i' } }
 *     ]
 *   },
 *   page: req.query.page || 1,
 *   limit: req.query.limit || 10,
 *   sort: req.query.sortBy || '-createdAt',
 *   select: 'name email phone status'
 * });
 */
const paginate = async (options) => {
  const {
    model,
    filter = {},
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    sort = PAGINATION.DEFAULT_SORT_BY,
    select = null,
    populate = null,
    lean = true,
  } = options;

  // Validate and sanitize pagination parameters
  const validatedPage = Math.max(1, parseInt(page, 10) || PAGINATION.DEFAULT_PAGE);
  const validatedLimit = Math.min(
    Math.max(PAGINATION.MIN_LIMIT, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT),
    PAGINATION.MAX_LIMIT
  );

  // Calculate skip (offset) for database query
  const skip = (validatedPage - 1) * validatedLimit;

  try {
    // Build query
    let query = model.find(filter);

    // Apply field selection
    if (select) {
      query = query.select(select);
    }

    // Apply sorting
    if (sort) {
      // Handle multiple sort fields (comma-separated)
      if (typeof sort === 'string' && sort.includes(',')) {
        const sortFields = sort.split(',').map((s) => s.trim());
        query = query.sort(sortFields.join(' '));
      } else {
        query = query.sort(sort);
      }
    }

    // Apply population (document relationship expansion)
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach((pop) => {
          query = query.populate(pop);
        });
      } else {
        query = query.populate(populate);
      }
    }

    // Execute count query (total documents matching filter)
    const total = await model.countDocuments(filter);

    // Apply pagination and lean for performance
    const data = await query.skip(skip).limit(validatedLimit).lean(lean);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / validatedLimit);
    const hasNextPage = validatedPage < totalPages;
    const hasPrevPage = validatedPage > 1;

    return {
      data,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  } catch (error) {
    throw new Error(`Pagination error: ${error.message}`);
  }
};

module.exports = paginate;
