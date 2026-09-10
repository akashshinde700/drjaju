class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    if (meta) {
      response.meta = meta;
    }

    return res.status(statusCode).json(response);
  }

  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null, meta = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    if (meta) {
      response.meta = meta;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = new Error().stack;
    }

    return res.status(statusCode).json(response);
  }

  static paginated(res, data, pagination, message = 'Success', statusCode = 200) {
    return this.success(res, data, message, statusCode, {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        pages: pagination.pages || 0,
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      }
    });
  }

  static validationError(res, errors, message = 'Validation Failed') {
    return this.error(res, message, 400, errors);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403);
  }

  static conflict(res, message = 'Resource conflict') {
    return this.error(res, message, 409);
  }

  static tooManyRequests(res, message = 'Too many requests') {
    return this.error(res, message, 429);
  }

  static serverError(res, message = 'Internal server error') {
    return this.error(res, message, 500);
  }
}

module.exports = ApiResponse;
