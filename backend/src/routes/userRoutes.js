// src/routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');

const { requireRole } = require('../middleware/auth');

const { auditLogger } = require('../middleware/auditLogger');
const joiValidate = require('../middleware/joiValidate');
const { createUser: createUserSchema, updateUser: updateUserSchema } = require('../validation/commonSchemas');

const router = express.Router();

// Auth enforced by app.js before this router

// Get all users (admin, doctor, staff, and sub_admin can view)
router.get('/', requireRole('admin', 'doctor', 'staff', 'sub_admin'), userController.getAllUsers);

// Get user stats - counts by role (admin only, used by admin dashboard)
router.get('/stats', requireRole('admin'), userController.getUserStats);

// Get user by ID (admin, doctor, staff, and sub_admin can view)
router.get('/:id', requireRole('admin', 'doctor', 'staff', 'sub_admin'), userController.getUserById);

// Create new user (admin and doctor can create staff)
router.post('/', requireRole('admin', 'doctor'), joiValidate(createUserSchema), auditLogger('USER'), userController.createUser);

// Update user (admin only)
router.put('/:id', requireRole('admin'), joiValidate(updateUserSchema), auditLogger('USER'), userController.updateUser);

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), auditLogger('USER'), userController.deleteUser);

module.exports = router;