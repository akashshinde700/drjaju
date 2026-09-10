const Joi = require('joi');

// ---------- Users (admin) ----------
const createUser = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('admin','doctor','staff','sub_admin').required(),
  clinic_id: Joi.number().integer().positive().allow(null)
});
const updateUser = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).max(128).optional(),
  role: Joi.string().valid('admin','doctor','staff','sub_admin').optional(),
  clinic_id: Joi.number().integer().positive().allow(null)
});

// ---------- Clinics ----------
const updateClinic = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  address: Joi.string().allow('', null),
  phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  email: Joi.string().email().allow('', null),
  abha_hfr_id: Joi.string().allow('', null),
  abdm_facility_id: Joi.string().allow('', null),
  abdm_hip_id: Joi.string().allow('', null)
});

// ---------- Doctors ----------
const createDoctor = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  specialization: Joi.string().allow('', null),
  phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  email: Joi.string().email().allow('', null),
  clinic_id: Joi.number().integer().positive().required()
});
const updateDoctor = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  specialization: Joi.string().allow('', null),
  phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  email: Joi.string().email().allow('', null),
  clinic_id: Joi.number().integer().positive().optional()
});

// ---------- Doctor Availability / Time Slots ----------
const createAvailability = Joi.object({
  slot_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required()
});
const updateAvailability = Joi.object({
  availability: Joi.array().items(
    Joi.object({
      day_of_week: Joi.number().integer().min(0).max(6).required(),
      is_available: Joi.boolean().required()
    })
  ).required()
});

// ---------- Appointment Intents ----------
const createAppointmentIntent = Joi.object({
  // Accept both field names for compatibility
  name: Joi.string().min(1).max(255),
  full_name: Joi.string().min(1).max(255),
  phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).required().messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  email: Joi.string().email().allow('', null),
  // Accept both date field names
  desired_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  preferred_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  // Accept both time field names
  desired_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).allow('', null),
  preferred_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).allow('', null),
  speciality: Joi.string().allow('', null),
  doctor_id: Joi.number().integer().positive().allow(null),
  message: Joi.string().allow('', null),
  auto_create: Joi.boolean().default(false),
  // Consultation type fields - online/offline/walk-in
  arrival_type: Joi.string().valid('online', 'offline', 'walk-in', 'scheduled').allow('', null),
  appointment_type: Joi.string().valid('online', 'offline', 'walk-in', 'scheduled').allow('', null)
}).or('name', 'full_name'); // At least one name field required

// ---------- Queue ----------
const createQueueEntry = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().required(),
  clinic_id: Joi.number().integer().positive().required(),
  appointment_id: Joi.number().integer().positive().allow(null),
  status: Joi.string().valid('waiting','in-progress','in_progress','completed','skipped','cancelled').default('waiting'),
  priority: Joi.number().integer().min(0).max(5).default(0),
  notes: Joi.string().max(500).allow('', null)
});
const updateQueueEntry = Joi.object({
  // Mirrors the queue.status DB enum ('waiting','called','in_progress','completed',
  // 'cancelled','no-show','skipped'). 'no-show' and 'called' were missing here,
  // so marking a walk-in as No Show from the Queue dashboard failed with a 400.
  status: Joi.string().valid('waiting','called','in-progress','in_progress','completed','skipped','cancelled','no-show').optional(),
  priority: Joi.number().integer().min(0).max(5).optional()
});

