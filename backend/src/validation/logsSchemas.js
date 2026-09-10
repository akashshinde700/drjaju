const Joi = require('joi');

// Error log schema
const errorLogSchema = Joi.object({
  message: Joi.string().required().min(1).max(1000),
  stack: Joi.string().optional().max(5000),
  url: Joi.string().uri().optional().max(500),
  userAgent: Joi.string().optional().max(500),
  context: Joi.object().optional(),
  severity: Joi.string().valid('error', 'warning', 'critical').default('error')
});

// Analytics event schema
const analyticsEventSchema = Joi.object({
  eventName: Joi.string().required().min(1).max(100),
  eventData: Joi.object().optional(),
  timestamp: Joi.date().optional().iso()
});

module.exports = {
  errorLogSchema,
  analyticsEventSchema
};
