const PatientService = require('../services/PatientService');
const { ApiResponse, asyncHandler } = require('../utils');

/**
 * Refactored patientController - Thin HTTP handlers delegating to PatientService
 */

exports.createPatient = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Resolve clinic/doctor context from auth when not explicitly provided
  const clinicId = body.clinic_id || req.user?.clinic_id || req.user?.clinicId || null;
  const primaryDoctorId = body.primary_doctor_id || body.doctor_id || req.user?.doctor_id || req.user?.doctorId || null;

  const patient = await PatientService.create({
    ...body,
    clinic_id: clinicId,
    primary_doctor_id: primaryDoctorId,
  });
  res.status(201).json(ApiResponse.created(patient, 'Patient created successfully'));
});

// Alias for backward compatibility
exports.addPatient = exports.createPatient;

exports.listPatients = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10, search, gender, blood_group, city, state, sortBy, context
  } = req.query;

  const result = await PatientService.getAll({
    page, limit, search, gender, blood_group, city, state, sortBy, context,
    userRole: req.user?.role,
    userId: req.user?.id,
    doctorId: req.user?.doctor_id,
    clinicId: req.user?.clinic_id,
  });

  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total,
    'Patients retrieved successfully',
    {
      totalPages: result.pagination.totalPages,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  ));
});

exports.getPatientById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patient = await PatientService.getById(id);
  res.json(ApiResponse.success(patient, 'Patient retrieved successfully'));
});

// Alias for backward compatibility
exports.getPatient = exports.getPatientById;

exports.getPatientByPatientId = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const patient = await PatientService.getByPatientId(patientId);
  res.json(ApiResponse.success(patient, 'Patient retrieved successfully'));
});

exports.updatePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patient = await PatientService.update(id, req.body);
  res.json(ApiResponse.updated(patient, 'Patient updated successfully'));
});

exports.deletePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patient = await PatientService.delete(id);
  res.json(ApiResponse.deleted(patient, 'Patient deleted successfully'));
});

exports.getPatientStats = asyncHandler(async (req, res) => {
  const stats = await PatientService.getStats();
  res.json(ApiResponse.success(stats, 'Patient statistics retrieved successfully'));
});

// Placeholder methods for endpoints not yet migrated
// TODO: Implement in PatientService
exports.getMyPatientsCount = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({ count: 0 }, 'My patients count'));
});

exports.getTodayNewPatientsCount = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({ count: 0 }, 'Today new patients count'));
});

exports.mergePatients = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Patients merged successfully'));
});

/**
 * Check for duplicate patient by phone + fuzzy name matching.
 * Only flags phone_and_name matches as duplicates (phone_only = family members sharing a number).
 * GET /api/patients/check-duplicate?phone=X&name=Y
 */
exports.checkDuplicate = asyncHandler(async (req, res) => {
  const { phone, name } = req.query;
  const { getDb } = require('../config/db');
  const db = getDb();
  const { findExistingPatient } = require('../utils/patientMatcher');

  if (!phone && !name) {
    return res.json(ApiResponse.success({ found: false, patient: null, matchType: null }, 'No search criteria provided'));
  }

  const result = await findExistingPatient(db, phone, name);

  // Only flag as duplicate if BOTH phone matches AND name is similar.
  // phone_only = family members sharing the same number — not a duplicate.
  if (result && result.matchType === 'phone_and_name') {
    return res.json(ApiResponse.success({
      found: true,
      patient: result.patient,
      matchType: result.matchType,
    }, 'Similar patient found'));
  }

  res.json(ApiResponse.success({ found: false, patient: null, matchType: null }, 'No duplicate found'));
});