// ---------- Bills / Payments ----------
const createBill = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  clinic_id: Joi.number().integer().positive().allow(null),
  appointment_id: Joi.number().integer().positive().allow(null),
  template_id: Joi.number().integer().positive().allow(null),
  bill_number: Joi.string().max(50).allow('', null),
  bill_date: Joi.date().allow(null),
  due_date: Joi.date().allow(null),
  subtotal: Joi.number().precision(2).allow(null),
  amount: Joi.number().precision(2).allow(null),
  tax: Joi.number().precision(2).allow(null),
  tax_percent: Joi.number().precision(2).allow(null),
  tax_amount: Joi.number().precision(2).allow(null),
  discount: Joi.number().precision(2).allow(null),
  discount_percent: Joi.number().precision(2).allow(null),
  discount_amount: Joi.number().precision(2).allow(null),
  additional_discount: Joi.number().precision(2).allow(null),
  total_amount: Joi.number().precision(2).allow(null),
  amount_paid: Joi.number().precision(2).allow(null),
  balance_due: Joi.number().precision(2).allow(null),
  payment_method: Joi.string().allow('', null),
  payment_reference: Joi.string().allow('', null),
  payment_id: Joi.string().allow('', null),
  payment_status: Joi.string().allow('', null),
  status: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  remarks: Joi.string().allow('', null),
  items: Joi.array().optional(),
  service_items: Joi.array().optional()
});
const updateBill = Joi.object({
  doctor_id: Joi.number().integer().positive().allow(null),
  clinic_id: Joi.number().integer().positive().allow(null),
  template_id: Joi.number().integer().positive().allow(null),
  bill_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: Joi.date().allow(null),
  subtotal: Joi.number().precision(2).allow(null),
  amount: Joi.number().precision(2).allow(null),
  tax: Joi.number().precision(2).allow(null),
  tax_percent: Joi.number().precision(2).allow(null),
  tax_amount: Joi.number().precision(2).allow(null),
  discount: Joi.number().precision(2).allow(null),
  discount_percent: Joi.number().precision(2).allow(null),
  discount_amount: Joi.number().precision(2).allow(null),
  additional_discount: Joi.number().precision(2).allow(null),
  total_amount: Joi.number().precision(2).allow(null),
  amount_paid: Joi.number().precision(2).allow(null),
  balance_due: Joi.number().precision(2).allow(null),
  payment_method: Joi.string().allow('', null),
  payment_reference: Joi.string().allow('', null),
  payment_id: Joi.string().allow('', null),
  payment_status: Joi.string().allow('', null),
  status: Joi.string().valid('draft','issued','paid','cancelled','refunded','partially_paid').optional(),
  notes: Joi.string().allow('', null),
  remarks: Joi.string().allow('', null),
  items: Joi.array().optional(),
  service_items: Joi.array().optional()
});
const addPayment = Joi.object({
  bill_id: Joi.number().integer().positive().required(),
  amount: Joi.number().precision(2).min(0.01).required(),
  method: Joi.string().valid('cash','card','upi','bank_transfer','wallet','insurance').required(),
  reference_no: Joi.string().allow('', null),
  payment_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
});
const updatePayment = Joi.object({
  amount: Joi.number().precision(2).min(0.01).optional(),
  method: Joi.string().valid('cash','card','upi','bank_transfer','wallet','insurance').optional(),
  reference_no: Joi.string().allow('', null),
  payment_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: Joi.string().valid('pending','completed','failed','cancelled','refunded','partial').optional()
});

const updateBillStatus = Joi.object({
  payment_status: Joi.string().valid('pending', 'paid', 'partial', 'cancelled', 'refunded', 'completed').optional(),
  amount_paid: Joi.number().precision(2).min(0).optional(),
  payment_method: Joi.string().allow('', null).optional(),
  payment_reference: Joi.string().allow('', null).optional()
}).or('payment_status', 'amount_paid', 'payment_method', 'payment_reference');

const updateBillPayment = Joi.object({
  amount: Joi.number().precision(2).min(0.01).optional(),
  paid_amount: Joi.number().precision(2).min(0).optional(),
  payment_status: Joi.string().valid('pending', 'paid', 'partial').optional()
}).or('amount', 'paid_amount');

// ---------- Labs ----------
const createLabTemplate = Joi.object({
  template_name: Joi.string().max(255).required(),
  category: Joi.string().allow('', null),
  parameters: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    unit: Joi.string().allow('', null),
    reference_range: Joi.string().allow('', null)
  })).optional()
});
const updateLabTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  category: Joi.string().allow('', null),
  parameters: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    unit: Joi.string().allow('', null),
    reference_range: Joi.string().allow('', null)
  })).optional()
});
const createInvestigation = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  test_name: Joi.string().max(255).required(),
  ordered_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  status: Joi.string().valid('ordered','in-progress','completed','cancelled').default('ordered'),
  result: Joi.string().allow('', null)
});
const updateInvestigation = Joi.object({
  test_name: Joi.string().max(255).optional(),
  ordered_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: Joi.string().valid('ordered','in-progress','completed','cancelled').optional(),
  result: Joi.string().allow('', null)
});

