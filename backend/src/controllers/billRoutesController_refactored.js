const BillRoutesService = require('../services/BillRoutesService');
const { asyncHandler } = require('../utils');

// Preserve response shapes from legacy billRoutes inline handlers

exports.getPending = asyncHandler(async (req, res) => {
  try {
    const clinicId = req.user?.clinic_id || null;
    // Explicit query param wins; otherwise fall back to the caller's own
    // doctor_id (resolved at login for both 'doctor' and 'staff' roles) so a
    // doctor's dashboard never shows another doctor's pending bills in a
    // multi-doctor clinic.
    const doctorId = req.query.doctor_id || req.user?.doctor_id || null;
    const result = await BillRoutesService.getPendingSummary({ clinicId, doctorId });
    return res.json(result);
  } catch (error) {
    console.error('bills/pending error:', error);
    return res.status(500).json({ error: 'Failed to fetch pending bills' });
  }
});

exports.getServices = asyncHandler(async (req, res) => {
  try {
    const result = await BillRoutesService.listBillingServices();
    return res.json({ success: true, services: result.services, grouped: result.grouped });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
});

exports.addService = asyncHandler(async (req, res) => {
  try {
    const { service_name, category, default_price, unit } = req.body;
    if (!service_name || !category) {
      return res.status(400).json({ success: false, error: 'Service name and category are required' });
    }

    const result = await BillRoutesService.addBillingService({ service_name, category, default_price, unit });
    return res.status(201).json({ success: true, id: result.id, message: 'Service added' });
  } catch (error) {
    console.error('Failed to add service:', error);
    return res.status(500).json({ success: false, error: 'Failed to add service' });
  }
});

exports.updateService = asyncHandler(async (req, res) => {
  try {
    const { service_name, category, default_price, unit } = req.body;
    await BillRoutesService.updateBillingService({
      id: req.params.id,
      service_name,
      category,
      default_price,
      unit
    });
    return res.json({ success: true, message: 'Service updated' });
  } catch (error) {
    console.error('Failed to update service:', error);
    return res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

exports.deleteService = asyncHandler(async (req, res) => {
  try {
    await BillRoutesService.deleteBillingService({ id: req.params.id });
    return res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    console.error('Failed to delete service:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

// ── Service Groups ──────────────────────────────────────────────────────────

exports.getServiceGroups = asyncHandler(async (req, res) => {
  try {
    const doctorId = req.user?.id || null;
    const groups = await BillRoutesService.listServiceGroups({ doctorId });
    return res.json({ success: true, groups });
  } catch (error) {
    console.error('Failed to fetch service groups:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch service groups' });
  }
});

exports.addServiceGroup = asyncHandler(async (req, res) => {
  try {
    const { group_name, services } = req.body;
    if (!group_name) return res.status(400).json({ success: false, error: 'Group name required' });
    const doctorId = req.user?.id || null;
    const result = await BillRoutesService.addServiceGroup({ group_name, services, doctorId });
    return res.status(201).json({ success: true, id: result.id });
  } catch (error) {
    console.error('Failed to add service group:', error);
    return res.status(500).json({ success: false, error: 'Failed to add service group' });
  }
});

exports.updateServiceGroup = asyncHandler(async (req, res) => {
  try {
    const { group_name, services } = req.body;
    await BillRoutesService.updateServiceGroup({ id: req.params.id, group_name, services });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to update service group:', error);
    return res.status(500).json({ success: false, error: 'Failed to update service group' });
  }
});

exports.deleteServiceGroup = asyncHandler(async (req, res) => {
  try {
    await BillRoutesService.deleteServiceGroup({ id: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete service group:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete service group' });
  }
});

// ── End Service Groups ──────────────────────────────────────────────────────

exports.getSummary = asyncHandler(async (req, res) => {
  try {
    // Scope to the caller's clinic to prevent cross-clinic data leaks.
    // NOTE: we intentionally scope by clinic only (matching getPendingSummary
    // and listBills) — not by doctor_id — because many bills are created with a
    // NULL doctor_id, so doctor scoping would wrongly show empty cards.
    const clinicId = req.user?.clinic_id || null;

    const {
      start_date,
      end_date,
      payment_status,
      payment_method,
      search,
      day_start,
      day_end
    } = req.query;

    const result = await BillRoutesService.getBillsSummary({
      clinicId,
      startDate: start_date || null,
      endDate: end_date || null,
      paymentStatus: payment_status || null,
      paymentMethod: payment_method || null,
      search: search || null,
      dayStart: day_start || null,
      dayEnd: day_end || null
    });
    return res.json(result);
  } catch (error) {
    console.error('Get bills summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch bills summary' });
  }
});

exports.updatePayment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paid_amount } = req.body;

    const result = await BillRoutesService.updateBillPayment({ id, amount, paid_amount });

    if (!result.ok && result.code === 'not_found') {
      return res.status(404).json({ error: 'Bill not found' });
    }

    return res.json(result.data);
  } catch (error) {
    console.error('Update payment error:', error);
    return res.status(500).json({ error: 'Failed to update payment' });
  }
});
