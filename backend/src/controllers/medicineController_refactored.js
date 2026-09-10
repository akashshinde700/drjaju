const MedicineService = require('../services/MedicineService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.searchMedicines = asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  const result = await MedicineService.searchMedicines({
    q,
    limit,
    userId: req.user?.id
  });
  res.json(ApiResponse.success(result, 'Medicines retrieved successfully'));
});

exports.getDosageInfo = asyncHandler(async (req, res) => {
  const { name } = req.query;
  const result = await MedicineService.getDosageInfo({ name });
  res.json(ApiResponse.success(result, 'Dosage retrieved successfully'));
});

exports.getMedicinesForDiagnosis = asyncHandler(async (req, res) => {
  const { icd_code } = req.params;
  const { limit } = req.query;
  const result = await MedicineService.getMedicinesForDiagnosis({
    icd_code,
    limit,
    userId: req.user?.id
  });
  res.json(ApiResponse.success(result, 'Diagnosis medicines retrieved successfully'));
});

exports.getFrequentMedicines = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const result = await MedicineService.getFrequentMedicines({
    userId: req.user?.id,
    limit
  });
  res.json(ApiResponse.success(result, 'Frequent medicines retrieved successfully'));
});

exports.getMedicineDefaultsById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await MedicineService.getMedicineDefaultsById({ id });
  res.json(ApiResponse.success(result, 'Defaults retrieved successfully'));
});

exports.getRecentMedicinesForPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { limit } = req.query;
  const result = await MedicineService.getRecentMedicinesForPatient({
    patientId,
    limit
  });
  res.json(ApiResponse.success(result, 'Recent medicines retrieved successfully'));
});

exports.createCustomMedicine = asyncHandler(async (req, res) => {
  const result = await MedicineService.createCustomMedicine({ body: req.body });
  if (result.duplicate) {
    return res.status(409).json({ success: false, message: result.message, id: result.id });
  }
  res.status(201).json(ApiResponse.created(result, 'Medicine saved successfully'));
});

exports.saveMedicineDefaults = asyncHandler(async (req, res) => {
  const doctorId = req.user?.doctorId || req.user?.id;
  const result = await MedicineService.saveMedicineDefaults({
    doctorId,
    body: req.body
  });
  res.json(ApiResponse.success(result, 'Medicine defaults saved successfully'));
});

exports.getMyDefaults = asyncHandler(async (req, res) => {
  const { name } = req.query;
  const doctorId = req.user?.doctorId || req.user?.id;
  const result = await MedicineService.getMyDefaults({
    doctorId,
    name
  });
  res.json(ApiResponse.success(result, 'Medicine defaults retrieved successfully'));
});

exports.listMasterMedicines = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await MedicineService.listMasterMedicines({ page, limit, search });
  res.set('Cache-Control', 'no-store, no-cache');
  res.json(ApiResponse.success(result, 'Medicines retrieved successfully'));
});

exports.updateMedicine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ success: false, message: 'Invalid medicine ID' });
  }
  const result = await MedicineService.updateMedicine({ id: parseInt(id, 10), body: req.body });
  if (result.duplicate) {
    return res.status(409).json({ success: false, message: result.message });
  }
  res.json(ApiResponse.success(result, 'Medicine updated successfully'));
});

exports.deleteMedicine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ success: false, message: 'Invalid medicine ID' });
  }
  const result = await MedicineService.deleteMedicine({ id: parseInt(id, 10) });
  res.json(ApiResponse.success(result, 'Medicine deleted successfully'));
});