// ---------- Templates (Prescription/Diagnosis/Medications/Symptoms/Injection) ----------
const createPrescriptionTemplate = Joi.object({
  template_name: Joi.string().max(255).required(),
  name: Joi.string().max(255).allow('', null),
  short_name: Joi.string().max(50).allow('', null),
  category: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  symptoms: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  diagnosis: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  diagnoses: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  medications: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  investigations: Joi.string().allow('', null),
  precautions: Joi.string().allow('', null),
  diet_restrictions: Joi.string().allow('', null),
  activities: Joi.string().allow('', null),
  advice: Joi.string().allow('', null),
  follow_up_days: Joi.number().integer().allow(null),
  duration_days: Joi.number().integer().allow(null),
  is_active: Joi.number().integer().allow(null),
  created_by: Joi.number().integer().allow(null),
  items: Joi.array().items(Joi.object({
    medicine_name: Joi.string().max(255).required(),
    dosage: Joi.string().allow('', null),
    frequency: Joi.string().allow('', null),
    duration: Joi.string().allow('', null),
    instructions: Joi.string().allow('', null)
  })).optional()
});
const updatePrescriptionTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  name: Joi.string().max(255).allow('', null),
  short_name: Joi.string().max(50).allow('', null),
  category: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  symptoms: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  diagnosis: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  diagnoses: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  medications: Joi.alternatives().try(Joi.string(), Joi.array()).allow('', null),
  investigations: Joi.string().allow('', null),
  precautions: Joi.string().allow('', null),
  diet_restrictions: Joi.string().allow('', null),
  activities: Joi.string().allow('', null),
  advice: Joi.string().allow('', null),
  follow_up_days: Joi.number().integer().allow(null),
  duration_days: Joi.number().integer().allow(null),
  is_active: Joi.number().integer().allow(null),
  items: Joi.array().items(Joi.object({
    medicine_name: Joi.string().max(255).required(),
    dosage: Joi.string().allow('', null),
    frequency: Joi.string().allow('', null),
    duration: Joi.string().allow('', null),
    instructions: Joi.string().allow('', null)
  })).optional()
});

const createDiagnosisTemplate = Joi.object({
  name: Joi.string().max(255).optional(),
  template_name: Joi.string().max(255).optional(),
  category: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  diagnoses: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  diagnosis: Joi.string().allow('', null)
}).or('name', 'template_name');
const updateDiagnosisTemplate = Joi.object({
  name: Joi.string().max(255).optional(),
  template_name: Joi.string().max(255).optional(),
  category: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  diagnoses: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  diagnosis: Joi.string().allow('', null)
});

const createMedicationsTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  name: Joi.string().max(255).optional(),
  category: Joi.string().max(100).allow('', null),
  description: Joi.string().allow('', null),
  items: Joi.array().items(Joi.object({
    medicine_name: Joi.string().max(255).optional(),
    name: Joi.string().max(255).optional(),
    brand: Joi.string().max(255).allow('', null),
    composition: Joi.string().allow('', null),
    dosage: Joi.string().allow('', null),
    frequency: Joi.string().allow('', null),
    timing: Joi.string().allow('', null).optional(),
    duration: Joi.string().allow('', null),
    qty: Joi.number().allow(null),
    instructions: Joi.string().allow('', null)
  })).optional(),
  medications: Joi.any().optional()
}).or('template_name', 'name');

const updateMedicationsTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  name: Joi.string().max(255).optional(),
  category: Joi.string().max(100).allow('', null),
  description: Joi.string().allow('', null),
  items: Joi.array().items(Joi.object({
    medicine_name: Joi.string().max(255).optional(),
    name: Joi.string().max(255).optional(),
    brand: Joi.string().max(255).allow('', null),
    composition: Joi.string().allow('', null),
    dosage: Joi.string().allow('', null),
    dosage_form: Joi.string().allow('', null),
    strength: Joi.string().allow('', null),
    frequency: Joi.string().allow('', null),
    timing: Joi.alternatives().try(Joi.string(), Joi.object()).allow('', null).optional(),
    duration: Joi.string().allow('', null),
    qty: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
    instructions: Joi.string().allow('', null),
    is_tapering: Joi.boolean().optional(),
    tapering_schedule: Joi.array().items(Joi.object({
      step_number: Joi.number().optional(),
      dose: Joi.string().allow('', null),
      frequency: Joi.string().allow('', null),
      duration_days: Joi.number().optional()
    })).optional()
  })).optional(),
  medications: Joi.any().optional()
});

