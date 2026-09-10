// backend/src/routes/doctorRoutes.js
const express = require('express');

const {
  exportDoctorCSV,
  exportDoctorExcel,
  exportDoctorSQL,
  getDoctorStats
} = require('../controllers/doctorExportController');
const doctorController = require('../controllers/doctorController');
const { authenticateToken } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// -------------------------
// Public (authenticated) endpoints
// -------------------------

// List active doctors (for dropdown etc.)
router.get('/', authenticateToken, doctorController.listDoctors);

// Get doctor by user_id (for logged-in doctor profile)
// NOTE: This must be defined BEFORE '/:id' route
router.get('/by-user/:userId', authenticateToken, doctorController.getDoctorByUserId);

// -------------------------
// Admin-only endpoints
// -------------------------

router.get('/all', authenticateToken, requireAdmin, doctorController.getAllDoctors);
router.get('/count', authenticateToken, requireAdmin, doctorController.getDoctorCount);

// -------------------------
// Doctor Export endpoints (Admin only) - MUST be before /:id
// -------------------------

// Get doctor statistics
router.get(
  '/export/stats',
  authenticateToken,
  requireAdmin,
  getDoctorStats
);

// Export doctor data as CSV (table-wise)
router.get(
  '/export/csv',
  authenticateToken,
  requireAdmin,
  auditLogger('DOCTOR_EXPORT'),
  exportDoctorCSV
);

// Export doctor data as Excel (all tables or selected)
router.get(
  '/export/excel',
  authenticateToken,
  requireAdmin,
  auditLogger('DOCTOR_EXPORT'),
  exportDoctorExcel
);

// Export doctor data as SQL
router.get(
  '/export/sql',
  authenticateToken,
  requireAdmin,
  auditLogger('DOCTOR_EXPORT'),
  exportDoctorSQL
);

// -------------------------
// Landing Page & Affiliations
// -------------------------
// Note: /:doctorId/landing is mounted as a public route in app.js (no auth)
router.get('/:doctorId/affiliations', doctorController.getAffiliations);
router.post('/:doctorId/affiliations', authenticateToken, doctorController.addAffiliation);
router.delete('/:doctorId/affiliations/:id', authenticateToken, doctorController.deleteAffiliation);

// -------------------------
// CRUD endpoints
// -------------------------

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  auditLogger('DOCTOR'),
  doctorController.addDoctor
);

// Get doctor by ID (admin or the doctor themselves)
router.get(
  '/:id',
  authenticateToken,
  doctorController.getDoctorById
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  auditLogger('DOCTOR'),
  doctorController.updateDoctor
);

// Self-service (or admin) update of WhatsApp follow-up / online-presence
// settings — website, Google review link, socials, custom template.
// Authorization (admin OR the doctor themselves) is checked inside the
// controller since it depends on looking up the row's user_id.
router.put(
  '/:id/whatsapp-settings',
  authenticateToken,
  auditLogger('DOCTOR'),
  doctorController.updateDoctorWhatsAppSettings
);

// Generate a QR code for the doctor's own booking_url (self-service or admin).
router.post(
  '/:id/booking-qr',
  authenticateToken,
  auditLogger('DOCTOR'),
  doctorController.generateDoctorBookingQR
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  auditLogger('DOCTOR'),
  doctorController.deleteDoctor
);

module.exports = router;