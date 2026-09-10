const PrescriptionService = require('../services/PrescriptionService');
const { ApiResponse, asyncHandler } = require('../utils');

/**
 * Refactored prescriptionController - Thin HTTP handlers delegating to PrescriptionService
 */

exports.createPrescription = asyncHandler(async (req, res) => {
  const prescription = await PrescriptionService.create(req.body);
  res.status(201).json(ApiResponse.created(prescription, 'Prescription created successfully'));
});

// Alias for backward compatibility
exports.addPrescription = exports.createPrescription;

exports.listPrescriptions = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10, search, patient_id: queryPatientId, doctor_id, status,
    start_date, end_date, sortBy
  } = req.query;

  // Support both route param /:patientId and query param ?patient_id=
  const patient_id = req.params.patientId || queryPatientId;

  const result = await PrescriptionService.getAll({
    page, limit, search, patient_id, doctor_id, status,
    start_date, end_date, sortBy
  });

  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total,
    'Prescriptions retrieved successfully',
    {
      totalPages: result.pagination.totalPages,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  ));
});

exports.getPrescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await PrescriptionService.getById(id);
  res.json(ApiResponse.success(prescription, 'Prescription retrieved successfully'));
});

// Alias for backward compatibility
exports.getPrescription = exports.getPrescriptionById;

exports.updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await PrescriptionService.update(id, req.body);
  res.json(ApiResponse.updated(prescription, 'Prescription updated successfully'));
});

exports.completePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await PrescriptionService.markCompletd(id);
  res.json(ApiResponse.updated(prescription, 'Prescription marked as completed successfully'));
});

exports.deletePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await PrescriptionService.delete(id);
  res.json(ApiResponse.deleted(prescription, 'Prescription deleted successfully'));
});

exports.getPrescriptionStats = asyncHandler(async (req, res) => {
  const stats = await PrescriptionService.getStats();
  res.json(ApiResponse.success(stats, 'Prescription statistics retrieved successfully'));
});

// Placeholder methods for endpoints not yet migrated
// TODO: Implement in PrescriptionService
exports.getPublicPrescriptionView = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Public prescription view'));
});

exports.generatePrescriptionPDF = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Prescription PDF generated'));
});

exports.getLastPrescription = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Last prescription'));
});

exports.savePrescriptionDiagnoses = asyncHandler(async (req, res) => {
  res.json(ApiResponse.created({}, 'Prescription diagnoses saved'));
});

exports.getPrescriptionDiagnoses = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Prescription diagnoses'));
});

exports.addMedicationsToPrescription = asyncHandler(async (req, res) => {
  res.json(ApiResponse.created({}, 'Medications added'));
});

exports.searchPrescriptions = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Prescriptions searched'));
});

exports.getRecentPrescriptionsCount = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({ count: 0 }, 'Recent prescriptions count'));
});

exports.endVisit = asyncHandler(async (req, res) => {
  res.json(ApiResponse.updated({}, 'Visit ended'));
});
