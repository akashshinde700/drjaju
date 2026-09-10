// src/routes/billRoutes.js
const express = require('express');
const billController = require('../controllers/billController');

const billRoutesController = require('../controllers/billRoutesController');

// ✅ SAHI IMPORT - Destructuring se authentication le rahe hain app.use se
const { auditLogger } = require('../middleware/auditLogger');
const joiValidate = require('../middleware/joiValidate');
const { createBill, updateBill: updateBillSchema, updateBillStatus: updateBillStatusSchema, updateBillPayment: updateBillPaymentSchema } = require('../validation/commonSchemas');

const router = express.Router();

// Dashboard helper endpoint
router.get('/pending', billRoutesController.getPending);

// Get services list from database with categories
router.get('/services', billRoutesController.getServices);

// Add new billing service
router.post('/services', billRoutesController.addService);

// Update billing service
router.put('/services/:id', billRoutesController.updateService);

// Delete billing service
router.delete('/services/:id', billRoutesController.deleteService);

// Service groups routes
router.get('/service-groups', billRoutesController.getServiceGroups);
router.post('/service-groups', billRoutesController.addServiceGroup);
router.put('/service-groups/:id', billRoutesController.updateServiceGroup);
router.delete('/service-groups/:id', billRoutesController.deleteServiceGroup);

// Clinic settings routes (protected by app.use middleware)
router.get('/clinic-settings', billController.getClinicSettings);

// Summary and unbilled visits routes
router.get('/summary', billRoutesController.getSummary);

router.get('/unbilled-visits', billController.getUnbilledVisits);

// CRUD routes
router.get('/', billController.listBills);
router.get('/:id/pdf', billController.generateReceiptPDF);
router.get('/:id/whatsapp', billController.sendBillWhatsApp);
router.get('/:id', billController.getBill);
router.post('/', joiValidate(createBill), auditLogger('BILL'), billController.addBill);
router.put('/:id', joiValidate(updateBillSchema), auditLogger('BILL'), billController.updateBill);
router.patch('/:id/status', joiValidate(updateBillStatusSchema), auditLogger('BILL'), billController.updateBillStatus);
router.patch('/:id/payment', joiValidate(updateBillPaymentSchema), billRoutesController.updatePayment);

router.delete('/unbilled-visits/:id', auditLogger('BILL'), billController.deleteUnbilledVisit);
router.delete('/:id', auditLogger('BILL'), billController.deleteBill);

module.exports = router;