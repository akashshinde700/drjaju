const MedicalHistoryService = require('../services/MedicalHistoryService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getMedicalHistoryOptions = asyncHandler(async (req, res) => {
  const result = await MedicalHistoryService.getMedicalHistoryOptions({ doctorId: req.user?.id });
  res.json(ApiResponse.success(result, 'Options retrieved successfully'));
});

exports.saveDoctorConfiguration = asyncHandler(async (req, res) => {
  const { configurations } = req.body;
  await MedicalHistoryService.saveDoctorConfiguration({ doctorId: req.user?.id, configurations });
  res.json(ApiResponse.updated(null, 'Configuration saved successfully'));
});

exports.addCustomOption = asyncHandler(async (req, res) => {
  const result = await MedicalHistoryService.addCustomOption(req.body);
  res.status(201).json(ApiResponse.created(result, 'Option added successfully'));
});

exports.getPatientMedicalHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await MedicalHistoryService.getPatientMedicalHistory({ patientId, doctorId: req.user?.id });
  // ApiResponse.success() already puts the payload at `.data`, so wrapping it
  // in another { data } produced { data: { data: {...} } } — every other
  // endpoint in this controller passes `result` straight through. The extra
  // layer is why Patient Overview showed no past history: it reads
  // response.data.data.existingConditions, which was undefined.
  res.json(ApiResponse.success(result, 'Patient medical history retrieved successfully'));
});

exports.savePatientMedicalHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { selections } = req.body;
  await MedicalHistoryService.savePatientMedicalHistory({ patientId, selections, userId: req.user?.id });
  res.json(ApiResponse.updated(null, 'Patient medical history saved successfully'));
});

exports.togglePatientCondition = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  await MedicalHistoryService.togglePatientCondition({ patientId, body: req.body, userId: req.user?.id });
  res.json(ApiResponse.updated(null, 'Condition updated successfully'));
});

exports.addExistingCondition = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await MedicalHistoryService.addExistingCondition({
    patientId,
    body: req.body,
    clinicId: req.user?.clinic_id || null,
  });
  res.status(201).json(ApiResponse.created(result, 'Condition added successfully'));
});

exports.addSurgicalProcedure = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await MedicalHistoryService.addSurgicalProcedure({ patientId, body: req.body });
  res.status(201).json(ApiResponse.created(result, 'Surgical procedure added successfully'));
});

exports.deleteExistingCondition = asyncHandler(async (req, res) => {
  const { patientId, conditionId } = req.params;
  await MedicalHistoryService.deleteExistingCondition({ patientId, conditionId });
  res.json(ApiResponse.deleted(null, 'Condition deleted successfully'));
});

exports.deleteSurgicalProcedure = asyncHandler(async (req, res) => {
  const { patientId, procedureId } = req.params;
  await MedicalHistoryService.deleteSurgicalProcedure({ patientId, procedureId });
  res.json(ApiResponse.deleted(null, 'Procedure deleted successfully'));
});
