const ClinicService = require('../services/ClinicService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.listClinics = asyncHandler(async (_req, res) => {
  const result = await ClinicService.listClinics();
  res.json(ApiResponse.success(result, 'Clinics retrieved successfully'));
});

exports.getClinic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await ClinicService.getClinic(id);
  res.json(ApiResponse.success(result, 'Clinic retrieved successfully'));
});

exports.createClinic = asyncHandler(async (req, res) => {
  const result = await ClinicService.createClinic(req.body);
  res.status(201).json(ApiResponse.created(result, 'Clinic created successfully'));
});

exports.updateClinic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await ClinicService.updateClinic({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Clinic updated successfully'));
});

exports.switchClinic = asyncHandler(async (req, res) => {
  const { clinic_id } = req.body;
  const result = await ClinicService.switchClinic({ clinic_id, user: req.user });
  res.json(ApiResponse.success(result, 'Clinic switched successfully'));
});
