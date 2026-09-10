const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const medicationsTemplateController = require('../controllers/medicationsTemplateController');
const joiValidate = require('../middleware/joiValidate');
const { createMedicationsTemplate, updateMedicationsTemplate } = require('../validation/commonSchemas');

const router = express.Router();

// All routes require authentication
router.get('/', authenticateToken, medicationsTemplateController.getAllTemplates);
router.get('/:id', authenticateToken, medicationsTemplateController.getTemplateById);
router.post('/', authenticateToken, medicationsTemplateController.createTemplate);
router.put('/:id', authenticateToken, medicationsTemplateController.updateTemplate);
router.delete('/:id', authenticateToken, medicationsTemplateController.deleteTemplate);

module.exports = router;
