const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/errorHandler');
const axios = require('axios');
const { getDb } = require('./config/db');
const { authenticateToken, authenticateTokenOrQuery, requireRole } = require('./middleware/auth');
const { performanceMonitor } = require('./middleware/performanceMonitor');
const { requestQueue } = require('./middleware/requestQueue');
const { cacheReferenceData } = require('./middleware/cacheHeaders');
const { etagMiddleware } = require('./middleware/etagMiddleware');
const env = require('./config/env');

// Performance monitoring
const cluster = require('cluster');

const authRoutes = require('./routes/authRoutes');
const otpAuthRoutes = require('./routes/otpAuthRoutes');
const emailRoutes = require('./routes/emailRoutes');
const userRoutes = require('./routes/userRoutes');
const patientRoutes = require('./routes/patientRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const appointmentIntentRoutes = require('./routes/appointmentIntentRoutes');
const diagnosisSuggestionRoutes = require('./routes/diagnosisSuggestionRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const billRoutes = require('./routes/billRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const abhaRoutes = require('./routes/abhaRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const labRoutes = require('./routes/labRoutes');
const customLabTestsRoutes = require('./routes/customLabTestsRoutes');
const patientDataRoutes = require('./routes/patientDataRoutes');
const auditRoutes = require('./routes/auditRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const clinicRoutes = require('./routes/clinicRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const backupRoutes = require('./routes/backupRoutes');
const familyHistoryRoutes = require('./routes/familyHistoryRoutes');
const labTemplateRoutes = require('./routes/labTemplateRoutes');
const labAdviceGroupRoutes = require('./routes/labAdviceGroupRoutes');
const insuranceRoutes = require('./routes/insuranceRoutes');
const searchRoutes = require('./routes/searchRoutes');
const receiptTemplateRoutes = require('./routes/receiptTemplateRoutes');
const servicesRoutes = require('./routes/servicesRoutes');
const medicalCertificateRoutes = require('./routes/medicalCertificateRoutes');
const enhancedAnalyticsRoutes = require('./routes/enhancedAnalyticsRoutes');
const symptomsTemplatesRoutes = require('./routes/symptomsTemplatesRoutes');
const staffBillingRoutes = require('./routes/staffBillingRoutes');
const doctorBillingRoutes = require('./routes/doctorBillingRoutes');
const patientQueueRoutes = require('./routes/patientQueueRoutes');
const prescriptionTemplatesRoutes = require('./routes/prescriptionTemplatesRoutes');
const doctorAvailabilityRoutes = require('./routes/doctorAvailabilityRoutes');
const symptomMedicationRoutes = require('./routes/symptomMedicationRoutes');
const diagnosisTemplateRoutes = require('./routes/diagnosisTemplateRoutes');
const medicationsTemplateRoutes = require('./routes/medicationsTemplateRoutes');
const specialtyRoutes = require('./routes/specialtyRoutes');
const vipPatientRoutes = require('./routes/vipPatientRoutes');
const whatsappQRRoutes = require('./routes/whatsappQRRoutes');
const icdRoutes = require('./routes/icdRoutes');
const diagnosisRoutes = require('./routes/diagnosisRoutes');
const symptomsRoutes = require('./routes/symptomsRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const allergiesRoutes = require('./routes/allergiesRoutes');
const adviceRoutes = require('./routes/adviceRoutes');
const vitalsRoutes = require('./routes/vitalsRoutes');
const queueRoutes = require('./routes/queueRoutes');
const clinicalRoutes = require('./routes/clinicalRoutes');
const injectionTemplateRoutes = require('./routes/injectionTemplateRoutes');
const subscriptionPackageRoutes = require('./routes/subscriptionPackageRoutes');
const patientReferralRoutes = require('./routes/patientReferralRoutes');
const pdfGeneratorRoutes = require('./routes/pdfGeneratorRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const myGenieRoutes = require('./routes/myGenieRoutes');
const googleReviewsRoutes = require('./routes/googleReviewsRoutes');
const snomedRoutes = require('./routes/snomedRoutes');
const snomedLocalRoutes = require('./routes/snomedLocalRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const logsRoutes = require('./routes/logsRoutes');
const autoStubRoutes = require('./routes/autoStubRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const medicalRoutes = require('./routes/medicalRoutes');
const smartPrescriptionRoutes = require('./routes/smartPrescriptionRoutes');
const opdRoutes = require('./routes/opdRoutes');
const qrRoutes = require('./routes/qrRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const staffDashboardRoutes = require('./routes/staffDashboardRoutes');
const padConfigurationRoutes = require('./routes/padConfigurationRoutes');
const medicalHistoryRoutes = require('./routes/medicalHistoryRoutes');
const exportRoutes = require('./routes/exportRoutes');
const doctorStaffRoutes = require('./routes/doctorStaffRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
app.set("trust proxy", 1); // Enable trust proxy for nginx reverse proxy

// Security and parsing middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Enforce HSTS in production (requires HTTPS)
if (process.env.NODE_ENV === 'production') {
  app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: true }));
}

// // CORS configuration - more restrictive
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.length)
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : [
          process.env.FRONTEND_URL,
          process.env.CORS_ORIGIN
        ].filter(Boolean);

    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.length === 0) {
        return callback(new Error('CORS not configured'));
      }
      return allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error('Not allowed by CORS'));
    }
    // Development: allow any origin or fallbacks above
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'cache-control'],
  maxAge: 86400 // 24 hours
};



app.use(cors(corsOptions));

// Response compression for faster API responses
app.use(compression());

// Response caching middleware for GET requests (30-second TTL)
const { cacheMiddleware } = require('./middleware/responseCache');
app.use(cacheMiddleware);

// Cookie parser for general use
app.use(cookieParser());

// CSRF Protection removed - csurf package deprecated due to security vulnerabilities

// Simple logging: only method, URL, and status code
app.use(morgan(':method :url :status - :response-time ms'));

// Performance monitoring middleware
app.use(performanceMonitor);

// Request queue middleware for high concurrency (600+ users)
if (env.nodeEnv === 'production' && process.env.ENABLE_REQUEST_QUEUE === 'true') {
  app.use('/api', requestQueue({
    queueType: 'general',
    maxConcurrent: 200,
    timeout: 30000
  }));
  
  app.use('/api/auth', requestQueue({
    queueType: 'auth',
    maxConcurrent: 100,
    timeout: 15000,
    priority: 'high'
  }));
  
  app.use('/api/patients', requestQueue({
    queueType: 'database',
    maxConcurrent: 150,
    timeout: 25000
  }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
const { sanitizeInput } = require('./middleware/validator');
app.use(sanitizeInput);

// Swagger/OpenAPI documentation
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Patient Management API Docs',
  swaggerOptions: {
    deepLinking: true,
  }
}));

// JSON spec endpoint
app.get('/api/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Rate limiting - optimized for high concurrency
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Performance optimizations
    skip: (req) => {
      // Skip rate limiting for health checks only
      return req.path === '/health';
    }
    // Uses default MemoryStore which implements the Store interface
  });
  app.use(limiter);
}

