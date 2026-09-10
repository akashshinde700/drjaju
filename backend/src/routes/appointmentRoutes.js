// src/routes/appointmentRoutes.js
const express = require('express');
const appointmentController = require('../controllers/appointmentController');

// ✅ SAHI IMPORT - Destructuring se authenticateToken le rahe hain
const { authenticateToken } = require('../middleware/auth');
const joiValidate = require('../middleware/joiValidate');
const { validateId } = require('../middleware/validator');
const { createAppointment, updateAppointment: updateAppointmentSchema, updateAppointmentStatus: updateAppointmentStatusSchema, updatePaymentStatus: updatePaymentStatusSchema } = require('../validation/appointmentSchemas');

const router = express.Router();

// Public endpoint - no auth required (landing page booking)
router.get('/booked-slots', appointmentController.getBookedSlots);

// All routes below require authentication
router.use(authenticateToken);

router.get('/', appointmentController.listAppointments);
router.post('/', joiValidate(createAppointment), appointmentController.addAppointment);
router.get('/followups', appointmentController.listFollowUps);

// Dashboard endpoints
router.get('/today', appointmentController.getTodayAppointmentsCount);
router.get('/stats', appointmentController.getAppointmentStatsSummary);

router.get('/:id', validateId('id'), appointmentController.getAppointment);
router.put('/:id', validateId('id'), joiValidate(updateAppointmentSchema), appointmentController.updateAppointment);
router.patch('/:id/status', validateId('id'), joiValidate(updateAppointmentStatusSchema), appointmentController.updateAppointmentStatus);
router.patch('/:id/payment', validateId('id'), joiValidate(updatePaymentStatusSchema), appointmentController.updatePaymentStatus);
router.delete('/:id', validateId('id'), appointmentController.deleteAppointment);

module.exports = router;