const createSymptomsTemplate = Joi.object({
  name: Joi.string().max(255).optional(),
  template_name: Joi.string().max(255).optional(),
  description: Joi.string().allow('', null),
  category: Joi.string().allow('', null),
  symptoms: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow('', null)
}).or('name', 'template_name');
const updateSymptomsTemplate = Joi.object({
  name: Joi.string().max(255).optional(),
  template_name: Joi.string().max(255).optional(),
  description: Joi.string().allow('', null),
  category: Joi.string().allow('', null),
  symptoms: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow('', null)
});

const createInjectionTemplate = Joi.object({
  template_name: Joi.string().max(255).required(),
  injection_name: Joi.string().max(255).required(),
  generic_name: Joi.string().allow('', null),
  dose: Joi.string().allow('', null),
  route: Joi.string().allow('', null),
  infusion_rate: Joi.string().allow('', null),
  frequency: Joi.string().allow('', null),
  duration: Joi.string().allow('', null),
  timing: Joi.string().allow('', null).optional(),
  instructions: Joi.string().allow('', null)
});
const updateInjectionTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  injection_name: Joi.string().max(255).optional(),
  generic_name: Joi.string().allow('', null),
  dose: Joi.string().allow('', null),
  route: Joi.string().allow('', null),
  infusion_rate: Joi.string().allow('', null),
  frequency: Joi.string().allow('', null),
  duration: Joi.string().allow('', null),
  timing: Joi.string().allow('', null).optional(),
  instructions: Joi.string().allow('', null)
});

// ---------- Receipt Templates ----------
const createReceiptTemplate = Joi.object({
  template_name: Joi.string().max(255).required(),
  clinic_id: Joi.number().integer().positive().allow(null),
  html_content: Joi.string().allow('', null),
  header_content: Joi.string().allow('', null),
  footer_content: Joi.string().allow('', null),
  header_image: Joi.string().allow('', null),
  footer_image: Joi.string().allow('', null),
  is_default: Joi.boolean().default(false)
});
const updateReceiptTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  clinic_id: Joi.number().integer().positive().allow(null),
  html_content: Joi.string().allow('', null),
  header_content: Joi.string().allow('', null),
  footer_content: Joi.string().allow('', null),
  header_image: Joi.string().allow('', null),
  footer_image: Joi.string().allow('', null),
  is_default: Joi.boolean().optional()
});

// ---------- Medical Certificates ----------
const createMedicalCertificate = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_name: Joi.string().max(255).required(),
  doctor_registration_no: Joi.string().max(255).allow('', null),
  doctor_qualification: Joi.string().max(255).allow('', null),
  type_id: Joi.number().integer().positive().required(),
  certificate_title: Joi.string().max(255).required(),
  diagnosis: Joi.string().allow('', null),
  certificate_content: Joi.string().allow('', null),
  issued_date: Joi.date().required(),
  valid_from: Joi.date().allow('', null),
  valid_until: Joi.date().allow('', null),
  resume_date: Joi.date().allow('', null),
  notes: Joi.string().allow('', null),
  header_image: Joi.string().allow('', null),
  footer_image: Joi.string().allow('', null),
  clinic_id: Joi.number().integer().positive().allow(null)
});
const updateMedicalCertificate = Joi.object({
  doctor_name: Joi.string().max(255).optional(),
  doctor_registration_no: Joi.string().max(255).allow('', null),
  doctor_qualification: Joi.string().max(255).allow('', null),
  type_id: Joi.number().integer().positive().optional(),
  certificate_title: Joi.string().max(255).optional(),
  diagnosis: Joi.string().allow('', null),
  certificate_content: Joi.string().allow('', null).optional(),
  issued_date: Joi.date().optional(),
  valid_from: Joi.date().allow('', null),
  valid_until: Joi.date().allow('', null),
  resume_date: Joi.date().allow('', null),
  notes: Joi.string().allow('', null),
  header_image: Joi.string().allow('', null),
  footer_image: Joi.string().allow('', null),
  clinic_id: Joi.number().integer().positive().allow(null)
});

