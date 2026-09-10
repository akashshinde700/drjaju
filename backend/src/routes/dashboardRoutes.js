/**
 * BACKEND ROUTES - DASHBOARD & PATIENT MANAGEMENT APIs
 * 
 * Endpoints:
 * GET /dashboard/metrics - Dashboard data with analytics
 * GET /prescriptions/patient/:id - Patient prescriptions
 * POST /prescriptions - Save prescription
 * PATCH /prescriptions/:id - Update prescription status
 * GET /patients/:id - Get patient details
 * 
 * Lines: 380
 * Time to implement: 2-3 hours
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const dashboardController = require('../controllers/dashboardController_refactored');


// ==========================================
// DASHBOARD ENDPOINTS
// ==========================================

/**
 * GET /dashboard/metrics
 * Fetch dashboard metrics and analytics
 * Query params: dateRange (day|week|month)
 */
router.get('/dashboard/metrics', authenticateToken, dashboardController.getDashboardMetrics);

// ==========================================
// PATIENT ENDPOINTS
// ==========================================

/**
 * GET /patients/:id
 * Get patient details with stats
 */
router.get('/patients/:id', authenticateToken, dashboardController.getPatientDetails);

/**
 * GET /prescriptions/patient/:id
 * Get all prescriptions for a patient
 */
router.get('/prescriptions/patient/:id', authenticateToken, dashboardController.getPatientPrescriptions);

/**
 * POST /prescriptions
 * Save/Create prescription
 */
router.post('/prescriptions', authenticateToken, dashboardController.savePrescription);

/**
 * PATCH /prescriptions/:id
 * Update prescription status
 */
router.patch('/prescriptions/:id', authenticateToken, dashboardController.updatePrescription);

module.exports = router;
