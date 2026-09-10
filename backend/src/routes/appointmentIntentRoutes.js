// src/routes/appointmentIntentRoutes.js
const express = require('express');
const appointmentIntentController = require('../controllers/appointmentIntentController_refactored');

// ✅ SAHI IMPORT - Destructuring se authenticateToken le rahe hain
const { authenticateToken } = require('../middleware/auth');

const { validateRequired, validatePhone, validateDate, validateId } = require('../middleware/validator');
const { cacheMiddleware } = require('../middleware/cache');
const joiValidate = require('../middleware/joiValidate');
const { createAppointmentIntent } = require('../validation/commonSchemas');

const router = express.Router();

// Public route for patients to submit appointment requests (no auth required)
router.post('/',
  joiValidate(createAppointmentIntent),
  appointmentIntentController.addAppointmentIntent
);

// Protected routes for admins/doctors/staff
router.use(authenticateToken); // All below routes require authentication

router.get('/', cacheMiddleware(1 * 60 * 1000), appointmentIntentController.listAppointmentIntents);
router.get('/:id', validateId('id'), cacheMiddleware(1 * 60 * 1000), appointmentIntentController.getAppointmentIntent);
router.patch('/:id/status', validateId('id'), validateRequired(['status']), appointmentIntentController.updateAppointmentIntentStatus);
router.post('/:id/convert', 
  validateId('id'),
  validateRequired(['patient_id', 'doctor_id', 'appointment_date', 'appointment_time']),
  validateDate('appointment_date'),
  appointmentIntentController.convertToAppointment
);
router.delete('/:id', validateId('id'), appointmentIntentController.deleteAppointmentIntent);

module.exports = router;