const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateRequired, validateId } = require('../middleware/validator');
const joiValidate = require('../middleware/joiValidate');
const { updateClinic: updateClinicSchema } = require('../validation/commonSchemas');

const clinicController = require('../controllers/clinicController');

const router = express.Router();

// Make clinics list public for testing
router.get('/', clinicController.listClinics);
router.get('/:id', validateId('id'), clinicController.getClinic);
router.post('/', authenticateToken, requireRole('admin'), validateRequired(['name']), clinicController.createClinic);
router.put('/:id', authenticateToken, requireRole('admin'), validateId('id'), joiValidate(updateClinicSchema), clinicController.updateClinic);
router.post('/switch', authenticateToken, validateRequired(['clinic_id']), clinicController.switchClinic);

module.exports = router;

