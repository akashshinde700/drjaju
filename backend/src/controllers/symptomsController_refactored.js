const SymptomsService = require('../services/SymptomsService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.searchSymptoms = asyncHandler(async (req, res) => {
  const { q, limit, offset } = req.query;
  const doctorId = req.user?.doctorId || req.user?.id || null;
  const result = await SymptomsService.searchSymptoms({ q, limit, offset, doctorId });

  // preserve existing response shape
  res.json(result);
});

exports.getMedicationsBySymptom = asyncHandler(async (req, res) => {
  const { symptom } = req.params;
  const { limit } = req.query;
  const result = await SymptomsService.getMedicationsBySymptom({ symptom, limit });
  res.json(result);
});

exports.getRelatedDiagnoses = asyncHandler(async (req, res) => {
  const { symptom } = req.params;
  const { limit } = req.query;
  const result = await SymptomsService.getRelatedDiagnoses({ symptom, limit });
  res.json(result);
});

exports.saveCustomSymptom = asyncHandler(async (req, res) => {
  const { symptom_name } = req.body;
  const doctorId = req.user?.doctorId || req.user?.id;
  const result = await SymptomsService.saveCustomSymptom({ symptom_name, doctorId });
  res.json(result);
});
