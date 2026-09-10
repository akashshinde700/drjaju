const SuggestionService = require('../services/SuggestionService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getSymptomBasedSuggestions = asyncHandler(async (req, res) => {
  const result = await SuggestionService.getSymptomBasedSuggestions(req.body);
  res.json(ApiResponse.success(result, 'Suggestions retrieved successfully'));
});

exports.getDiagnosisMedicationsAndDosages = asyncHandler(async (req, res) => {
  const { icd_code } = req.params;
  const result = await SuggestionService.getDiagnosisMedicationsAndDosages({ icd_code, ...req.query });
  res.json(ApiResponse.success(result, 'Diagnosis medications retrieved successfully'));
});

exports.getPrescriptionSuggestion = asyncHandler(async (req, res) => {
  const result = await SuggestionService.getPrescriptionSuggestion(req.body);
  res.json(ApiResponse.success(result, 'Prescription suggestion retrieved successfully'));
});

exports.getIntegratedPrescriptionSuggestions = asyncHandler(async (req, res) => {
  const result = await SuggestionService.getIntegratedPrescriptionSuggestions(req.body);
  res.json(ApiResponse.success(result, 'Integrated prescription suggestions retrieved successfully'));
});
