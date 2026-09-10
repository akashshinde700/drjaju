const MedicalRoutesService = require('../services/MedicalRoutesService');
const { asyncHandler } = require('../utils');

// Preserve existing response shapes from routes

exports.searchSymptoms = asyncHandler(async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    const result = await MedicalRoutesService.searchSnomedSymptoms({ q, limit });
    return res.json(result);
  } catch (error) {
    console.error('Error searching symptoms:', error);
    if (error?.status === 400 || error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to search symptoms' });
  }
});

exports.diagnosisSuggestions = asyncHandler(async (req, res) => {
  try {
    const { symptoms } = req.body;
    const result = await MedicalRoutesService.getDiagnosisSuggestions({ symptoms });
    return res.json(result);
  } catch (error) {
    console.error('Error getting diagnosis suggestions:', error);
    if (error?.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to get diagnosis suggestions' });
  }
});

exports.medicineSuggestions = asyncHandler(async (req, res) => {
  try {
    const { symptoms, diagnosisCodes, diagnosisType } = req.body;
    const result = await MedicalRoutesService.getMedicineSuggestions({ symptoms, diagnosisCodes, diagnosisType });
    return res.json(result);
  } catch (error) {
    console.error('Error getting medicine suggestions:', error);
    return res.status(500).json({ error: 'Failed to get medicine suggestions' });
  }
});

exports.medicineDosage = asyncHandler(async (req, res) => {
  try {
    const { medicineName } = req.params;
    const result = await MedicalRoutesService.getMedicineDosage({ medicineName });
    return res.json(result);
  } catch (error) {
    console.error('Error getting dosage information:', error);
    return res.status(500).json({ error: 'Failed to get dosage information' });
  }
});

exports.searchIcd = asyncHandler(async (req, res) => {
  try {
    const { q, type = 'icd10', limit = 20 } = req.query;
    const result = await MedicalRoutesService.searchIcdCodes({ q, type, limit });
    return res.json(result);
  } catch (error) {
    console.error('Error searching ICD codes:', error);
    if (error?.status === 400 || error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to search ICD codes' });
  }
});
