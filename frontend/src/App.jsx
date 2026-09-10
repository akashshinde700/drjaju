import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { useAuth } from './hooks/useAuth';
import RequireRole from './components/RequireRole';
import EnhancedErrorBoundary from './components/EnhancedErrorBoundary';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';

// Lightweight page loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

const FullPageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-slate-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-3 text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

// Lazy load ALL pages - including public pages to reduce main bundle
const Login = lazy(() => import('./pages/Login'));
const EnhancedLogin = lazy(() => import('./pages/EnhancedLogin'));
const UniversalOTPLogin = lazy(() => import('./pages/UniversalOTPLogin'));
const DoctorOTPLogin = lazy(() => import('./pages/DoctorOTPLogin'));
const Landing = lazy(() => import('./pages/Landing'));
const BookAppointment = lazy(() => import('./pages/BookAppointment'));
const Queue = lazy(() => import('./pages/Queue'));
const Patients = lazy(() => import('./pages/Patients'));
const PrescriptionPad = lazy(() => import('./pages/PrescriptionPad'));
const Payments = lazy(() => import('./pages/Payments'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Abha = lazy(() => import('./pages/Abha'));
const WhatsNew = lazy(() => import('./pages/WhatsNew'));
const LabInvestigations = lazy(() => import('./pages/LabInvestigations'));
const PatientOverview = lazy(() => import('./pages/PatientOverview'));
const RxTemplateConfig = lazy(() => import('./pages/RxTemplateConfig'));
const PadConfiguration = lazy(() => import('./pages/PadConfiguration'));
const PrescriptionPreview = lazy(() => import('./pages/PrescriptionPreview'));
const Receipts = lazy(() => import('./pages/Receipts'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const AppointmentIntents = lazy(() => import('./pages/AppointmentIntents'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const ClinicManagement = lazy(() => import('./pages/ClinicManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const BackupRestore = lazy(() => import('./pages/BackupRestore'));
const DoctorExport = lazy(() => import('./pages/DoctorExport'));
const FamilyHistory = lazy(() => import('./pages/FamilyHistory'));
const PatientAllergies = lazy(() => import('./pages/PatientAllergies'));
const LabTemplates = lazy(() => import('./pages/LabTemplates'));
const Insurance = lazy(() => import('./pages/Insurance'));
const MedicalCertificates = lazy(() => import('./pages/MedicalCertificates'));
const ReceiptTemplates = lazy(() => import('./pages/ReceiptTemplates'));
const SymptomsTemplates = lazy(() => import('./pages/SymptomsTemplates'));
const DoctorSettings = lazy(() => import('./pages/DoctorSettings'));
const DoctorManagement = lazy(() => import('./pages/DoctorManagement'));
const VIPPatients = lazy(() => import('./pages/VIPPatients'));
const DiagnosisTemplates = lazy(() => import('./pages/DiagnosisTemplates'));
const InjectionTemplates = lazy(() => import('./pages/InjectionTemplates'));
const MedicationsTemplates = lazy(() => import('./pages/MedicationsTemplates'));
const PrescriptionTemplates = lazy(() => import('./pages/PrescriptionTemplates'));
const StaffBilling = lazy(() => import('./pages/StaffBilling'));
const DoctorBilling = lazy(() => import('./pages/DoctorBilling'));
const SubscriptionPackages = lazy(() => import('./pages/SubscriptionPackages'));
const ABHADashboard = lazy(() => import('./pages/ABHADashboard'));

// New grouped pages
const Appointments = lazy(() => import('./pages/Appointments'));
const Billing = lazy(() => import('./pages/Billing'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const Clinical = lazy(() => import('./pages/Clinical'));
const Settings = lazy(() => import('./pages/Settings'));

// Doctor-first UI
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));

// OPD Management Pages
const ReceptionDashboard = lazy(() => import('./pages/ReceptionDashboard'));
const DoctorConsultation = lazy(() => import('./pages/DoctorConsultation'));
const BillingDashboard = lazy(() => import('./pages/BillingDashboard'));
const PrintPrescription = lazy(() => import('./pages/PrintPrescription'));

// QR Code Booking
const QRCodeBooking = lazy(() => import('./pages/QRCodeBooking'));
const DoctorQRManagement = lazy(() => import('./pages/DoctorQRCode'));

// Public prescription view (shared links)
const PrescriptionView = lazy(() => import('./pages/PrescriptionView'));

// Wraps every protected page with layout + error boundary + suspense
const Page = ({ children, roles }) => (
  <MainLayout>
    <EnhancedErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {roles ? <RequireRole allowed={roles}>{children}</RequireRole> : children}
      </Suspense>
    </EnhancedErrorBoundary>
  </MainLayout>
);

function App() {
  const { token } = useAuth();

  return (
    <Routes>
      {/* Public routes - all lazy loaded */}
      <Route path="/" element={<Suspense fallback={<FullPageLoader />}><Landing /></Suspense>} />
      <Route path="/login" element={<Suspense fallback={<FullPageLoader />}><Login /></Suspense>} />
      <Route path="/enhanced-login" element={<Suspense fallback={<FullPageLoader />}><EnhancedLogin /></Suspense>} />
      <Route path="/universal-otp-login" element={<Suspense fallback={<FullPageLoader />}><UniversalOTPLogin /></Suspense>} />
      <Route path="/doctor-otp-login" element={<Suspense fallback={<FullPageLoader />}><DoctorOTPLogin /></Suspense>} />
      <Route path="/book-appointment" element={<Suspense fallback={<FullPageLoader />}><BookAppointment /></Suspense>} />
      <Route path="/qr/:doctorId" element={<Suspense fallback={<FullPageLoader />}><QRCodeBooking /></Suspense>} />
      <Route path="/prescription/view/:prescriptionId" element={
        <Suspense fallback={<FullPageLoader />}>
          <PrescriptionView />
        </Suspense>
      } />

      {/* Protected routes */}
      {token ? (
        <>
          <Route path="/doctor-dashboard" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DoctorDashboard />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/staff-dashboard" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <StaffDashboard />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/queue" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Queue />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/patients" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Patients />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/appointments" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Appointments />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/orders" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <PrescriptionPad />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/orders/:patientId" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <PrescriptionPad />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/payments" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Payments />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/receipts" element={<Page><Receipts /></Page>} />
          <Route path="/prescription-preview" element={<Page><PrescriptionPreview /></Page>} />
          <Route path="/prescription-preview/:patientId" element={<Page><PrescriptionPreview /></Page>} />
          <Route path="/analytics" element={<Page roles={['admin', 'doctor']}><Analytics /></Page>} />
          <Route path="/abha" element={<Page><Abha /></Page>} />
          <Route path="/whats-new" element={<Page><WhatsNew /></Page>} />
          <Route path="/lab-investigations" element={<Page><LabInvestigations /></Page>} />
          <Route path="/patient-overview" element={<Page><PatientOverview /></Page>} />
          <Route path="/patient-overview/:id" element={<Page><PatientOverview /></Page>} />
          <Route path="/rx-template" element={<Page><RxTemplateConfig /></Page>} />
          <Route path="/pad-configuration" element={<Page roles={['admin', 'doctor']}><PadConfiguration /></Page>} />
          <Route path="/profile" element={<Page><UserProfile /></Page>} />
          <Route path="/appointment-intents" element={<Page><AppointmentIntents /></Page>} />
          <Route path="/audit-logs" element={<Page><AuditLogs /></Page>} />
          <Route path="/clinics" element={<Page><ClinicManagement /></Page>} />
          <Route path="/doctor-management" element={<Page roles={['admin']}><DoctorManagement /></Page>} />
          <Route path="/user-management" element={<Page><UserManagement /></Page>} />
          <Route path="/backup" element={<Page><BackupRestore /></Page>} />
          <Route path="/doctor-export" element={<Page><DoctorExport /></Page>} />
          <Route path="/family-history/:patientId" element={<Page><FamilyHistory /></Page>} />
          <Route path="/allergies/:patientId" element={<Page><PatientAllergies /></Page>} />
          <Route path="/lab-templates" element={<Page><LabTemplates /></Page>} />
          <Route path="/insurance/:patientId" element={<Page><Insurance /></Page>} />
          <Route path="/medical-certificates" element={<Page><MedicalCertificates /></Page>} />
          <Route path="/receipt-templates" element={<Page><ReceiptTemplates /></Page>} />
          <Route path="/symptoms-templates" element={<Page><SymptomsTemplates /></Page>} />
          <Route path="/doctor-settings" element={<Page roles={['doctor']}><DoctorSettings /></Page>} />
          
          {/* OPD Management Routes */}
          <Route path="/reception-dashboard" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <ReceptionDashboard />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/doctor-consultation/:visitId" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DoctorConsultation />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/billing-dashboard" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <BillingDashboard />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/print-prescription/:prescriptionId" element={
            <EnhancedErrorBoundary>
              <Suspense fallback={<FullPageLoader />}>
                <PrintPrescription />
              </Suspense>
            </EnhancedErrorBoundary>
          } />
          <Route path="/doctor-qr-management" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DoctorQRManagement />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          
          {/* New grouped pages */}
          <Route path="/billing" element={<Page><Billing /></Page>} />
          <Route path="/prescriptions" element={<Page><Prescriptions /></Page>} />
          <Route path="/clinical" element={<Page><Clinical /></Page>} />
          <Route path="/settings" element={
            <MainLayout>
              <EnhancedErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Settings />
                </Suspense>
              </EnhancedErrorBoundary>
            </MainLayout>
          } />
          <Route path="/vip-patients" element={<Page><VIPPatients /></Page>} />
          <Route path="/diagnosis-templates" element={<Page><DiagnosisTemplates /></Page>} />
          <Route path="/injection-templates" element={<Page><InjectionTemplates /></Page>} />
          <Route path="/medications-templates" element={<Page><MedicationsTemplates /></Page>} />
          <Route path="/prescription-templates" element={<Page><PrescriptionTemplates /></Page>} />
          <Route path="/staff-billing" element={<Page><StaffBilling /></Page>} />
          <Route path="/doctor-billing" element={<Page><DoctorBilling /></Page>} />
          <Route path="/subscription-packages" element={<Page><SubscriptionPackages /></Page>} />
          <Route path="/abha-dashboard" element={<Page><ABHADashboard /></Page>} />
          <Route path="*" element={<Navigate to="/queue" replace />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  );
}

export default App;
