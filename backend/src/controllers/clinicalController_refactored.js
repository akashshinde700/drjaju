const ClinicalService = require('../services/ClinicalService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getClinicalData = asyncHandler(async (req, res) => {
  const result = await ClinicalService.getClinicalData();
  res.json(ApiResponse.success(result, 'Clinical data retrieved successfully'));
});

exports.getClinicalRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await ClinicalService.getClinicalRecordById({ id });
  res.json(ApiResponse.success(result, 'Clinical record retrieved successfully'));
});
