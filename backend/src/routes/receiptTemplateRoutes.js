const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const receiptTemplateController = require('../controllers/receiptTemplateController');
const joiValidate = require('../middleware/joiValidate');
const { createReceiptTemplate: createReceiptTemplateSchema, updateReceiptTemplate: updateReceiptTemplateSchema } = require('../validation/commonSchemas');

const router = express.Router();

router.get('/', authenticateToken, receiptTemplateController.listReceiptTemplates);
router.get('/default', authenticateToken, receiptTemplateController.getDefaultTemplate);
router.get('/:id', authenticateToken, receiptTemplateController.getReceiptTemplate);
router.post('/', authenticateToken, joiValidate(createReceiptTemplateSchema), receiptTemplateController.createReceiptTemplate);
router.put('/:id', authenticateToken, joiValidate(updateReceiptTemplateSchema), receiptTemplateController.updateReceiptTemplate);
router.delete('/:id', authenticateToken, receiptTemplateController.deleteReceiptTemplate);

module.exports = router;
