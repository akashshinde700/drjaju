const { ApiResponse, asyncHandler } = require('../utils');
const VipPatientService = require('../services/VipPatientService');

exports.createVIPPatient = asyncHandler(async (req, res) => {
  const vipPatient = await VipPatientService.createVIPPatient(req.body, req.user?.id);
  res.status(201).json(ApiResponse.created({ vip_patient: vipPatient }, 'Patient marked as VIP successfully'));
});

exports.getVIPPatient = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  const vip = await VipPatientService.getVIPPatient(patient_id);
  res.json(ApiResponse.success(vip, 'VIP patient retrieved'));
});

exports.updateVIPPatient = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  await VipPatientService.updateVIPPatient(patient_id, req.body, req.user?.id);
  res.json(ApiResponse.updated(null, 'VIP patient updated successfully'));
});

exports.removeVIPStatus = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  await VipPatientService.removeVIPStatus(patient_id, req.user?.id);
  res.json(ApiResponse.deleted(null, 'VIP status removed successfully'));
});

exports.getAllVIPPatients = asyncHandler(async (req, res) => {
  const { vip_tier, priority_level, limit = 50, offset = 0 } = req.query;
  const result = await VipPatientService.getAllVIPPatients({ vip_tier, priority_level, limit, offset });
  res.json(ApiResponse.success(result, 'VIP patients retrieved'));
});

exports.grantRecordAccess = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  const accessData = await VipPatientService.grantRecordAccess(patient_id, req.body, req.user?.id);
  res.status(201).json(ApiResponse.created({ access_control: accessData }, 'Record access granted successfully'));
});

exports.revokeRecordAccess = asyncHandler(async (req, res) => {
  const { patient_id, access_id } = req.params;
  await VipPatientService.revokeRecordAccess(patient_id, access_id, req.user?.id);
  res.json(ApiResponse.deleted(null, 'Record access revoked successfully'));
});

exports.checkRecordAccess = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  const { user_id, record_type } = req.query;
  const result = await VipPatientService.checkRecordAccess(patient_id, { user_id, record_type });
  res.json(ApiResponse.success(result, 'Record access checked'));
});

exports.getVIPActivityLogs = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  const result = await VipPatientService.getVIPActivityLogs(patient_id, { limit, offset });
  res.json(ApiResponse.success(result, 'VIP activity logs retrieved'));
});

exports.generateVIPReport = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  const { report_type = 'activity_summary' } = req.query;
  const result = await VipPatientService.generateVIPReport(patient_id, report_type, req.user?.id);
  res.json(ApiResponse.success(result, 'VIP report generated'));
});

exports.getVIPQueuePriority = asyncHandler(async (req, res) => {
  const result = await VipPatientService.getVIPQueuePriority();
  res.json(ApiResponse.success(result, 'VIP queue retrieved'));
});
