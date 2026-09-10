const AnalyticsService = require('../services/AnalyticsService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.diagnosis = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.diagnosis(req.query);
  res.json(ApiResponse.success(result, 'Diagnosis analytics retrieved successfully'));
});

exports.diagnosisList = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.diagnosisList(req.query);
  res.json(ApiResponse.success(result, 'Diagnosis list retrieved successfully'));
});

exports.diagnosisPatients = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.diagnosisPatients(req.query);
  res.json(ApiResponse.success(result, 'Diagnosis patients retrieved successfully'));
});

exports.status = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.status(req.query);
  res.json(ApiResponse.success(result, 'Status analytics retrieved successfully'));
});

exports.medicationList = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.medicationList(req.query);
  res.json(ApiResponse.success(result, 'Medication list retrieved successfully'));
});

exports.medicationPatients = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.medicationPatients(req.query);
  res.json(ApiResponse.success(result, 'Medication patients retrieved successfully'));
});

exports.labTestList = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.labTestList(req.query);
  res.json(ApiResponse.success(result, 'Lab test list retrieved successfully'));
});

exports.labTestPatients = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.labTestPatients(req.query);
  res.json(ApiResponse.success(result, 'Lab test patients retrieved successfully'));
});

exports.wow = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.wow(req.query);
  res.json(ApiResponse.success(result, 'WoW analytics retrieved successfully'));
});

exports.topSymptoms = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.topSymptoms(req.query);
  res.json(ApiResponse.success(result, 'Top symptoms retrieved successfully'));
});

exports.topMedications = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.topMedications(req.query);
  res.json(ApiResponse.success(result, 'Top medications retrieved successfully'));
});

exports.appointmentBreakdown = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.appointmentBreakdown(req.query);
  res.json(ApiResponse.success(result, 'Appointment breakdown retrieved successfully'));
});

exports.summary = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.summary(req.query);
  res.json(ApiResponse.success(result, 'Summary analytics retrieved successfully'));
});

exports.overview = asyncHandler(async (req, res) => {
  const result = await AnalyticsService.overview(req.user);
  res.json(ApiResponse.success(result, 'Analytics overview retrieved successfully'));
});
