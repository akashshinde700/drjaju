const StaffDashboardService = require('../services/StaffDashboardService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getStaffDashboard = asyncHandler(async (_req, res) => {
  const dashboard = await StaffDashboardService.getStaffDashboard();
  res.json(ApiResponse.success(dashboard, 'Staff dashboard retrieved successfully'));
});

exports.getStaffStats = asyncHandler(async (_req, res) => {
  const stats = await StaffDashboardService.getStaffStats();
  res.json(ApiResponse.success(stats, 'Staff stats retrieved successfully'));
});

exports.getPatientsInQueue = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const result = await StaffDashboardService.getPatientsInQueue({ status });
  res.json(ApiResponse.success(result, 'Patients retrieved successfully'));
});

exports.updatePatientQueueStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await StaffDashboardService.updatePatientQueueStatus({ id, status });
  res.json(ApiResponse.updated(null, 'Patient status updated successfully'));
});

exports.assignPatientToDoctor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { doctor_id } = req.body;
  const result = await StaffDashboardService.assignPatientToDoctor({ id, doctor_id });
  res.json(ApiResponse.updated(result, 'Patient assigned to doctor successfully'));
});