// Serve uploaded files.
// SECURITY FIX (2026-07-11): this was fully public, exposing every patient
// record/document to anyone with the URL (and rate limiting was skipped for it).
// Now requires a JWT via the Authorization header or ?token= query param
// (query form is needed for <img> tags and direct downloads).
app.use('/uploads', authenticateTokenOrQuery, express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/otp-auth', otpAuthRoutes);
app.use('/api/emails', emailRoutes);
// Do NOT enforce admin here — `userRoutes` contains its own per-route role checks
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/appointment-intents', appointmentIntentRoutes);
app.use('/api/diagnosis-suggestion', authenticateToken, diagnosisSuggestionRoutes);
app.use('/api/prescriptions', prescriptionRoutes); // Auth handled inside route file (PDF route is public)
app.use('/api/bills', authenticateToken, billRoutes);
const certificateTypeRoutes = require('./routes/certificateTypeRoutes');
app.use('/api/certificate-types', authenticateToken, certificateTypeRoutes);
app.use('/api/staff-billing', authenticateToken, staffBillingRoutes);
app.use('/api/doctor-billing', authenticateToken, doctorBillingRoutes);
app.use('/api/patient-queue', authenticateToken, patientQueueRoutes);
app.use('/api/services', authenticateToken, servicesRoutes);
app.use('/api/notify', authenticateToken, notificationRoutes);
// Compliance logs
app.use('/api/compliance', authenticateToken, complianceRoutes);
// Mount ABHA routes. In development allow unauthenticated access for smoke-testing.
// (ABHA mounting continues below)
// Mount ABHA routes. In development allow unauthenticated access for smoke-testing.
if (env.nodeEnv === 'development') {
  app.use('/api/abha', abhaRoutes);
} else {
  app.use('/api/abha', authenticateToken, abhaRoutes);
}
app.use('/api/analytics', authenticateToken, requireRole('admin', 'doctor'), analyticsRoutes);
app.use('/api/labs', authenticateToken, labRoutes);
app.use('/api/lab-investigations', authenticateToken, labRoutes); // Alias for frontend compatibility
app.use('/api/custom-lab-tests', authenticateToken, customLabTestsRoutes);
app.use('/api/patient-data', authenticateToken, patientDataRoutes);
app.use('/api/audit', authenticateToken, requireRole('admin'), auditRoutes);
// Public doctor landing page (no auth required)
const { getLandingPageData } = require('./controllers/doctorController');
app.get('/api/doctors/:doctorId/landing', getLandingPageData);
app.use('/api/doctors', authenticateToken, doctorRoutes);
app.use('/api/clinics', authenticateToken, clinicRoutes);
app.use('/api/permissions', authenticateToken, requireRole('admin'), permissionRoutes);
app.use('/api/backup', authenticateTokenOrQuery, requireRole('admin'), backupRoutes);
app.use('/api/family-history', authenticateToken, familyHistoryRoutes);
app.use('/api/lab-templates', authenticateToken, labTemplateRoutes);
app.use('/api/lab-advice-groups', authenticateToken, labAdviceGroupRoutes);
app.use('/api/insurance', authenticateToken, insuranceRoutes);
app.use('/api/search', authenticateToken, searchRoutes);
app.use('/api/receipt-templates', authenticateToken, receiptTemplateRoutes);
app.use('/api/medical-certificates', authenticateToken, medicalCertificateRoutes);
app.use('/api/enhanced-analytics', authenticateToken, requireRole('admin', 'doctor'), enhancedAnalyticsRoutes);
app.use('/api/symptoms-templates', authenticateToken, symptomsTemplatesRoutes);
app.use('/api/prescription-templates', authenticateToken, prescriptionTemplatesRoutes);
app.use('/api/doctor-availability', doctorAvailabilityRoutes);
app.use('/api/symptom-medications', authenticateToken, symptomMedicationRoutes);
app.use('/api/diagnosis-templates', authenticateToken, diagnosisTemplateRoutes);
app.use('/api/medications-templates', authenticateToken, medicationsTemplateRoutes);
app.use('/api/specialty', authenticateToken, specialtyRoutes);
app.use('/api/vip-patients', authenticateToken, vipPatientRoutes);
app.use('/api/whatsapp', authenticateToken, whatsappQRRoutes);
app.use('/api/qr-code', authenticateToken, whatsappQRRoutes);
app.use('/api/icd', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), icdRoutes);
app.use('/api/diagnoses', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), diagnosisRoutes);
app.use('/api/symptoms', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), symptomsRoutes);
app.use('/api/medicines', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), medicineRoutes);
app.use('/api/allergies', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), allergiesRoutes);
app.use('/api/advice', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), adviceRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/suggestions', authenticateToken, suggestionRoutes);
app.use('/api/medical', authenticateToken, medicalRoutes);
app.use('/api/smart-prescription', authenticateToken, smartPrescriptionRoutes);
app.use('/api/opd', authenticateToken, opdRoutes);
app.use('/api/qr', qrRoutes); // Mixed - some public, some protected routes
app.use('/api/queue', authenticateToken, queueRoutes);
app.use('/api/clinical', authenticateToken, clinicalRoutes);
app.use('/api/injection-templates', authenticateToken, injectionTemplateRoutes);
app.use('/api/subscription-packages', authenticateToken, subscriptionPackageRoutes);
app.use('/api/patient-referrals', authenticateToken, patientReferralRoutes);
app.use('/api/pdf', pdfGeneratorRoutes); // Auth handled within routes (bill is public for sharing)
app.use('/api/my-genie', authenticateToken, myGenieRoutes);
app.use('/api/google-reviews', googleReviewsRoutes); // Public endpoint - no auth needed
app.use('/api/snomed', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), snomedRoutes);
app.use('/api/snomed-local', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), snomedLocalRoutes);
app.use('/api/medications', authenticateToken, cacheReferenceData({ maxAge: 600 }), etagMiddleware(), medicationRoutes); // Protected endpoint - authentication required for safety
app.use('/api/logs', logsRoutes); // Logging endpoint - mixed public/protected routes
app.use('/api/staff-dashboard', authenticateToken, staffDashboardRoutes); // Staff dashboard routes
app.use('/api/pad-config', padConfigurationRoutes); // Prescription pad configuration routes
app.use('/api/medical-history', medicalHistoryRoutes); // Patient medical history for prescription pad
app.use('/api/exports', authenticateToken, exportRoutes);
app.use('/api/doctor-staff', authenticateToken, doctorStaffRoutes);
app.use('/api', dashboardRoutes);

