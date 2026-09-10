const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const symptomsTemplatesController = require('../controllers/symptomsTemplatesController');
const joiValidate = require('../middleware/joiValidate');
const { createSymptomsTemplate, updateSymptomsTemplate } = require('../validation/commonSchemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', symptomsTemplatesController.getAllTemplates);
router.get('/category/:category', symptomsTemplatesController.getTemplatesByCategory);
router.get('/:id', symptomsTemplatesController.getTemplateById);
router.post('/', joiValidate(createSymptomsTemplate), symptomsTemplatesController.createTemplate);
router.put('/:id', joiValidate(updateSymptomsTemplate), symptomsTemplatesController.updateTemplate);
router.delete('/:id', symptomsTemplatesController.deleteTemplate);

module.exports = router;
