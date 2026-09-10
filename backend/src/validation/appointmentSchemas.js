const Joi = require('joi');

const createAppointment = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  clinic_id: Joi.number().integer().positive().allow(null),
  appointment_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  appointment_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
  appointment_slot_id: Joi.number().integer().positive().allow(null),
  arrival_type: Joi.string().valid('online','walk-in','referral','emergency').default('online'),
  reason_for_visit: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

const updateAppointment = Joi.object({
  patient_id: Joi.number().integer().positive().optional(),
  doctor_id: Joi.number().integer().positive().optional(),
  clinic_id: Joi.number().integer().positive().allow(null),
  appointment_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  appointment_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  appointment_slot_id: Joi.number().integer().positive().allow(null),
  arrival_type: Joi.string().valid('online','walk-in','referral','emergency').optional(),
  status: Joi.string().valid('scheduled','in-progress','completed','cancelled','no-show').optional(),
  reason_for_visit: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

const updateAppointmentStatus = Joi.object({
  status: Joi.string().valid('scheduled','in-progress','completed','cancelled','no-show','paid').required()
});

const updatePaymentStatus = Joi.object({
  payment_status: Joi.string().valid('pending','paid','partial','cancelled','refunded').required()
});

module.exports = { createAppointment, updateAppointment, updateAppointmentStatus, updatePaymentStatus };
