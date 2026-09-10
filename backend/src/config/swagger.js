const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Patient Management System API',
      version: '1.0.0',
      description: 'Complete API documentation for the Patient Management System with SNOMED CT integration and medication safety validation',
      contact: {
        name: 'Development Team',
        email: 'support@patientmanagement.local',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development Server',
      },
      {
        url: 'https://api.patientmanagement.com',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for authentication',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token required for POST/PUT/PATCH requests',
        },
      },
      schemas: {
        // Error Response
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Unauthorized',
            },
            message: {
              type: 'string',
              example: 'Invalid or expired token',
            },
            statusCode: {
              type: 'integer',
              example: 401,
            },
          },
        },

        // Patient
        Patient: {
          type: 'object',
          properties: {
            patient_id: {
              type: 'integer',
              example: 1,
            },
            patient_mrn: {
              type: 'string',
              example: 'PAT-2024-001',
              description: 'Medical Record Number',
            },
            patient_name: {
              type: 'string',
              example: 'John Doe',
            },
            age: {
              type: 'integer',
              example: 35,
            },
            gender: {
              type: 'string',
              enum: ['M', 'F', 'Other'],
              example: 'M',
            },
            weight_kg: {
              type: 'number',
              example: 75.5,
            },
            phone: {
              type: 'string',
              example: '+91-9876543210',
            },
            email: {
              type: 'string',
              example: 'john@example.com',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
          },
          required: ['patient_mrn', 'patient_name', 'age', 'gender'],
        },

        // Medication
        Medication: {
          type: 'object',
          properties: {
            medication_id: {
              type: 'integer',
              example: 1,
            },
            snomed_code: {
              type: 'string',
              example: '15517011000001104',
              description: 'SNOMED CT code for medication',
            },
            medication_name: {
              type: 'string',
              example: 'Paracetamol',
            },
            strength: {
              type: 'string',
              example: '500 mg',
            },
            form: {
              type: 'string',
              example: 'Tablet',
              enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Other'],
            },
            manufacturer: {
              type: 'string',
              example: 'Cipla Ltd',
            },
            active_ingredient: {
              type: 'string',
              example: 'Paracetamol',
            },
            iupac_name: {
              type: 'string',
              example: 'N-(4-hydroxyphenyl)acetamide',
            },
            max_daily_dose_mg: {
              type: 'number',
              example: 4000,
              description: 'Maximum safe daily dose in milligrams',
            },
            min_age_months: {
              type: 'integer',
              example: 6,
              description: 'Minimum age for usage in months',
            },
            contraindications: {
              type: 'array',
              items: { type: 'string' },
              example: ['Liver disease', 'Kidney disease'],
            },
            side_effects: {
              type: 'array',
              items: { type: 'string' },
              example: ['Nausea', 'Dizziness', 'Rash'],
            },
          },
          required: ['snomed_code', 'medication_name', 'strength', 'form'],
        },

        // Prescription
        Prescription: {
          type: 'object',
          properties: {
            prescription_id: {
              type: 'integer',
              example: 1,
            },
            patient_id: {
              type: 'integer',
              example: 1,
            },
            doctor_id: {
              type: 'integer',
              example: 2,
            },
            medication_id: {
              type: 'integer',
              example: 1,
            },
            dosage_mg: {
              type: 'number',
              example: 500,
              description: 'Dose in milligrams',
            },
            frequency: {
              type: 'string',
              example: 'Twice daily',
              enum: ['Once daily', 'Twice daily', 'Thrice daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'As needed'],
            },
            duration_days: {
              type: 'integer',
              example: 7,
              description: 'Duration of medication in days',
            },
            instructions: {
              type: 'string',
              example: 'Take with food and water',
            },
            is_scheduled: {
              type: 'boolean',
              example: true,
              description: 'Whether prescription is marked for later scheduling',
            },
            status: {
              type: 'string',
              example: 'active',
              enum: ['active', 'inactive', 'completed', 'cancelled'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T11:00:00Z',
            },
          },
          required: ['patient_id', 'doctor_id', 'medication_id', 'dosage_mg', 'frequency', 'duration_days'],
        },

        // Doctor/User
        User: {
          type: 'object',
          properties: {
            user_id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'dr_smith',
            },
            email: {
              type: 'string',
              example: 'dr.smith@hospital.com',
            },
            role: {
              type: 'string',
              example: 'doctor',
              enum: ['doctor', 'nurse', 'admin', 'pharmacist'],
            },
            specialization: {
              type: 'string',
              example: 'General Medicine',
            },
            hospital: {
              type: 'string',
              example: 'City Hospital',
            },
            is_active: {
              type: 'boolean',
              example: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
          },
          required: ['username', 'email', 'role'],
        },

        // Queue/Appointment
        QueueEntry: {
          type: 'object',
          properties: {
            queue_id: {
              type: 'integer',
              example: 1,
            },
            patient_id: {
              type: 'integer',
              example: 1,
            },
            doctor_id: {
              type: 'integer',
              example: 2,
            },
            status: {
              type: 'string',
              example: 'waiting',
              enum: ['waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'],
            },
            position: {
              type: 'integer',
              example: 5,
              description: 'Current position in queue',
            },
            entered_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
            estimated_wait_time_minutes: {
              type: 'integer',
              example: 15,
            },
            consultation_notes: {
              type: 'string',
              example: 'Patient presenting with fever and cough',
            },
          },
          required: ['patient_id', 'doctor_id'],
        },

        // Login Request
        LoginRequest: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              example: 'dr_smith',
            },
            password: {
              type: 'string',
              example: 'SecurePassword123!',
              format: 'password',
            },
          },
          required: ['username', 'password'],
        },

        // Login Response
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT Bearer token for authentication',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
            expires_in: {
              type: 'integer',
              example: 86400,
              description: 'Token expiration time in seconds (24 hours)',
            },
          },
        },

        // CSRF Token Response
        CSRFTokenResponse: {
          type: 'object',
          properties: {
            csrfToken: {
              type: 'string',
              example: 'ABC123XYZ789',
              description: 'CSRF token for POST/PUT/PATCH requests',
            },
          },
        },

        // Dose Validation Response
        DoseValidationResponse: {
          type: 'object',
          properties: {
            valid: {
              type: 'boolean',
              example: true,
              description: 'Whether the dose is safe',
            },
            warnings: {
              type: 'array',
              items: { type: 'string' },
              example: ['High dose for pediatric patient'],
            },
            errors: {
              type: 'array',
              items: { type: 'string' },
              example: ['Dose exceeds maximum daily limit'],
            },
            details: {
              type: 'object',
              properties: {
                medication_name: { type: 'string' },
                dosage_mg: { type: 'number' },
                max_daily_dose_mg: { type: 'number' },
                frequency: { type: 'string' },
                duration_days: { type: 'integer' },
                patient_age: { type: 'integer' },
                patient_weight_kg: { type: 'number' },
              },
            },
          },
        },

        // Medication Search Response
        MedicationSearchResponse: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              example: 15,
              description: 'Total medications matching search',
            },
            medications: {
              type: 'array',
              items: { $ref: '#/components/schemas/Medication' },
            },
            search_query: {
              type: 'string',
              example: 'paracetamol',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'], // This will be populated with JSDoc comments from route files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
