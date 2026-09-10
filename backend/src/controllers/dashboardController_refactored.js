const DashboardService = require('../services/DashboardService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getDashboardMetrics = asyncHandler(async (req, res) => {
  const { dateRange } = req.query;
  const result = await DashboardService.getDashboardMetrics({
    dateRange,
    doctorId: req.user.id
  });
  res.json(ApiResponse.success(result, 'Dashboard metrics retrieved successfully'));
});

exports.getPatientDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await DashboardService.getPatientDetails({ patientId: id });
  res.json(ApiResponse.success(result, 'Patient details retrieved successfully'));
});

exports.getPatientPrescriptions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await DashboardService.getPatientPrescriptions({ patientId: id });
  res.json(ApiResponse.success(result, 'Patient prescriptions retrieved successfully'));
});

exports.savePrescription = asyncHandler(async (req, res) => {
  const result = await DashboardService.savePrescription({
    body: req.body,
    doctorId: req.user.id
  });
  res.status(201).json(ApiResponse.created(result, 'Prescription saved successfully'));
});

exports.updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await DashboardService.updatePrescription({
    prescriptionId: id,
    status
  });
  res.json(ApiResponse.updated(null, 'Prescription updated successfully'));
});