// ---------- Certificate Templates ----------
const createCertificateTemplate = Joi.object({
  template_name: Joi.string().max(255).required(),
  type_id: Joi.number().integer().positive().required(),
  template_content: Joi.string().required(),
  header_image: Joi.string().allow('', null),
  footer_image: Joi.string().allow('', null),
  clinic_id: Joi.number().integer().positive().allow(null),
  is_default: Joi.boolean().optional()
});
const updateCertificateTemplate = Joi.object({
  template_name: Joi.string().max(255).optional(),
  type_id: Joi.number().integer().positive().optional(),
  template_content: Joi.string().optional(),
  header_image: Joi.string().allow('', null),
  footer_image: Joi.string().allow('', null),
  is_default: Joi.boolean().optional(),
  clinic_id: Joi.number().integer().positive().allow(null)
});

// ---------- Insurance ----------
const createInsurancePolicy = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  provider: Joi.string().max(255).required(),
  policy_number: Joi.string().max(255).required(),
  coverage_details: Joi.string().allow('', null),
  start_date: Joi.date().allow(null),
  end_date: Joi.date().allow(null)
});
const updateInsurancePolicy = Joi.object({
  provider: Joi.string().max(255).optional(),
  policy_number: Joi.string().max(255).optional(),
  coverage_details: Joi.string().allow('', null),
  start_date: Joi.date().allow(null),
  end_date: Joi.date().allow(null)
});

// ---------- VIP Patients ----------
const createVipPatient = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  priority_level: Joi.number().integer().min(1).max(5).default(1),
  dedicated_contact_person: Joi.string().allow('', null),
  dedicated_contact_phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  preferred_doctor_id: Joi.number().integer().positive().allow(null),
  preferred_appointment_time: Joi.string().allow('', null),
  communication_preference: Joi.string().valid('phone','email','sms','whatsapp').allow(null),
  billing_type: Joi.string().valid('cash','credit','corporate').allow(null),
  corporate_name: Joi.string().allow('', null),
  allow_anonymous_queue: Joi.boolean().optional()
});
const updateVipPatient = Joi.object({
  priority_level: Joi.number().integer().min(1).max(5).optional(),
  dedicated_contact_person: Joi.string().allow('', null),
  dedicated_contact_phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  preferred_doctor_id: Joi.number().integer().positive().allow(null),
  preferred_appointment_time: Joi.string().allow('', null),
  communication_preference: Joi.string().valid('phone','email','sms','whatsapp').allow(null),
  billing_type: Joi.string().valid('cash','credit','corporate').allow(null),
  corporate_name: Joi.string().allow('', null),
  allow_anonymous_queue: Joi.boolean().optional()
});

// ---------- Patient Referrals ----------
const createPatientReferral = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  referred_to_doctor_id: Joi.number().integer().positive().allow(null),
  referred_doctor_name: Joi.string().max(255).allow('', null),
  referred_doctor_phone: Joi.string().max(20).allow('', null),
  referred_doctor_email: Joi.string().email().allow('', null),
  referred_doctor_specialization: Joi.string().max(255).allow('', null),
  hospital_name: Joi.string().max(255).allow('', null),
  referral_date: Joi.date().required(),
  referral_time: Joi.string().allow('', null),
  reason: Joi.string().allow('', null),
  priority: Joi.string().valid('routine', 'urgent').default('routine'),
  notes: Joi.string().allow('', null)
});
const updatePatientReferral = Joi.object({
  referred_doctor_name: Joi.string().max(255).optional(),
  referred_doctor_phone: Joi.string().max(20).allow('', null),
  referred_doctor_email: Joi.string().email().allow('', null),
  referred_doctor_specialization: Joi.string().max(255).allow('', null),
  hospital_name: Joi.string().max(255).allow('', null),
  referral_date: Joi.date().optional(),
  referral_time: Joi.string().allow('', null),
  reason: Joi.string().allow('', null),
  priority: Joi.string().valid('routine', 'urgent').optional(),
  status: Joi.string().valid('pending', 'accepted', 'declined', 'completed').optional(),
  notes: Joi.string().allow('', null),
  outcome: Joi.string().allow('', null)
});

// ---------- Subscriptions ----------
const createSubscriptionPackage = Joi.object({
  package_name: Joi.string().max(255).required(),
  description: Joi.string().allow('', null),
  total_sessions: Joi.number().integer().min(1).required(),
  validity_days: Joi.number().integer().min(1).allow(null),
  price: Joi.number().precision(2).min(0).required()
});
const updateSubscriptionPackage = Joi.object({
  package_name: Joi.string().max(255).optional(),
  description: Joi.string().allow('', null),
  total_sessions: Joi.number().integer().min(1).optional(),
  validity_days: Joi.number().integer().min(1).allow(null),
  price: Joi.number().precision(2).min(0).optional()
});

