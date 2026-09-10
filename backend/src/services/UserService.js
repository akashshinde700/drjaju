/**
 * @file UserService - Business logic for User operations
 * @description Service layer for all user-related operations
 * Handles CRUD, authentication, validation, and business rules
 * @version 1.0.0
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');
const env = require('../config/env');
const { ApiError } = require('../utils');
const { paginate } = require('../utils');
const { normalizeEmail } = require('../utils');

/**
 * @class UserService
 * @description Centralized business logic for user management
 * All database operations and business rules are isolated here
 * Controllers should ONLY call service methods
 *
 * @example
 * const userService = new UserService();
 * const user = await userService.register(userData);
 * const token = await userService.login(email, password);
 * const users = await userService.getAllUsers(page, limit);
 */
class UserService {
  /**
   * @async
   * @method register
   * @description Register a new user with validation and password hashing
   * @param {Object} userData - User data to register
   * @param {string} userData.email - Unique email address
   * @param {string} userData.password - Password (will be hashed)
   * @param {string} userData.name - Full name
   * @param {string} [userData.phone] - Phone number
   * @param {string} [userData.role='patient'] - User role (default: 'patient')
   * @param {number} [userData.clinic_id] - Associated clinic
   * @returns {Promise<Object>} Created user (without password)
   * @throws {ApiError} If validation fails or user exists
   *
   * @example
   * const newUser = await userService.register({
   *   email: 'john@example.com',
   *   password: 'SecurePassword123',
   *   name: 'John Doe',
   *   phone: '9876543210',
   *   role: 'patient'
   * });
   */
  async register(userData) {
    const { email, password, name, phone, role = 'patient', clinic_id } = userData;

    // Validation
    if (!email || !password || !name) {
      throw ApiError.badRequest('Email, password, and name are required');
    }

    // Normalize email
    const normalizedEmail = normalizeEmail(email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw ApiError.badRequest('Invalid email format');
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters long');
    }

    // Validate phone format if provided
    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        throw ApiError.badRequest('Invalid phone number format');
      }
    }

    const db = getDb();

    try {
      // Check if user already exists
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ?',
        [normalizedEmail]
      );

      if (existing.length > 0) {
        throw ApiError.conflict('User with this email already exists', 'email');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [result] = await db.execute(
        `INSERT INTO users (email, password, name, phone, role, clinic_id, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [normalizedEmail, hashedPassword, name, phone || null, role, clinic_id || null]
      );

      // Fetch created user (without password)
      const user = await this.getUserById(result.insertId);
      return user;
    } catch (error) {
      // Re-throw if already an ApiError
      if (error.statusCode) throw error;

      throw ApiError.internal('Failed to register user', ['database_error']);
    }
  }

  /**
   * @async
   * @method login
   * @description Authenticate user and generate JWT token
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Authentication response with user and token
   * @returns {Object} response.user - Authenticated user (without password)
   * @returns {string} response.token - JWT access token
   * @returns {number} response.expiresIn - Token expiration time (seconds)
   * @throws {ApiError} If credentials invalid or user not found
   *
   * @example
   * const { user, token } = await userService.login('john@example.com', 'password123');
   * // Use token in Authorization header: "Bearer {token}"
   */
  async login(email, password) {
    // Validation
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const normalizedEmail = normalizeEmail(email);
    const db = getDb();

    try {
      // Find user by email and check active status
      const [users] = await db.execute(
        `SELECT id, email, password, name, role, is_active, phone 
         FROM users 
         WHERE email = ? AND is_active = 1`,
        [normalizedEmail]
      );

      if (users.length === 0) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      const user = users[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
        env.jwtSecret,
        { expiresIn: '24h' }
      );

      // Return user (without password) and token
      const { password: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        token,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      };
    } catch (error) {
      // Re-throw if already an ApiError
      if (error.statusCode) throw error;

      throw ApiError.internal('Authentication failed', ['database_error']);
    }
  }

  /**
   * @async
   * @method getAllUsers
   * @description Fetch all users with pagination, filtering, and sorting
   * Uses the reusable paginate() utility function
   * @param {Object} options - Pagination and filter options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @param {string} [options.search] - Search by name, email, or phone
   * @param {string} [options.role] - Filter by role
   * @param {number} [options.is_active] - Filter by active status (0 or 1)
   * @param {string} [options.sortBy='-created_at'] - Sort field (prefix - for descending)
   * @returns {Promise<Object>} Paginated users with metadata
   * @throws {ApiError} If query fails
   *
   * @example
   * const result = await userService.getAllUsers({
   *   page: 1,
   *   limit: 10,
   *   search: 'john',
   *   role: 'doctor',
   *   sortBy: '-created_at'
   * });
   * // Returns: { data: [...], pagination: { page, limit, total, ... } }
   */
  async getAllUsers(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      role,
      is_active = 1,
      sortBy = '-id',
    } = options;

    const db = getDb();

    try {
      // Build filter
      let filter = {};

      // Include active status in filter
      filter.is_active = is_active;

      // Add role filter if provided
      if (role) {
        filter.role = role;
      }

      // Add search filter if provided
      if (search && search.trim()) {
        const searchTerm = search.trim();
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      // Build raw SQL query for MySQL (paginate utility is designed for MongoDB)
      // We'll implement pagination manually for MySQL
      let whereClause = 'WHERE u.is_active = ?';
      let params = [is_active];

      if (role) {
        whereClause += ' AND role = ?';
        params.push(role);
      }

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Get total count
      const [countResult] = await db.execute(
        `SELECT COUNT(*) as total FROM users u ${whereClause}`,
        params
      );
      const total = countResult[0]?.total || 0;

      // Calculate pagination
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 100);
      const offset = (pageNum - 1) * limitNum;
      const safeLimit = Number(limitNum);
      const safeOffset = Number(offset);

      // Determine sort
      let orderClause = 'ORDER BY u.id DESC';
      if (sortBy) {
        orderClause = this._buildSortClause(sortBy);
      }

      // Fetch paginated users
      let users = [];
      try {
        const [rows] = await db.execute(
          `SELECT u.id, u.email, u.role, u.name, u.phone, u.is_active, u.clinic_id,
                  c.name as clinic_name
           FROM users u
           LEFT JOIN clinics c ON u.clinic_id = c.id
           ${whereClause}
           ${orderClause}
           LIMIT ${safeLimit} OFFSET ${safeOffset}`,
          params
        );
        users = rows;
      } catch (joinError) {
        // Fallback for deployments where clinics table/schema is unavailable.
        const [rows] = await db.execute(
          `SELECT u.id, u.email, u.role, u.name, u.phone, u.is_active, u.clinic_id,
                  NULL as clinic_name
           FROM users u
           ${whereClause}
           ${orderClause}
           LIMIT ${safeLimit} OFFSET ${safeOffset}`,
          params
        );
        users = rows;
      }

      // Remove passwords
      const data = users.map(u => {
        const { password, ...user } = u;
        return user;
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw ApiError.internal('Failed to fetch users', ['database_error']);
    }
  }

  /**
   * @async
   * @method getUserById
   * @description Fetch a single user by ID
   * @param {number} id - User ID
   * @param {boolean} [excludePassword=true] - Exclude password field
   * @returns {Promise<Object>} User object
   * @throws {ApiError} If user not found
   *
   * @example
   * const user = await userService.getUserById(1);
   */
  async getUserById(id, excludePassword = true) {
    if (!id) {
      throw ApiError.badRequest('User ID is required');
    }

    const db = getDb();

    try {
      let users = [];
      try {
        const [rows] = await db.execute(
          `SELECT u.id, u.email, u.role, u.name, u.phone, u.is_active, u.clinic_id,
                  c.name as clinic_name, 
                  ${!excludePassword ? 'u.password' : 'NULL as password'}
           FROM users u
           LEFT JOIN clinics c ON u.clinic_id = c.id
           WHERE u.id = ?`,
          [id]
        );
        users = rows;
      } catch (joinError) {
        const [rows] = await db.execute(
          `SELECT u.id, u.email, u.role, u.name, u.phone, u.is_active, u.clinic_id,
                  NULL as clinic_name,
                  ${!excludePassword ? 'u.password' : 'NULL as password'}
           FROM users u
           WHERE u.id = ?`,
          [id]
        );
        users = rows;
      }

      if (users.length === 0) {
        throw ApiError.notFound('User', 'ID');
      }

      const user = users[0];

      // Remove password if requested
      if (excludePassword) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }

      return user;
    } catch (error) {
      if (error.statusCode) throw error;
      throw ApiError.internal('Failed to fetch user', ['database_error']);
    }
  }

  /**
   * @async
   * @method updateUser
   * @description Update user information with validation
   * Prevents updating email to one that already exists
   * @param {number} id - User ID to update
   * @param {Object} updateData - Fields to update
   * @param {string} [updateData.email] - New email (validated for uniqueness)
   * @param {string} [updateData.password] - New password (will be hashed)
   * @param {string} [updateData.name] - New name
   * @param {string} [updateData.phone] - New phone
   * @param {string} [updateData.role] - New role
   * @param {number} [updateData.is_active] - Active status
   * @param {number} [updateData.clinic_id] - Clinic association
   * @returns {Promise<Object>} Updated user (without password)
   * @throws {ApiError} If validation fails or user not found
   *
   * @example
   * const updated = await userService.updateUser(1, {
   *   phone: '9876543210',
   *   name: 'Jane Doe'
   * });
   */
  async updateUser(id, updateData) {
    if (!id) {
      throw ApiError.badRequest('User ID is required');
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    const db = getDb();

    try {
      // Check if user exists
      const [existing] = await db.execute('SELECT id FROM users WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw ApiError.notFound('User', 'ID');
      }

      // Prepare update fields
      const updates = [];
      const params = [];

      // Email validation (if updating)
      if (updateData.email !== undefined) {
        const normalizedEmail = normalizeEmail(updateData.email);

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          throw ApiError.badRequest('Invalid email format');
        }

        // Check for duplicate email (excluding current user)
        const [emailCheck] = await db.execute(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [normalizedEmail, id]
        );
        if (emailCheck.length > 0) {
          throw ApiError.conflict('Email already in use', 'email');
        }

        updates.push('email = ?');
        params.push(normalizedEmail);
      }

      // Password hashing (if updating)
      if (updateData.password !== undefined && updateData.password !== '') {
        if (updateData.password.length < 8) {
          throw ApiError.badRequest('Password must be at least 8 characters long');
        }

        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }

      // Name update
      if (updateData.name !== undefined) {
        if (!updateData.name.trim()) {
          throw ApiError.badRequest('Name cannot be empty');
        }
        updates.push('name = ?');
        params.push(updateData.name);
      }

      // Phone update
      if (updateData.phone !== undefined) {
        if (updateData.phone) {
          const phoneRegex = /^[6-9]\d{9}$/;
          const cleanPhone = String(updateData.phone).replace(/\D/g, '');
          if (!phoneRegex.test(cleanPhone)) {
            throw ApiError.badRequest('Invalid phone number format');
          }
        }
        updates.push('phone = ?');
        params.push(updateData.phone || null);
      }

      // Role update
      if (updateData.role !== undefined) {
        const validRoles = ['admin', 'doctor', 'patient', 'staff', 'sub_admin'];
        if (!validRoles.includes(updateData.role)) {
          throw ApiError.badRequest('Invalid role');
        }
        updates.push('role = ?');
        params.push(updateData.role);
      }

      // Active status update
      if (updateData.is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(updateData.is_active ? 1 : 0);
      }

      // Clinic update
      if (updateData.clinic_id !== undefined) {
        updates.push('clinic_id = ?');
        params.push(updateData.clinic_id || null);
      }

      // Execute update
      params.push(id);
      await db.execute(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      // Return updated user
      const user = await this.getUserById(id);
      return user;
    } catch (error) {
      if (error.statusCode) throw error;
      throw ApiError.internal('Failed to update user', ['database_error']);
    }
  }

  /**
   * @async
   * @method deleteUser
   * @description Delete/deactivate user (soft delete - marks as inactive)
   * Prevents users from deleting their own account
   * @param {number} id - User ID to delete
   * @param {number} [requestingUserId] - ID of user making request (for authorization)
   * @returns {Promise<Object>} Deletion confirmation
   * @throws {ApiError} If user not found or trying to delete own account
   *
   * @example
   * const result = await userService.deleteUser(5, req.user.id);
   */
  async deleteUser(id, requestingUserId = null) {
    if (!id) {
      throw ApiError.badRequest('User ID is required');
    }

    const db = getDb();

    try {
      // Check if user exists
      const [existing] = await db.execute('SELECT id FROM users WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw ApiError.notFound('User', 'ID');
      }

      // Prevent deleting own account
      if (requestingUserId && requestingUserId === parseInt(id)) {
        throw ApiError.badRequest('Cannot delete your own account');
      }

      // Soft delete - mark as inactive
      await db.execute('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?', [
        id,
      ]);

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw ApiError.internal('Failed to delete user', ['database_error']);
    }
  }

  /**
   * @async
   * @method getUserStats
   * @description Get user statistics for admin dashboard
   * @returns {Promise<Object>} User statistics by role and status
   * @example
   * const stats = await userService.getUserStats();
   * // Returns: { total, active, byRole: { admin, doctor, staff, ... } }
   */
  async getUserStats() {
    const db = getDb();

    try {
      const [rows] = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'doctor' THEN 1 ELSE 0 END) as doctors,
          SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff,
          SUM(CASE WHEN role = 'patient' THEN 1 ELSE 0 END) as patients,
          SUM(CASE WHEN role = 'sub_admin' THEN 1 ELSE 0 END) as sub_admins
        FROM users
      `);

      const r = rows[0] || {};
      return {
        total: parseInt(r.total || 0, 10),
        active: parseInt(r.active || 0, 10),
        byRole: {
          admin: parseInt(r.admins || 0, 10),
          doctor: parseInt(r.doctors || 0, 10),
          staff: parseInt(r.staff || 0, 10),
          patient: parseInt(r.patients || 0, 10),
          sub_admin: parseInt(r.sub_admins || 0, 10),
        },
      };
    } catch (error) {
      throw ApiError.internal('Failed to fetch user statistics', ['database_error']);
    }
  }

  /**
   * @private
   * @method _buildSortClause
   * @description Helper to build SQL ORDER BY clause from sort parameter
   * @param {string} sortBy - Sort field (prefix - for descending)
   * @returns {string} SQL ORDER BY clause
   */
  _buildSortClause(sortBy) {
    if (!sortBy) return 'ORDER BY u.id DESC';

    const sortMap = {
      '-id': 'u.id DESC',
      'id': 'u.id ASC',
      '-name': 'u.name DESC',
      'name': 'u.name ASC',
      '-email': 'u.email DESC',
      'email': 'u.email ASC',
      '-role': 'u.role DESC',
      'role': 'u.role ASC',
    };

    return `ORDER BY ${sortMap[sortBy] || 'u.id DESC'}`;
  }
}

module.exports = new UserService();
