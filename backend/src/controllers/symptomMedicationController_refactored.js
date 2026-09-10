const SymptomMedicationService = require('../services/SymptomMedicationService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getMedicationSuggestions = asyncHandler(async (req, res) => {
  const result = await SymptomMedicationService.getMedicationSuggestions(req.query);
  res.json(ApiResponse.success(result, 'Medication suggestions retrieved successfully'));
});

exports.getAllMappings = asyncHandler(async (_req, res) => {
  const result = await SymptomMedicationService.getAllMappings();
  res.json(ApiResponse.success(result, 'Mappings retrieved successfully'));
});

exports.addMapping = asyncHandler(async (req, res) => {
  const result = await SymptomMedicationService.addMapping(req.body);
  res.status(201).json(ApiResponse.created(result, 'Mapping added successfully'));
});

exports.deleteMapping = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SymptomMedicationService.deleteMapping(id);
  res.json(ApiResponse.deleted(null, 'Mapping deleted successfully'));
});
