const OpdService = require('../services/OpdService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.registerPatient = asyncHandler(async (req, res) => {
  const { patientId, doctorId, appointmentType, priority } = req.body;
  const result = await OpdService.registerPatient({
    patientId,
    doctorId,
    appointmentType,
    priority,
    userId: req.user?.id
  });
  res.json(ApiResponse.success(result, 'Patient registered successfully'));
});

exports.getQueue = asyncHandler(async (req, res) => {
  const { doctorId } = req.query;
  const result = await OpdService.getQueue({ doctorId });
  res.json(ApiResponse.success(result, 'Queue retrieved successfully'));
});

exports.startConsultation = asyncHandler(async (req, res) => {
  const { visitId } = req.params;
  await OpdService.startConsultation({ visitId });
  res.json(ApiResponse.updated(null, 'Consultation started successfully'));
});

exports.completeConsultation = asyncHandler(async (req, res) => {
  const { visitId } = req.params;
  const result = await OpdService.completeConsultation({
    visitId,
    body: req.body,
    userId: req.user?.id
  });
  res.json(ApiResponse.success(result, 'Consultation completed successfully'));
});

exports.updatePayment = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const { paymentMethod, paymentStatus, amountPaid } = req.body;
  await OpdService.updatePayment({ billId, paymentMethod, paymentStatus, amountPaid });
  res.json(ApiResponse.updated(null, 'Payment updated successfully'));
});

exports.getPatientHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { limit } = req.query;
  const result = await OpdService.getPatientHistory({ patientId, limit });
  res.json(ApiResponse.success(result, 'Patient history retrieved successfully'));
});

exports.getVisit = asyncHandler(async (req, res) => {
  const { visitId } = req.params;
  const result = await OpdService.getVisit({ visitId });
  res.json(ApiResponse.success(result, 'Visit retrieved successfully'));
});

exports.getTodayStats = asyncHandler(async (req, res) => {
  const { doctorId } = req.query;
  const result = await OpdService.getTodayStats({ doctorId });
  res.json(ApiResponse.success(result, 'Today stats retrieved successfully'));
});
