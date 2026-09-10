/**
 * Pagination Constants
 * Default pagination values and limits
 * 
 * @module constants/pagination
 */

const PAGINATION = {
  // Default page number
  DEFAULT_PAGE: 1,

  // Default items per page
  DEFAULT_LIMIT: 10,

  // Maximum items per page
  MAX_LIMIT: 100,

  // Minimum items per page
  MIN_LIMIT: 1,

  // Common page size presets
  PRESETS: {
    SMALL: 5,
    MEDIUM: 10,
    LARGE: 25,
    EXTRA_LARGE: 50,
  },

  // Sorting options
  SORT: {
    ASC: 'asc',
    DESC: 'desc',
  },

  // Default sorting field
  DEFAULT_SORT_BY: 'createdAt',
  DEFAULT_SORT_ORDER: 'desc',

  // Validation helpers
  validate: (page = 1, limit = 10) => {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.min(
      Math.max(PAGINATION.MIN_LIMIT, parseInt(limit) || PAGINATION.DEFAULT_LIMIT),
      PAGINATION.MAX_LIMIT
    );
    return { page: validPage, limit: validLimit };
  },

  // Calculate offset for database queries
  getOffset: (page = 1, limit = 10) => {
    const { page: validPage, limit: validLimit } = PAGINATION.validate(page, limit);
    return (validPage - 1) * validLimit;
  },

  // Format pagination response
  formatResponse: (data, page, limit, total) => {
    const { page: validPage, limit: validLimit } = PAGINATION.validate(page, limit);
    const totalPages = Math.ceil(total / validLimit);
    
    return {
      data,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  },
};

module.exports = PAGINATION;
