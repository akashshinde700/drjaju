const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

const subscriptionPackageController = require('../controllers/subscriptionPackageController');

const joiValidate = require('../middleware/joiValidate');
const { createSubscriptionPackage, updateSubscriptionPackage } = require('../validation/commonSchemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all packages
router.get('/', subscriptionPackageController.getAllPackages);

// Get package by ID
router.get('/:id', subscriptionPackageController.getPackageById);

// Create package (admin and doctor)
router.post('/', requireRole('admin', 'doctor'), joiValidate(createSubscriptionPackage), subscriptionPackageController.createPackage);

// Update package
router.put('/:id', requireRole('admin', 'doctor'), joiValidate(updateSubscriptionPackage), subscriptionPackageController.updatePackage);

// Delete package
router.delete('/:id', requireRole('admin', 'doctor'), subscriptionPackageController.deletePackage);

// Enroll patient in package
router.post('/enroll', subscriptionPackageController.enrollPatient);

// Track session usage (decrement remaining sessions)
router.patch('/:id/session', subscriptionPackageController.trackSessionUsage);

// Get patient subscriptions
router.get('/patient/:patient_id', subscriptionPackageController.getPatientSubscriptions);

module.exports = router;
