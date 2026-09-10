const DoctorStaffService = require('../services/DoctorStaffService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.listDoctorStaff = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const result = await DoctorStaffService.listDoctorStaff(doctorId);
  res.json(ApiResponse.success(result, 'Staff retrieved successfully'));
});

exports.createDoctorStaff = asyncHandler(async (req, res) => {
  await DoctorStaffService.createDoctorStaff(req.body || {});
  res.status(201).json(ApiResponse.created(null, 'Staff added successfully'));
});

exports.updateDoctorStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, is_active, permissions } = req.body || {};
  await DoctorStaffService.updateDoctorStaff({ id, role, is_active, permissions });
  res.json(ApiResponse.updated(null, 'Staff updated successfully'));
});

exports.deleteDoctorStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await DoctorStaffService.deleteDoctorStaff(id);
  res.json(ApiResponse.deleted(null, 'Staff deleted successfully'));
});
