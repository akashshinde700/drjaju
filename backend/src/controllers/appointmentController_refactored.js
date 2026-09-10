const AppointmentService = require('../services/AppointmentService');
const { ApiResponse, asyncHandler } = require('../utils');
const { getDb } = require('../config/db');
const logger = require('../services/logger');

/**
 * Refactored appointmentController - Thin HTTP handlers delegating to AppointmentService
 */

exports.createAppointment = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Resolve clinic/doctor context from auth when not explicitly provided
  const resolvedClinicId = body.clinic_id ?? req.user?.clinic_id ?? req.user?.clinicId ?? null;
  const resolvedDoctorId = body.doctor_id ?? req.user?.doctor_id ?? req.user?.doctorId ?? null;

  const appointment = await AppointmentService.create({
    ...body,
    clinic_id: resolvedClinicId,
    doctor_id: resolvedDoctorId,
  });
  res.status(201).json(ApiResponse.created(appointment, 'Appointment created successfully'));
});

// Alias for backward compatibility
exports.addAppointment = exports.createAppointment;

exports.listAppointments = asyncHandler(async (req, res) => {
  const {
    date, status, doctor_id, patient_id, start_date, end_date,
    page = 1, limit = 50, search, sortBy
  } = req.query;

  const result = await AppointmentService.getAll({
    page, limit, search, status, date, doctor_id, patient_id,
    start_date, end_date, sortBy,
    userRole: req.user?.role,
    doctorId: req.user?.doctor_id,
    clinicId: req.user?.clinic_id,
  });

  res.json(ApiResponse.paginated(
    result.data,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total,
    'Appointments retrieved successfully',
    {
      totalPages: result.pagination.totalPages,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  ));
});

exports.getAppointmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await AppointmentService.getById(id);
  res.json(ApiResponse.success(appointment, 'Appointment retrieved successfully'));
});

// Alias for backward compatibility
exports.getAppointment = exports.getAppointmentById;

exports.updateAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await AppointmentService.update(id, req.body);
  res.json(ApiResponse.updated(appointment, 'Appointment updated successfully'));
});

exports.updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await AppointmentService.update(id, { status: req.body.status });
  res.json(ApiResponse.updated(appointment, 'Appointment status updated successfully'));
});

exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;

  // Resolve appointment id:
  // - Primary: treat :id as appointment id
  // - Fallback: treat :id as queue id and resolve queue.appointment_id
  let appointmentId = id;
  const db = getDb();

  const [[apptRow]] = await db.execute(
    'SELECT id FROM appointments WHERE id = ? LIMIT 1',
    [appointmentId]
  );

  if (!apptRow) {
    const [[queueRow]] = await db.execute(
      'SELECT appointment_id FROM queue WHERE id = ? LIMIT 1',
      [id]
    );
    if (!queueRow?.appointment_id) {
      return res.status(404).json(ApiResponse.notFound(null, 'Appointment not found'));
    }
    appointmentId = queueRow.appointment_id;
  }

  const appointment = await AppointmentService.update(appointmentId, { payment_status });

  // Best-effort sync to latest bill (if any)
  try {
    const [bills] = await db.execute(
      'SELECT id FROM bills WHERE appointment_id = ? ORDER BY id DESC LIMIT 1',
      [appointmentId]
    );
    const billId = bills[0]?.id;
    if (billId) {
      await db.execute(
        'UPDATE bills SET payment_status = ?, updated_at = NOW() WHERE id = ?',
        [payment_status, billId]
      );
    }
  } catch (_e) {
    logger.debug('Best-effort bill payment_status sync failed', { message: _e.message, appointmentId });
  }

  res.json(ApiResponse.updated(appointment, 'Payment status updated successfully'));
});

exports.cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await AppointmentService.delete(id);
  res.json(ApiResponse.deleted(appointment, 'Appointment cancelled successfully'));
});

// Alias for backward compatibility
exports.deleteAppointment = exports.cancelAppointment;

exports.checkInAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await AppointmentService.checkIn(id);
  res.json(ApiResponse.updated(appointment, 'Appointment checked in successfully'));
});

exports.getAppointmentStats = asyncHandler(async (req, res) => {
  const stats = await AppointmentService.getStats();
  res.json(ApiResponse.success(stats, 'Appointment statistics retrieved successfully'));
});

// Placeholder methods for endpoints not yet migrated to service layer
// TODO: Implement these in AppointmentService
exports.listFollowUps = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Follow-ups retrieved'));
});

exports.getBookedSlots = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({}, 'Booked slots retrieved'));
});

exports.getTodayAppointmentsCount = asyncHandler(async (req, res) => {
  res.json(ApiResponse.accepted({ count: 0 }, 'Today appointments count'));
});

exports.getAppointmentStatsSummary = asyncHandler(async (req, res) => {
  const stats = await AppointmentService.getStats();
  res.json(ApiResponse.success(stats, 'Appointment statistics summary'));
});
