// controllers/specialtyController.js
const { ApiResponse, asyncHandler } = require('../utils');
const SpecialtyService = require('../services/SpecialtyService');

// =====================================================
// CARDIOLOGY
// =====================================================
exports.createCardiologyAssessment = asyncHandler(async (req, res) => {
  const result = await SpecialtyService.createCardiologyAssessment(req.body, req.user);
  res.status(201).json(ApiResponse.created(result, 'Cardiology assessment created successfully'));
});

exports.getCardiologyByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const data = await SpecialtyService.getCardiologyByPatient(patientId);
  res.json(ApiResponse.success({ count: data.length, data }, 'Cardiology assessments retrieved'));
});

exports.getCardiologyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await SpecialtyService.getCardiologyById(id);
  res.json(ApiResponse.success(data, 'Cardiology assessment retrieved'));
});

exports.updateCardiologyAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.updateCardiologyAssessment(id, req.body, req.user);
  res.json(ApiResponse.updated(null, 'Cardiology assessment updated successfully'));
});

exports.deleteCardiologyAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.deleteCardiologyAssessment(id);
  res.json(ApiResponse.deleted(null, 'Cardiology assessment deleted successfully'));
});

// =====================================================
// PEDIATRICS
// =====================================================
exports.createPediatricAssessment = asyncHandler(async (req, res) => {
  const result = await SpecialtyService.createPediatricAssessment(req.body, req.user);
  res.status(201).json(ApiResponse.created(result, 'Pediatric assessment created successfully'));
});

exports.getPediatricByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const data = await SpecialtyService.getPediatricByPatient(patientId);
  res.json(ApiResponse.success({ count: data.length, data }, 'Pediatric assessments retrieved'));
});

exports.getPediatricById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await SpecialtyService.getPediatricById(id);
  res.json(ApiResponse.success(data, 'Pediatric assessment retrieved'));
});

exports.updatePediatricAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.updatePediatricAssessment(id, req.body, req.user);
  res.json(ApiResponse.updated(null, 'Pediatric assessment updated successfully'));
});

exports.deletePediatricAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.deletePediatricAssessment(id);
  res.json(ApiResponse.deleted(null, 'Pediatric assessment deleted successfully'));
});

// =====================================================
// ORTHOPEDICS
// =====================================================
exports.createOrthopedicAssessment = asyncHandler(async (req, res) => {
  const result = await SpecialtyService.createOrthopedicAssessment(req.body, req.user);
  res.status(201).json(ApiResponse.created(result, 'Orthopedic assessment created successfully'));
});

exports.getOrthopedicByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const data = await SpecialtyService.getOrthopedicByPatient(patientId);
  res.json(ApiResponse.success({ count: data.length, data }, 'Orthopedic assessments retrieved'));
});

exports.getOrthopedicById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await SpecialtyService.getOrthopedicById(id);
  res.json(ApiResponse.success(data, 'Orthopedic assessment retrieved'));
});

exports.updateOrthopedicAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.updateOrthopedicAssessment(id, req.body, req.user);
  res.json(ApiResponse.updated(null, 'Orthopedic assessment updated successfully'));
});

exports.deleteOrthopedicAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.deleteOrthopedicAssessment(id);
  res.json(ApiResponse.deleted(null, 'Orthopedic assessment deleted successfully'));
});

// =====================================================
// OPHTHALMOLOGY
// =====================================================
exports.createOphthalmologyAssessment = asyncHandler(async (req, res) => {
  const result = await SpecialtyService.createOphthalmologyAssessment(req.body, req.user);
  res.status(201).json(ApiResponse.created(result, 'Ophthalmology assessment created successfully'));
});

exports.getOphthalmologyByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const data = await SpecialtyService.getOphthalmologyByPatient(patientId);
  res.json(ApiResponse.success({ count: data.length, data }, 'Ophthalmology assessments retrieved'));
});

exports.getOphthalmologyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await SpecialtyService.getOphthalmologyById(id);
  res.json(ApiResponse.success(data, 'Ophthalmology assessment retrieved'));
});

exports.updateOphthalmologyAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.updateOphthalmologyAssessment(id, req.body, req.user);
  res.json(ApiResponse.updated(null, 'Ophthalmology assessment updated successfully'));
});

exports.deleteOphthalmologyAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SpecialtyService.deleteOphthalmologyAssessment(id);
  res.json(ApiResponse.deleted(null, 'Ophthalmology assessment deleted successfully'));
});

// =====================================================
// UNIFIED ROUTES
// =====================================================
exports.getSpecialtyAssessmentByPrescription = asyncHandler(async (req, res) => {
  const { prescriptionId, specialtyType } = req.params;
  const data = await SpecialtyService.getSpecialtyAssessmentByPrescription(prescriptionId, specialtyType);
  res.json(ApiResponse.success(data, 'Specialty assessment retrieved'));
});

exports.getAllAssessmentsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await SpecialtyService.getAllAssessmentsByPatient(patientId);
  res.json(ApiResponse.success(result, 'All specialty assessments retrieved'));
});