const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const familyHistoryController = require('../controllers/familyHistoryController');
const { validateRequired, validateId } = require('../middleware/validator');
const joiValidate = require('../middleware/joiValidate');
const {
  createFamilyHistory: createFamilyHistorySchema,
  updateFamilyHistory: updateFamilyHistorySchema
} = require('../validation/commonSchemas');

const router = express.Router();

router.get('/:patientId', authenticateToken, familyHistoryController.getFamilyHistory);
router.post('/:patientId',
  authenticateToken,
  joiValidate(createFamilyHistorySchema),
  familyHistoryController.addFamilyHistory
);
router.put('/:id',
  authenticateToken,
  validateId('id'),
  joiValidate(updateFamilyHistorySchema),
  familyHistoryController.updateFamilyHistory
);
router.delete('/:id', authenticateToken, validateId('id'), familyHistoryController.deleteFamilyHistory);

module.exports = router;

