const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const doctorAvailabilityController = require('../controllers/doctorAvailabilityController');
const joiValidate = require('../middleware/joiValidate');
const { createAvailability, updateAvailability } = require('../validation/commonSchemas');

const router = express.Router();

// Public endpoint - for landing page to fetch doctor's available slots
router.get('/:doctor_id/slots', doctorAvailabilityController.getDoctorTimeSlots);

// Public endpoint - for landing page to check which days doctor is available
router.get('/:doctor_id/availability', doctorAvailabilityController.getDoctorAvailability);

// Protected endpoints - only authenticated doctors can modify their settings
router.put('/:doctor_id/slots', authenticateToken, joiValidate(createAvailability), doctorAvailabilityController.updateDoctorTimeSlots);
router.put('/:doctor_id/availability', authenticateToken, doctorAvailabilityController.updateDoctorAvailability);
router.post('/:doctor_id/slots', authenticateToken, joiValidate(createAvailability), doctorAvailabilityController.addTimeSlot);
router.delete('/:doctor_id/slots/:slot_id', authenticateToken, doctorAvailabilityController.deleteTimeSlot);

module.exports = router;