// CSRF endpoint removed — csurf deprecated, SameSite=Strict cookies provide protection

// Performance monitoring endpoint
app.get('/api/performance', authenticateToken, requireRole('admin'), async (req, res) => {
  const { getStats } = require('./middleware/performanceMonitor');
  const { getCacheStats } = require('./middleware/cache');
  const { getPoolStats } = require('./config/db');
  const { getQueueStats } = require('./middleware/requestQueue');
  
  const performanceStats = getStats();
  const cacheStats = getCacheStats();
  const poolStats = getPoolStats();
  const queueStats = await getQueueStats();
  
  res.json({
    timestamp: new Date().toISOString(),
    performance: performanceStats,
    cache: cacheStats,
    database: poolStats,
    queues: queueStats,
    cluster: {
      isWorker: cluster.isWorker,
      workerId: cluster.worker ? cluster.worker.id : null
    }
  });
});

app.get('/health', async (req, res) => {
  const result = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      db: { ok: false, error: null },
      snowstorm: { ok: false, error: null },
      pool: { stats: null }
    },
    performance: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  // DB check
  try {
    const db = getDb();
    await db.execute('SELECT 1');
    result.checks.db.ok = true;
    
    // Add pool stats for monitoring
    const { getPoolStats } = require('./config/db');
    result.checks.pool.stats = getPoolStats();
  } catch (e) {
    result.checks.db.ok = false;
    result.checks.db.error = e.message || 'DB check failed';
    result.status = 'degraded';
  }

  const requireSnowstorm = String(process.env.REQUIRE_SNOWSTORM_HEALTH || '').toLowerCase() === 'true';

  // Snowstorm check (browser API or base URL)
  const snowstormConfigured = Boolean(process.env.SNOMED_SNOWSTORM_BASE_URL);
  if (!snowstormConfigured && !requireSnowstorm) {
    result.checks.snowstorm.ok = true;
  } else {
    const base = (process.env.SNOMED_SNOWSTORM_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
    try {
      // Try a lightweight endpoint; fall back to root
      const url = `${base}/browser/MAIN/concepts?limit=1`;
      await axios.get(url, { timeout: 3000 });
      result.checks.snowstorm.ok = true;
    } catch (e1) {
      try {
        await axios.get(base, { timeout: 3000 });
        result.checks.snowstorm.ok = true;
      } catch (e2) {
        result.checks.snowstorm.error = e1?.message || e2?.message || 'Snowstorm check failed';
        // Only mark overall health degraded if Snowstorm is explicitly required
        if (requireSnowstorm) {
          result.status = result.status === 'ok' ? 'degraded' : result.status;
        }
      }
    }
  }
  const dbOk = result.checks.db.ok === true;
  const snowstormOk = result.checks.snowstorm.ok === true;

  // If Snowstorm is optional, don't mark overall status degraded due to Snowstorm failures
  if (dbOk && !requireSnowstorm) {
    result.status = 'ok';
  }

  // Debug info in non-production
  if (env.nodeEnv !== 'production') {
    result.debug = {
      nodeEnv: env.nodeEnv,
      requireSnowstorm,
      snowstormConfigured,
      snowstormBase: process.env.SNOMED_SNOWSTORM_BASE_URL || null
    };
  }

  const httpCode = dbOk && (!requireSnowstorm || snowstormOk) ? 200 : 503;
  res.status(httpCode).json(result);
});

// Mount auto-generated stubs for frontend-only endpoints (returns 501)
// Enable only in development (or when explicitly opted-in) to avoid surprising 501s in real usage.
const enableStubRoutes = env.nodeEnv === 'development' || String(process.env.ENABLE_STUB_ROUTES || '').toLowerCase() === 'true';
if (enableStubRoutes) {
  app.use('/api', autoStubRoutes);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

module.exports = app;

