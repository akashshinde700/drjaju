const FamilyHistoryService = require('../services/FamilyHistoryService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getFamilyHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await FamilyHistoryService.getFamilyHistory(patientId);
  res.json(ApiResponse.success(result, 'Family history retrieved successfully'));
});

exports.addFamilyHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await FamilyHistoryService.addFamilyHistory({ patientId, body: req.body });
  res.status(201).json(ApiResponse.created(result, 'Family history added successfully'));
});

exports.updateFamilyHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await FamilyHistoryService.updateFamilyHistory({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Family history updated successfully'));
});

exports.deleteFamilyHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await FamilyHistoryService.deleteFamilyHistory(id);
  res.json(ApiResponse.deleted(null, 'Family history deleted successfully'));
});
