const express = require('express');
const router = express.Router();
const controller = require('../controllers/allergiesController');

// Auth enforced by app.js before this router

// GET /api/allergies/:patientId?active=1
router.get('/:patientId', controller.listByPatient);

// POST /api/allergies
router.post('/', controller.create);

// PATCH /api/allergies/:id
router.patch('/:id', controller.update);

module.exports = router;
