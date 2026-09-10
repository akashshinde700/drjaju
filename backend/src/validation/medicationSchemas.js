const Joi = require('joi');

// Search medications schema
const searchMedicationsSchema = Joi.object({
  q: Joi.string().optional().min(1).max(100),
  category: Joi.string().optional().max(50),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

// Get medications by diagnosis schema
const medicationsByDiagnosisSchema = Joi.object({
  diagnosisCodes: Joi.array().items(Joi.string().max(20)).min(1).required(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  includeAlternatives: Joi.boolean().default(false)
});

// Get medications by symptom schema
const medicationsBySymptomSchema = Joi.object({
  symptoms: Joi.array().items(Joi.string().max(100)).min(1).required(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  severity: Joi.string().valid('mild', 'moderate', 'severe').optional()
});

// Medication protocol schema
const medicationProtocolSchema = Joi.object({
  type: Joi.string().valid('acute', 'chronic', 'emergency', 'pediatric', 'geriatric').required()
});

// Get patient recent medications schema
const patientRecentMedicationsSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  days: Joi.number().integer().min(1).max(365).default(30),
  includeActive: Joi.boolean().default(true)
});

// Get medication details schema
const medicationDetailsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  includeAlternatives: Joi.boolean().default(false),
  includeInteractions: Joi.boolean().default(false)
});

module.exports = {
  searchMedicationsSchema,
  medicationsByDiagnosisSchema,
  medicationsBySymptomSchema,
  medicationProtocolSchema,
  patientRecentMedicationsSchema,
  medicationDetailsSchema
};