// ---------- Search ----------
const searchQuery = Joi.object({
  q: Joi.string().min(1).max(255).required(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

// ---------- Notifications ----------
const createNotification = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  title: Joi.string().max(255).required(),
  message: Joi.string().required(),
  type: Joi.string().valid('info','warning','error','success').default('info')
});
const updateNotification = Joi.object({
  title: Joi.string().max(255).optional(),
  message: Joi.string().optional(),
  type: Joi.string().valid('info','warning','error','success').optional(),
  is_read: Joi.boolean().optional()
});

// ---------- PDF ----------
const generatePdf = Joi.object({
  template: Joi.string().max(255).required(),
  data: Joi.object().required()
});

// ---------- Family History ----------
const createFamilyHistory = Joi.object({
  relation: Joi.string().max(255).required(),
  condition: Joi.string().allow('', null).optional(),
  condition_name: Joi.string().allow('', null).optional(),
  medical_condition: Joi.string().allow('', null).optional(), // Support alternative field name
  icd_code: Joi.string().max(20).allow('', null),
  notes: Joi.string().allow('', null)
}); // Controller validates that at least one condition field has value
const updateFamilyHistory = Joi.object({
  relation: Joi.string().max(255).optional(),
  condition: Joi.string().optional(),
  condition_name: Joi.string().optional(),
  icd_code: Joi.string().max(20).allow('', null),
  notes: Joi.string().allow('', null)
});

// ---------- Patient Data (Vitals) ----------
const addVitals = Joi.object({
  temp: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  temperature: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  height: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  height_cm: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  weight: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  weight_kg: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  pulse: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  spo2: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  blood_pressure: Joi.string().allow('', null),
  bp_systolic: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  bp_diastolic: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  bmi: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ''),
  respiratory_rate: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '')
}).unknown(true); // Allow any field - controller handles validation

// ---------- Patient Data (Lab Records) ----------
const addLabRecord = Joi.object({
  name: Joi.string().max(255).required(),
  reading: Joi.string().max(255).required(),
  date: Joi.date().allow(null),
  unit: Joi.string().max(50).allow('', null),
  notes: Joi.string().allow('', null)
});

// ---------- Specialty - Cardiology ----------
const createCardiologyAssessment = Joi.object({
  prescription_id: Joi.number().integer().positive().allow(null),
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  bloodPressure: Joi.object({
    systolic: Joi.number().integer().min(0).max(300).allow(null),
    diastolic: Joi.number().integer().min(0).max(200).allow(null)
  }).allow(null),
  heartRate: Joi.number().integer().min(0).max(300).allow(null),
  ejectionFraction: Joi.number().precision(1).min(0).max(100).allow(null),
  cholesterol: Joi.object({
    total: Joi.number().precision(1).allow(null),
    ldl: Joi.number().precision(1).allow(null),
    hdl: Joi.number().precision(1).allow(null),
    triglycerides: Joi.number().precision(1).allow(null)
  }).allow(null),
  nyhaClass: Joi.string().valid('I', 'II', 'III', 'IV').allow('', null),
  symptoms: Joi.string().allow('', null),
  riskFactors: Joi.string().allow('', null),
  medications: Joi.string().allow('', null),
  ecg: Joi.string().allow('', null),
  echo: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});
