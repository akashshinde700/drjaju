const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateRequired, validateId } = require('../middleware/validator');
const { cacheMiddleware } = require('../middleware/cache');
const joiValidate = require('../middleware/joiValidate');
const { createLabTemplate: createLabTemplateSchema, updateLabTemplate: updateLabTemplateSchema } = require('../validation/commonSchemas');

const labTemplateController = require('../controllers/labTemplateController');

const router = express.Router();

router.get('/', authenticateToken, cacheMiddleware(5 * 60 * 1000), labTemplateController.listLabTemplates);
router.get('/:id', authenticateToken, validateId('id'), cacheMiddleware(5 * 60 * 1000), labTemplateController.getLabTemplate);
router.get('/:id/parameters', authenticateToken, validateId('id'), cacheMiddleware(5 * 60 * 1000), labTemplateController.getLabTemplateParameters);
router.post('/',
  authenticateToken,
  requireRole('admin', 'doctor'),
  joiValidate(createLabTemplateSchema),
  labTemplateController.createLabTemplate
);
router.put('/:id',
  authenticateToken,
  requireRole('admin', 'doctor'),
  validateId('id'),
  joiValidate(updateLabTemplateSchema),
  labTemplateController.updateLabTemplate
);
router.delete('/:id', 
  authenticateToken, 
  requireRole('admin'),
  validateId('id'),
  labTemplateController.deleteLabTemplate
);

module.exports = router;

