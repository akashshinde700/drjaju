const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const diagnosisTemplateController = require('../controllers/diagnosisTemplateController');
const joiValidate = require('../middleware/joiValidate');
const { createDiagnosisTemplate, updateDiagnosisTemplate } = require('../validation/commonSchemas');

const router = express.Router();

// All routes require authentication
router.get('/', authenticateToken, diagnosisTemplateController.getAllTemplates);
router.get('/:id', authenticateToken, diagnosisTemplateController.getTemplateById);
router.post('/', authenticateToken, joiValidate(createDiagnosisTemplate), diagnosisTemplateController.createTemplate);
router.put('/:id', authenticateToken, joiValidate(updateDiagnosisTemplate), diagnosisTemplateController.updateTemplate);
router.delete('/:id', authenticateToken, diagnosisTemplateController.deleteTemplate);

module.exports = router;