const updateCardiologyAssessment = Joi.object({
  bloodPressure: Joi.object({
    systolic: Joi.number().integer().min(0).max(300).allow(null),
    diastolic: Joi.number().integer().min(0).max(200).allow(null)
  }).allow(null),
  heartRate: Joi.number().integer().min(0).max(300).allow(null),
  ejectionFraction: Joi.number().precision(1).min(0).max(100).allow(null),
  cholesterol: Joi.object({
    total: Joi.number().precision(1).allow(null),
    ldl: Joi.number().precision(1).allow(null),
    hdl: Joi.number().precision(1).allow(null),
    triglycerides: Joi.number().precision(1).allow(null)
  }).allow(null),
  nyhaClass: Joi.string().valid('I', 'II', 'III', 'IV').allow('', null),
  symptoms: Joi.string().allow('', null),
  riskFactors: Joi.string().allow('', null),
  medications: Joi.string().allow('', null),
  ecg: Joi.string().allow('', null),
  echo: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

// ---------- Specialty - Pediatrics ----------
const createPediatricAssessment = Joi.object({
  prescription_id: Joi.number().integer().positive().allow(null),
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  birthWeight: Joi.number().precision(2).min(0).allow(null),
  currentWeight: Joi.number().precision(2).min(0).allow(null),
  height: Joi.number().precision(1).min(0).allow(null),
  headCircumference: Joi.number().precision(1).min(0).allow(null),
  developmentalMilestones: Joi.string().allow('', null),
  vaccinationStatus: Joi.string().allow('', null),
  feedingPattern: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});
const updatePediatricAssessment = Joi.object({
  birthWeight: Joi.number().precision(2).min(0).allow(null),
  currentWeight: Joi.number().precision(2).min(0).allow(null),
  height: Joi.number().precision(1).min(0).allow(null),
  headCircumference: Joi.number().precision(1).min(0).allow(null),
  developmentalMilestones: Joi.string().allow('', null),
  vaccinationStatus: Joi.string().allow('', null),
  feedingPattern: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

// ---------- Specialty - Orthopedics ----------
const createOrthopedicAssessment = Joi.object({
  prescription_id: Joi.number().integer().positive().allow(null),
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  chiefComplaint: Joi.string().allow('', null),
  injuryMechanism: Joi.string().allow('', null),
  rangeOfMotion: Joi.string().allow('', null),
  muscleStrength: Joi.string().allow('', null),
  specialTests: Joi.string().allow('', null),
  imaging: Joi.string().allow('', null),
  diagnosis: Joi.string().allow('', null),
  treatment: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});
const updateOrthopedicAssessment = Joi.object({
  chiefComplaint: Joi.string().allow('', null),
  injuryMechanism: Joi.string().allow('', null),
  rangeOfMotion: Joi.string().allow('', null),
  muscleStrength: Joi.string().allow('', null),
  specialTests: Joi.string().allow('', null),
  imaging: Joi.string().allow('', null),
  diagnosis: Joi.string().allow('', null),
  treatment: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

// ---------- Specialty - Ophthalmology ----------
const createOphthalmologyAssessment = Joi.object({
  prescription_id: Joi.number().integer().positive().allow(null),
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().allow(null),
  visualAcuity: Joi.object({
    rightEye: Joi.string().allow('', null),
    leftEye: Joi.string().allow('', null)
  }).allow(null),
  refraction: Joi.object({
    rightEye: Joi.string().allow('', null),
    leftEye: Joi.string().allow('', null)
  }).allow(null),
  intraocularpressure: Joi.object({
    rightEye: Joi.number().precision(1).allow(null),
    leftEye: Joi.number().precision(1).allow(null)
  }).allow(null),
  anteriorSegment: Joi.string().allow('', null),
  posteriorSegment: Joi.string().allow('', null),
  diagnosis: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});
const updateOphthalmologyAssessment = Joi.object({
  visualAcuity: Joi.object({
    rightEye: Joi.string().allow('', null),
    leftEye: Joi.string().allow('', null)
  }).allow(null),
  refraction: Joi.object({
    rightEye: Joi.string().allow('', null),
    leftEye: Joi.string().allow('', null)
  }).allow(null),
  intraocularpressure: Joi.object({
    rightEye: Joi.number().precision(1).allow(null),
    leftEye: Joi.number().precision(1).allow(null)
  }).allow(null),
  anteriorSegment: Joi.string().allow('', null),
  posteriorSegment: Joi.string().allow('', null),
  diagnosis: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

// ---------- MyGenie AI ----------
const analyzeSymptoms = Joi.object({
  symptoms: Joi.array().items(Joi.string()).min(1).required(),
  patient_id: Joi.number().integer().positive().allow(null),
  age: Joi.number().integer().min(0).max(150).allow(null),
  gender: Joi.string().valid('male', 'female', 'other').allow('', null),
  medical_history: Joi.array().items(Joi.string()).default([]),
  allergies: Joi.array().items(Joi.string()).default([]),
  language: Joi.string().valid('en', 'hi', 'mr', 'ta', 'te', 'kn', 'bn').default('en')
});
const applySuggestion = Joi.object({
  prescription_id: Joi.number().integer().positive().required()
});

// ---------- ABHA Integration ----------
const initiateAbhaRegistration = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  aadhaar_number: Joi.string().pattern(/^\d{12}$/).required(),
  mobile_number: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  })
});
const verifyAbhaOtp = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  txn_id: Joi.string().required()
});
const initiateAbhaLogin = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  abha_address: Joi.string().required()
});
const unlinkAbha = Joi.object({
  patient_id: Joi.number().integer().positive().required()
});

