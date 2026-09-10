const DiagnosisService = require('../services/DiagnosisService');
const { ApiResponse, asyncHandler } = require('../utils');
const { getDb } = require('../config/db');

exports.searchDiagnoses = asyncHandler(async (req, res) => {
  const { q, limit, offset, version } = req.query;

  if (!q || q.trim().length < 1) {
    return res.json(ApiResponse.success({ diagnoses: [] }, 'Search completed'));
  }

  const doctorId = req.user?.doctorId || req.user?.id || null;
  const result = await DiagnosisService.searchDiagnoses({
    query: q,
    limit,
    offset,
    doctorId,
    version
  });

  res.json(ApiResponse.success(result, 'Diagnoses searched successfully'));
});

exports.suggestBySymptoms = asyncHandler(async (req, res) => {
  const { symptoms, limit } = req.query;
  const result = await DiagnosisService.suggestDiagnosesBySymptoms({
    symptoms,
    limit
  });

  res.json(ApiResponse.success(result, 'Diagnoses suggested successfully'));
});

exports.getMedicationsForDiagnosis = asyncHandler(async (req, res) => {
  const { icd_code } = req.params;
  const { limit } = req.query;
  const result = await DiagnosisService.getMedicationsByDiagnosis({
    icd_code,
    limit
  });

  res.json(ApiResponse.success(result, 'Medications retrieved successfully'));
});

exports.getDiagnosisDetails = asyncHandler(async (req, res) => {
  const { icd_code } = req.params;
  const result = await DiagnosisService.getDiagnosisDetails({ icd_code });

  res.json(ApiResponse.success(result, 'Diagnosis details retrieved successfully'));
});

exports.saveCustomDiagnosis = asyncHandler(async (req, res) => {
  const { diagnosis_name, icd_code } = req.body;
  const doctorId = req.user?.doctorId || req.user?.id;

  if (!doctorId) {
    return res.status(401).json({ error: 'Doctor ID not found' });
  }

  const result = await DiagnosisService.saveCustomDiagnosis({
    diagnosis_name,
    icd_code,
    doctorId
  });

  res.json(ApiResponse.success(result, 'Custom diagnosis saved successfully'));
});

exports.getFrequentlyUsedDiagnoses = asyncHandler(async (req, res) => {
  let doctorId = req.user?.doctorId || req.user?.doctor_id || req.user?.doctorId || null;
  // Many tokens carry the user id (users.id). Resolve doctors.id when needed.
  if (!doctorId && req.user?.id) {
    try {
      const db = getDb();
      const [rows] = await db.execute('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (rows.length) doctorId = rows[0].id;
    } catch (_) {
      // ignore
    }
  }
  const { limit } = req.query;
  const result = await DiagnosisService.getFrequentlyUsedDiagnoses({ doctorId, limit });
  res.json(ApiResponse.success(result, 'Frequently used diagnoses retrieved'));
});
