const AppointmentIntentService = require('../services/AppointmentIntentService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.addAppointmentIntent = asyncHandler(async (req, res) => {
  const result = await AppointmentIntentService.addAppointmentIntent(req.body);
  res.status(201).json(ApiResponse.created(result, 'Appointment request submitted successfully'));
});

exports.listAppointmentIntents = asyncHandler(async (req, res) => {
  const result = await AppointmentIntentService.listAppointmentIntents(req.query);
  res.json(ApiResponse.success(result, 'Appointment intents retrieved successfully'));
});

exports.getAppointmentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await AppointmentIntentService.getAppointmentIntent(id);
  res.json(ApiResponse.success(result, 'Appointment intent retrieved successfully'));
});

exports.updateAppointmentIntentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  await AppointmentIntentService.updateAppointmentIntentStatus({ id, status, notes, userId: req.user?.id });
  res.json(ApiResponse.updated(null, 'Appointment intent status updated successfully'));
});

exports.convertToAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await AppointmentIntentService.convertToAppointment({ id, body: req.body, userId: req.user?.id });
  res.json(ApiResponse.created(result, 'Appointment created successfully'));
});

exports.deleteAppointmentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await AppointmentIntentService.deleteAppointmentIntent({ id, userId: req.user?.id });
  res.json(ApiResponse.deleted(null, 'Appointment intent deleted successfully'));
});
