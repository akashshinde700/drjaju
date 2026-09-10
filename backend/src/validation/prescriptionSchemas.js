const Joi = require('joi');

const createPrescription = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().optional(),
  appointment_id: Joi.number().integer().positive().allow(null),
  template_id: Joi.number().integer().positive().allow(null),
  prescription_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  diagnosis: Joi.array().items(Joi.string()).optional(),
  symptoms: Joi.array().items(Joi.string()).optional(),
  vitals: Joi.object().optional(),
  advice: Joi.string().allow('', null),
  follow_up_days: Joi.number().integer().allow(null),
  follow_up_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
  patient_notes: Joi.string().allow('', null),
  private_notes: Joi.string().allow('', null),
  lab_advice: Joi.string().allow('', null),
  lab_remarks: Joi.string().allow('', null),
  // Values for doctor-defined custom pad fields (Pad Configuration), keyed
  // by field name — was previously stripped by joiValidate's stripUnknown
  // before ever reaching the controller, so nothing typed into a custom
  // field was ever saved.
  custom_fields: Joi.object().unknown(true).allow(null).optional(),
  examination_findings: Joi.object().unknown(true).optional(),
  medications: Joi.array().items(Joi.object({
    medication_name: Joi.string().max(255).required(),
    name: Joi.string().max(255).optional(),
    brand_name: Joi.string().max(255).optional(),
    generic_name: Joi.string().allow('', null),
    dosage: Joi.string().allow('', null),
    frequency: Joi.string().allow('', null),
    duration: Joi.string().allow('', null),
    timing: Joi.alternatives().try(
      Joi.string().allow('', null),
      Joi.object({
        type: Joi.string().required(),
        time: Joi.string().allow(null)
      })
    ).optional(),
    quantity: Joi.number().allow(0, null),
    instructions: Joi.string().allow('', null),
    remarks: Joi.string().allow('', null),
    is_tapering: Joi.number().integer().valid(0, 1).allow(null),
    tapering_schedule: Joi.array().items(Joi.object({
      step_number: Joi.number().integer(),
      dose: Joi.string().allow('', null),
      frequency: Joi.string().allow('', null),
      duration_days: Joi.number().integer().allow(null)
    })).optional()
  })).min(0).optional().default([])
});

const updatePrescription = Joi.object({
  appointment_id: Joi.number().integer().positive().allow(null),
  prescription_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  diagnosis: Joi.string().allow('', null),
  symptoms: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  follow_up_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
  is_template: Joi.boolean().optional(),
  template_name: Joi.string().allow('', null),
  items: Joi.array().items(Joi.object({
    id: Joi.number().integer().positive().allow(null),
    medicine_id: Joi.number().integer().positive().allow(null),
    medicine_name: Joi.string().max(255).optional(),
    dosage: Joi.string().allow('', null),
    frequency: Joi.string().allow('', null),
    duration: Joi.string().allow('', null),
    quantity: Joi.number().integer().min(0).allow(null),
    instructions: Joi.string().allow('', null),
    item_type: Joi.string().valid('medication','injection','ivf').optional(),
    generic_name: Joi.string().allow('', null),
    route: Joi.string().allow('', null),
    infusion_rate: Joi.string().allow('', null),
    timing: Joi.alternatives().try(
      Joi.string().allow('', null),
      Joi.object({
        type: Joi.string().required(),
        time: Joi.string().allow(null)
      })
    ).optional(),
    special_instructions: Joi.string().allow('', null)
  })).optional()
});

const saveDiagnoses = Joi.object({
  diagnoses: Joi.array().items(Joi.object({
    icd_code: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    icd_title: Joi.string().required(),
    code: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    title: Joi.string().optional()
  })).min(1).required()
});

module.exports = { createPrescription, updatePrescription, saveDiagnoses };
