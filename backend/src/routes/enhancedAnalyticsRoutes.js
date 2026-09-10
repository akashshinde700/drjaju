const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const enhancedAnalyticsController = require('../controllers/enhancedAnalyticsController');

const router = express.Router();

// Dashboard overview with period support (today, week, month, 3months, year)
router.get('/dashboard/overview', authenticateToken, enhancedAnalyticsController.getDashboardOverview);

// Visit analytics with grouping (day, week, month, year)
router.get('/visits', authenticateToken, enhancedAnalyticsController.getVisitAnalytics);

// Medication usage analytics
router.get('/medications', authenticateToken, enhancedAnalyticsController.getMedicationAnalytics);

// Symptoms/diagnosis analytics
router.get('/symptoms', authenticateToken, enhancedAnalyticsController.getSymptomsAnalytics);

// Prescription analytics
router.get('/prescriptions', authenticateToken, enhancedAnalyticsController.getPrescriptionAnalytics);

// Payment analytics and reports
router.get('/payments', authenticateToken, enhancedAnalyticsController.getPaymentAnalytics);

// Patient demographics
router.get('/demographics', authenticateToken, enhancedAnalyticsController.getPatientDemographics);

// Doctor performance metrics
router.get('/doctor-performance', authenticateToken, enhancedAnalyticsController.getDoctorPerformance);

// Search endpoints
router.get('/search/patients', authenticateToken, enhancedAnalyticsController.searchPatients);
router.get('/doctors', authenticateToken, enhancedAnalyticsController.getDoctorsList);

module.exports = router;
