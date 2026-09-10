const express = require('express');
const router = express.Router();
const controller = require('../controllers/adviceController');

// Auth enforced by app.js before this router

// GET /api/advice/latest?patientId=&appointmentId=
router.get('/latest', controller.getLatest);

// GET /api/advice/templates?language=hi&limit=20
router.get('/templates', controller.getTemplates);

module.exports = router;
