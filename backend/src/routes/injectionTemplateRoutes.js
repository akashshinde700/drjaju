const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

const injectionTemplateController = require('../controllers/injectionTemplateController');

const joiValidate = require('../middleware/joiValidate');
const { createInjectionTemplate: createInjectionTemplateSchema, updateInjectionTemplate: updateInjectionTemplateSchema } = require('../validation/commonSchemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all injection templates
router.get('/', injectionTemplateController.getAllInjectionTemplates);

// Get injection template by ID
router.get('/:id', injectionTemplateController.getInjectionTemplateById);

// Create new injection template (doctors and admins only)
router.post('/', requireRole('admin', 'doctor'), joiValidate(createInjectionTemplateSchema), injectionTemplateController.createInjectionTemplate);

// Update injection template (doctors can update their own, admins can update any)
router.put('/:id', requireRole('admin', 'doctor'), joiValidate(updateInjectionTemplateSchema), injectionTemplateController.updateInjectionTemplate);

// Delete injection template (soft delete)
router.delete('/:id', requireRole('admin', 'doctor'), injectionTemplateController.deleteInjectionTemplate);

// Increment usage count
router.post('/:id/use', injectionTemplateController.incrementTemplateUsage);

module.exports = router;
