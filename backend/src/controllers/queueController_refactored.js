const QueueService = require('../services/QueueService');
const { asyncHandler, ApiResponse } = require('../utils');

/**
 * Queue Controller - Thin HTTP handlers delegating to QueueService
 */

// Add to queue
exports.addToQueue = asyncHandler(async (req, res) => {
  const queue = await QueueService.addToQueue(req.body);
  res.status(201).json(ApiResponse.created(queue, 'Patient added to queue'));
});

// Get today's queue
exports.getTodayQueue = asyncHandler(async (req, res) => {
  // Fall back to the caller's own doctor_id when they're a doctor and didn't
  // pass one explicitly — this endpoint has no scoping at all otherwise, so
  // any caller that forgets the param (e.g. DoctorDashboard, which never
  // sent it) silently gets every doctor's queue rows mixed together. Mirrors
  // the same fallback already applied to getQueueStats/getDashboardStats.
  const queryParams = { ...req.query };
  if (req.user?.role === 'doctor' && !queryParams.doctor_id) {
    queryParams.doctor_id = req.user?.doctor_id || undefined;
  }
  const result = await QueueService.getTodayQueue(queryParams);
  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  ));
});

// Get queue by ID
exports.getQueueById = asyncHandler(async (req, res) => {
  const queue = await QueueService.getById(req.params.id);
  res.json(ApiResponse.success(queue, 'Queue entry fetched'));
});

// Update queue status
exports.updateQueueStatus = asyncHandler(async (req, res) => {
  const queue = await QueueService.updateStatus(req.params.id, req.body.status);
  res.json(ApiResponse.updated(queue, 'Queue status updated'));
});

// Call next patient
exports.callNextPatient = asyncHandler(async (req, res) => {
  const queue = await QueueService.callNextPatient(req.params.doctor_id);
  res.json(ApiResponse.success(queue, 'Next patient called'));
});

// Remove from queue
exports.removeFromQueue = asyncHandler(async (req, res) => {
  const queue = await QueueService.removeFromQueue(req.params.id, req.body?.reason);
  res.json(ApiResponse.deleted(queue, 'Patient removed from queue'));
});

// Get queue statistics
exports.getQueueStats = asyncHandler(async (req, res) => {
  // Scope by doctor so the KPI row matches the (doctor-scoped) Active Queue
  // list below it — mirrors getDashboardStats' resolution. Without this, the
  // query summed every doctor's queue/bills clinic-wide.
  let doctorId = null;
  if (req.user?.role === 'doctor') {
    doctorId = req.query.doctor_id || req.user?.doctor_id || null;
  } else {
    doctorId = req.query.doctor_id || null;
  }
  const stats = await QueueService.getStats(req.query.date, { doctor_id: doctorId, clinic_id: null });
  res.json(ApiResponse.success(stats, 'Queue statistics fetched'));
});

// Get the 5 Queue Dashboard summary-card counts (today/followups/completed/upcoming/others)
exports.getDashboardStats = asyncHandler(async (req, res) => {
  // Scope by doctor so the cards match the list EXACTLY:
  //  - doctor: their own doctor_id (or an explicit ?doctor_id)
  //  - admin / staff: only when a specific doctor is selected (?doctor_id),
  //    otherwise UNSCOPED — this mirrors the active list path
  //    (AppointmentService.getAll only auto-scopes role === 'doctor') and
  //    Queue.jsx, which sends no doctor_id for admins-without-selection / staff.
  let doctorId = null;
  if (req.user?.role === 'doctor') {
    doctorId = req.query.doctor_id || req.user?.doctor_id || null;
  } else {
    doctorId = req.query.doctor_id || null;
  }

  const stats = await QueueService.getDashboardStats({ doctor_id: doctorId, clinic_id: null });
  res.json(ApiResponse.success(stats, 'Queue dashboard stats fetched'));
});

// Aliases for backward compatibility
exports.addPatientToQueue = exports.addToQueue;
exports.getQueueForDoctor = exports.getTodayQueue;
exports.getQueue = exports.getQueueById;
exports.updateStatus = exports.updateQueueStatus;
exports.cancelQueue = exports.removeFromQueue;
