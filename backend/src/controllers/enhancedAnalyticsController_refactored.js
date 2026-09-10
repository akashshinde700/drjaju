const EnhancedAnalyticsService = require('../services/EnhancedAnalyticsService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getDashboardOverview = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getDashboardOverview(req.query);
  res.json(ApiResponse.success(result, 'Dashboard overview retrieved successfully'));
});

exports.getVisitAnalytics = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getVisitAnalytics(req.query);
  res.json(ApiResponse.success(result, 'Visit analytics retrieved successfully'));
});

exports.getMedicationAnalytics = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getMedicationAnalytics(req.query);
  res.json(ApiResponse.success(result, 'Medication analytics retrieved successfully'));
});

exports.getSymptomsAnalytics = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getSymptomsAnalytics(req.query);
  res.json(ApiResponse.success(result, 'Symptoms analytics retrieved successfully'));
});

exports.getPrescriptionAnalytics = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getPrescriptionAnalytics(req.query);
  res.json(ApiResponse.success(result, 'Prescription analytics retrieved successfully'));
});

exports.getPaymentAnalytics = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getPaymentAnalytics(req.query);
  res.json(ApiResponse.success(result, 'Payment analytics retrieved successfully'));
});

exports.getPatientDemographics = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getPatientDemographics(req.query);
  res.json(ApiResponse.success(result, 'Patient demographics retrieved successfully'));
});

exports.getDoctorPerformance = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getDoctorPerformance(req.query);
  res.json(ApiResponse.success(result, 'Doctor performance retrieved successfully'));
});

exports.searchPatients = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.searchPatients(req.query);
  res.json(ApiResponse.success(result, 'Patients retrieved successfully'));
});

exports.getDoctorsList = asyncHandler(async (req, res) => {
  const result = await EnhancedAnalyticsService.getDoctorsList(req.query);
  res.json(ApiResponse.success(result, 'Doctors list retrieved successfully'));
});