// ---------- Missing Critical Schemas ----------

// 1. Create Prescription
const createPrescription = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().required(),
  clinic_id: Joi.number().integer().positive().required(),
  chief_complaint: Joi.string().max(500).optional(),
  symptoms: Joi.array().items(Joi.string()).optional(),
  diagnosis: Joi.string().max(500).optional(),
  diagnosis_icd_code: Joi.string().pattern(/^[A-Z]\d{2}(\.\d{1,2})?$/).optional(),
  investigations_advised: Joi.string().optional(),
  advice: Joi.string().optional(),
  follow_up_date: Joi.date().optional(),
  items: Joi.array().items(
    Joi.object({
      medicine_id: Joi.number().integer().positive().optional(),
      medicine_name: Joi.string().max(255).required(),
      dosage: Joi.string().max(120).required(),
      frequency: Joi.string().max(80).required(),
      duration: Joi.string().max(60).required(),
      route: Joi.string().valid('Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation').default('Oral'),
      before_after_food: Joi.string().valid('Before Food', 'After Food', 'With Food', 'Any Time').default('After Food'),
      notes: Joi.string().optional()
    })
  ).required()
});

// 2. Create Patient
const createPatient = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).required().messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  dob: Joi.date().required(),
  gender: Joi.string().valid('M', 'F', 'O', 'U').required(),
  blood_group: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown').optional(),
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  pincode: Joi.string().pattern(/^\d{6}$/).optional(),
  emergency_contact_name: Joi.string().optional(),
  emergency_contact_phone: Joi.string().pattern(/^[+]?[\d\s\-()]{7,15}$/).optional().messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  clinic_id: Joi.number().integer().positive().required()
});

// 3. Create Appointment
const createAppointment = Joi.object({
  patient_id: Joi.number().integer().positive().required(),
  doctor_id: Joi.number().integer().positive().required(),
  clinic_id: Joi.number().integer().positive().required(),
  appointment_date: Joi.date().required(),
  appointment_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
  consultation_type: Joi.string().valid('new', 'followup', 'tele', 'video', 'procedure', 'review').default('new'),
  reason_for_visit: Joi.string().max(500).optional(),
  notes: Joi.string().optional()
});

module.exports = {
  createUser, updateUser,
  updateClinic,
  createDoctor, updateDoctor,
  createAvailability, updateAvailability,
  createAppointmentIntent,
  createQueueEntry, updateQueueEntry,
  createBill, updateBill, addPayment, updatePayment, updateBillStatus, updateBillPayment,
  createLabTemplate, updateLabTemplate, createInvestigation, updateInvestigation,
  createPrescriptionTemplate, updatePrescriptionTemplate,
  createDiagnosisTemplate, updateDiagnosisTemplate,
  createMedicationsTemplate, updateMedicationsTemplate,
  createSymptomsTemplate, updateSymptomsTemplate,
  createInjectionTemplate, updateInjectionTemplate,
  createReceiptTemplate, updateReceiptTemplate,
  createMedicalCertificate, updateMedicalCertificate,
  createInsurancePolicy, updateInsurancePolicy,
  createVipPatient, updateVipPatient,
  createPatientReferral, updatePatientReferral,
  createSubscriptionPackage, updateSubscriptionPackage,
  searchQuery,
  createNotification, updateNotification,
  generatePdf,
  createFamilyHistory, updateFamilyHistory,
  addVitals, addLabRecord,
  createCardiologyAssessment, updateCardiologyAssessment,
  createPediatricAssessment, updatePediatricAssessment,
  createOrthopedicAssessment, updateOrthopedicAssessment,
  createOphthalmologyAssessment, updateOphthalmologyAssessment,
  analyzeSymptoms, applySuggestion,
  initiateAbhaRegistration, verifyAbhaOtp, initiateAbhaLogin, unlinkAbha,
  createPrescription,
  createPatient,
  createAppointment
};
