const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const prescriptionTemplatesController = require('../controllers/prescriptionTemplatesController');
const joiValidate = require('../middleware/joiValidate');
const { createPrescriptionTemplate, updatePrescriptionTemplate } = require('../validation/commonSchemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', prescriptionTemplatesController.getAllTemplates);
router.get('/category/:category', prescriptionTemplatesController.getTemplatesByCategory);
router.get('/:id', prescriptionTemplatesController.getTemplateById);
router.post('/', joiValidate(createPrescriptionTemplate), prescriptionTemplatesController.createTemplate);
router.put('/:id', joiValidate(updatePrescriptionTemplate), prescriptionTemplatesController.updateTemplate);
router.delete('/:id', prescriptionTemplatesController.deleteTemplate);
router.post('/:id/use', prescriptionTemplatesController.incrementUsage);

module.exports = router;
