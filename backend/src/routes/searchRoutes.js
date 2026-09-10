// src/routes/searchRoutes.js (or jo bhi file name hai)
const express = require('express');
const router = express.Router();

// ✅ SAHI IMPORT - Destructuring se authenticateToken le rahe hain
// (aapke middleware mein authenticateToken naam se export hua hai, authenticate nahi)
const { authenticateToken } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

// For query validation, we need a custom middleware since joiValidate targets req.body
const Joi = require('joi');
const { searchQuery } = require('../validation/commonSchemas');
const joiValidate = require('../middleware/joiValidate');
const joiValidateQuery = (schema) => (req, res, next) => {
  const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
  const { error, value } = schema.validate(req.query, options);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => d.message)
    });
  }
  req.query = value;
  return next();
};

router.get('/', authenticateToken, joiValidateQuery(searchQuery), searchController.advancedSearch);

module.exports = router;