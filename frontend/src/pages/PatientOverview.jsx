import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { openWhatsApp, buildWhatsAppFollowupMessage } from '../utils/whatsapp';
import AbhaIntegration from '../components/AbhaIntegration';
import { cleanReasonForVisit } from '../utils/reasonForVisit';
import { getLocalDateString } from '../utils/localDate';

export default function PatientOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';
  // /uploads is now auth-protected on the backend; <img> tags and window.open
  // can't send Authorization headers, so pass the JWT as a query param.
  const fileUrl = (p) => `${apiBase}${p}${p.includes('?') ? '&' : '?'}token=${encodeURIComponent(localStorage.getItem('token') || '')}`;
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [labs, setLabs] = useState([]);
  const [vitals, setVitals] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [labSearch, setLabSearch] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('P'); // P: Past Visits, H: History, V: Vitals, R: Records
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [includeOtherProfiles, setIncludeOtherProfiles] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [surgicalHistory, setSurgicalHistory] = useState([]);
  const [showAddSurgeryModal, setShowAddSurgeryModal] = useState(false);
  const [newSurgery, setNewSurgery] = useState({ procedure: '', date: '', notes: '' });
  const [structuredMedHistory, setStructuredMedHistory] = useState({ existingConditions: [], surgicalHistory: [] });
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    dob: '',
    age: '',
    useAgeInput: false,
    gender: '',
    blood_group: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    emergency_contact: '',
    emergency_phone: '',
    medical_conditions: '',
    allergies: '',
    current_medications: '',
    patient_id: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [showUploadRecordModal, setShowUploadRecordModal] = useState(false);
  const [showManualRecordModal, setShowManualRecordModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'OTHERS',
    description: '',
    file: null
  });
  const [manualRecordForm, setManualRecordForm] = useState({
    name: '',
    category: 'OTHERS',
    description: '',
    date: getLocalDateString()
  });
  const [followups, setFollowups] = useState([]);
  const [vitalsForm, setVitalsForm] = useState({ temp: '', height: '', weight: '', pulse: '', spo2: '', blood_pressure: '' });
  const [_showEditVitalsModal, _setShowEditVitalsModal] = useState(false);
  const [_editVitalsForm, _setEditVitalsForm] = useState({ temp: '', height: '', weight: '', pulse: '', spo2: '', blood_pressure: '' });
  const [showLabUploadModal, setShowLabUploadModal] = useState(false);
  const [shareWithLetterhead, setShareWithLetterhead] = useState(true);
  const [labUploadForm, setLabUploadForm] = useState({ test_name: '', reading: '', unit: '', date: getLocalDateString(), notes: '', reference_range: '' });
  const [labTemplates, setLabTemplates] = useState([]);
  const [labTemplateCategories, setLabTemplateCategories] = useState([]);
  const [selectedLabCategory, setSelectedLabCategory] = useState('');
  const [labParamFormTest, setLabParamFormTest] = useState(null);
  // Referral states
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralNetwork, setReferralNetwork] = useState([]);
  const [referralForm, setReferralForm] = useState({
    selectedDoctor: '',
    referred_doctor_name: '',
    referred_doctor_phone: '',
    referred_doctor_specialization: '',
    hospital_name: '',
    reason: '',
    priority: 'routine',
    notes: ''
  });
  const [referralLoading, setReferralLoading] = useState(false);
  const [labParamFormData, setLabParamFormData] = useState([]);
  const [labParamLoading, setLabParamLoading] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState('');
  const [_showMedicalHistoryModal, _setShowMedicalHistoryModal] = useState(false);
  const [_medicalHistoryForm, _setMedicalHistoryForm] = useState({ condition: '', diagnosis_date: '', notes: '' });
  const [_medicalHistory, _setMedicalHistory] = useState([]);
  const [customLabTests, setCustomLabTests] = useState([]);
  const [showCustomTestModal, setShowCustomTestModal] = useState(false);
  const [selectedCustomTest, setSelectedCustomTest] = useState(null);
  const [customTestForm, setCustomTestForm] = useState({ test_name: '', remark: '', result_value: '', unit: '', reference_range: '', result_date: '' });
  const [_customTestsLoading, setCustomTestsLoading] = useState(false);

  // Load custom lab tests from database when id is available
  useEffect(() => {
    const fetchCustomLabTests = async () => {
      if (id) {
        setCustomTestsLoading(true);
        try {
          const res = await api.get('/api/custom-lab-tests', { params: { patientId: id } });
          console.log('Loaded custom tests from database:', res.data.customLabTests);
          setCustomLabTests(res.data.customLabTests || []);
        } catch (e) {
          console.error('Failed to load custom lab tests:', e);
          setCustomLabTests([]);
        } finally {
          setCustomTestsLoading(false);
        }
      }
    };
    fetchCustomLabTests();
  }, [id, api]);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [labUploadLoading, setLabUploadLoading] = useState(false);
  const [showRecordPreviewModal, setShowRecordPreviewModal] = useState(false);
  const [selectedRecordPreview, setSelectedRecordPreview] = useState(null);
  const [extractionStatus, setExtractionStatus] = useState(null);
  const [showExtractionModal, setShowExtractionModal] = useState(false);

  const fetchPatientData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const normalizedId = String(id || '').split(':')[0].split('/')[0].trim();
      if (!normalizedId) {
        throw new Error('Invalid patient ID');
      }
      const res = await api.get(`/api/patients/${normalizedId}`);
      setPatient(res.data?.data || res.data);

      // Fetch data based on includeOtherProfiles setting
      const params = includeOtherProfiles ? '?includeOtherProfiles=true' : '';

      const [rec, lab, vit, time, presc, fups, famHist, medHist] = await Promise.all([
        api.get(`/api/patient-data/records/${id}${params}`),
        api.get(`/api/patient-data/labs/${id}${params}`),
        api.get(`/api/patient-data/vitals/${id}${params}`),
        api.get(`/api/patient-data/timeline/${id}${params}`),
        api.get(`/api/prescriptions/${id}`).catch(() => ({ data: { prescriptions: [] } })),
        api.get('/api/appointments/followups', { params: { patient_id: id } }),
        api.get(`/api/family-history/${id}`).catch(() => ({ data: [] })),
        api.get(`/api/medical-history/patient/${id}`).catch(() => ({ data: null }))
      ]);

      setRecords(rec.data?.data?.records || rec.data?.records || []);
      setLabs(lab.data?.data?.labs || lab.data?.labs || []);
      setVitals(vit.data?.data?.vitals || vit.data?.vitals || []);
      setTimeline(time.data?.data?.timeline || time.data?.timeline || []);
      // /api/prescriptions/:patientId uses sendSuccess(ApiResponse)
      // Common shapes:
      // - { success:true, data:{ prescriptions:[...] , pagination:{} } }
      // - { success:true, data:{ data:[...] , pagination:{} } } (paginated)
      // - { prescriptions:[...] } (older)
      const prescPayload = presc?.data?.data || presc?.data || {};
      const extractedPrescriptions =
        Array.isArray(prescPayload?.prescriptions)
          ? prescPayload.prescriptions
          : (Array.isArray(prescPayload?.data) ? prescPayload.data : (Array.isArray(presc?.data?.prescriptions) ? presc.data.prescriptions : []));
      setPrescriptions(extractedPrescriptions);
      setFollowups(fups.data?.data?.followups || fups.data?.followups || []);
      setFamilyHistory(famHist.data?.data?.history || famHist.data?.history || famHist.data?.family_history || []);
      if (medHist.data?.success) {
        // Tolerate both { data: {...} } and the legacy double-wrapped
        // { data: { data: {...} } } this endpoint used to send, so past history
        // renders whichever shape the deployed backend is on. Mirrors the
        // unwrapping PrescriptionPad already does for the same endpoint.
        let medPayload = medHist.data.data || {};
        if (medPayload.data && typeof medPayload.data === 'object' && !Array.isArray(medPayload.data)) {
          medPayload = medPayload.data;
        }
        setStructuredMedHistory({
          existingConditions: Array.isArray(medPayload.existingConditions) ? medPayload.existingConditions : [],
          surgicalHistory: Array.isArray(medPayload.surgicalHistory) ? medPayload.surgicalHistory : [],
        });
      }
      setLastUpdated(new Date());
    } catch (err) {
      // If patient not found (404), redirect back to patients list
      if (err.response?.status === 404) {
        addToast('Patient not found or has been deleted', 'error');
        navigate('/patients');
        return;
      }
      setError(err.response?.data?.error || 'Unable to load patient');
    } finally {
      setLoading(false);
    }
  }, [id, api, includeOtherProfiles, addToast, navigate]);
  
  // Listen for custom refresh event from prescription
  useEffect(() => {
    const handlePatientDataRefresh = (event) => {
      if (event.detail?.patientId && parseInt(event.detail.patientId) === parseInt(id)) {
        // console.log('Patient data refresh event received:', event.detail);
        fetchPatientData();
        addToast('Lab results updated from prescription', 'success');
      }
    };

    window.addEventListener('patientDataRefresh', handlePatientDataRefresh);
    
    return () => {
      window.removeEventListener('patientDataRefresh', handlePatientDataRefresh);
    };
  }, [id, fetchPatientData, addToast]);

  const handleRefresh = () => {
    fetchPatientData();
    addToast('Data refreshed', 'success');
  };

  // Add lab result handler
  const handleAddLabResult = async (e) => {
    e.preventDefault();
    if (!labUploadForm.test_name.trim()) {
      addToast('Please enter test name', 'error');
      return;
    }
    setLabUploadLoading(true);
    try {
      await api.post(`/api/labs/${id}`, {
        test_name: labUploadForm.test_name,
        result_value: labUploadForm.reading,
        result_unit: labUploadForm.unit,
        reference_range: labUploadForm.reference_range || '',
        result_date: labUploadForm.date,
        notes: labUploadForm.notes,
        status: 'completed'
      });
      addToast('Lab result added', 'success');
      setShowLabUploadModal(false);
      setLabUploadForm({ test_name: '', reading: '', unit: '', date: getLocalDateString(), notes: '', reference_range: '' });
      fetchPatientData();
    } catch (error) {
      console.error('Error adding lab result:', error);
      addToast(error.response?.data?.error || 'Failed to add lab result', 'error');
    } finally {
      setLabUploadLoading(false);
    }
  };

  // Fetch lab templates
  useEffect(() => {
    const fetchLabTemplates = async () => {
      try {
        const res = await api.get('/api/lab-templates');
        const templates = res.data.data || res.data.templates || res.data || [];
        setLabTemplates(templates);
        setLabTemplateCategories([...new Set(templates.map(t => t.category).filter(Boolean))]);
      } catch (error) {
        console.error('Failed to fetch lab templates:', error);
      }
    };
    fetchLabTemplates();
  }, [api]);

  const filteredLabs = labs.filter(lab =>
    lab.name.toLowerCase().includes(labSearch.toLowerCase())
  );

  const getCategoryBadgeColor = (category) => {
    const colors = {
      'PRESCRIPTION': 'bg-blue-100 text-blue-800',
      'REPORT': 'bg-green-100 text-green-800',
      'XRAY': 'bg-purple-100 text-purple-800',
      'MRI': 'bg-indigo-100 text-indigo-800',
      'BLOOD_TEST': 'bg-red-100 text-red-800',
      'OTHERS': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors['OTHERS'];
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getVitalsDisplay = () => {
    const vitalsMap = {};
    vitals.forEach(v => {
      vitalsMap[v.label] = v;
    });

    const allVitals = [
      { key: 'Temperature', label: 'Temperature', unit: '°F', color: 'text-red-600' },
      { key: 'Height', label: 'Height', unit: 'cm', color: 'text-blue-600' },
      { key: 'Weight', label: 'Weight', unit: 'kg', color: 'text-green-600' },
      { key: 'BMI', label: 'BMI', unit: '', color: 'text-purple-600' },
      { key: 'Pulse Rate', label: 'Pulse Rate', unit: 'bpm', color: 'text-orange-600' },
      { key: 'Blood Pressure', label: 'BP', unit: '', color: 'text-blue-700' },
      { key: 'SpO2', label: 'SpO2', unit: '%', color: 'text-teal-600' }
    ];

    return allVitals.map(vital => ({
      ...vital,
      value: vitalsMap[vital.key]?.value || 'N/A',
      date: vitalsMap[vital.key]?.date || null
    }));
  };

  const handleAddSurgery = async () => {
    if (!newSurgery.procedure || !newSurgery.date) {
      addToast('Please fill procedure name and date', 'error');
      return;
    }

    try {
      // In a real app, this would save to backend
      // For now, we'll add to local state
      setSurgicalHistory([...surgicalHistory, { ...newSurgery, id: Date.now() }]);
      setNewSurgery({ procedure: '', date: '', notes: '' });
      setShowAddSurgeryModal(false);
      addToast('Surgical procedure added', 'success');
    } catch (err) {
      addToast('Failed to add surgery', 'error');
    }
  };

  const handleUploadRecord = async (e) => {
    e.preventDefault();

    if (!uploadForm.file) {
      addToast('Please select a file to upload', 'error');
      return;
    }

    if (!uploadForm.name.trim()) {
      addToast('Please enter a record name', 'error');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('name', uploadForm.name);
      formData.append('category', uploadForm.category);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      const response = await api.post(`/api/patient-data/records/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Handle OCR extraction results
      const ocr = response.data.extractedLabData;
      if (ocr?.extracted && ocr?.count > 0) {
        setExtractionStatus(ocr);
        setShowExtractionModal(true);
        addToast(`✓ ${ocr.count} lab values auto-extracted from report!`, 'success');
      } else if (ocr?.extracted === false && ocr?.error) {
        // OCR ran but failed or found nothing
        addToast(
          ocr.error.includes('No lab values')
            ? 'File uploaded. OCR scan nahi hua — image unclear ya format nahi pehchana. Manually values add karein.'
            : `File uploaded. OCR error: ${ocr.error}`,
          'warning'
        );
      } else {
        addToast('Record uploaded successfully', 'success');
      }

      setShowUploadRecordModal(false);
      setUploadForm({ name: '', category: 'OTHERS', description: '', file: null });
      fetchPatientData();
    } catch (error) {
      console.error('Upload error:', error);
      addToast(error.response?.data?.error || 'Failed to upload record', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleManualRecord = async (e) => {
    e.preventDefault();

    if (!manualRecordForm.name.trim()) {
      addToast('Please enter a record name', 'error');
      return;
    }

    setUploadLoading(true);
    try {
      await api.post(`/api/patient-data/records/${id}`, {
        name: manualRecordForm.name,
        category: manualRecordForm.category,
        description: manualRecordForm.description,
        date: manualRecordForm.date
      });

      addToast('Record created successfully', 'success');
      setShowManualRecordModal(false);
      setManualRecordForm({ name: '', category: 'OTHERS', description: '', date: getLocalDateString() });
      fetchPatientData();
    } catch (error) {
      console.error('Manual record error:', error);
      addToast(error.response?.data?.error || 'Failed to create record', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const calculateDobFromAge = (age) => {
    if (!age || isNaN(age)) return '';
    const today = new Date();
    const birthYear = today.getFullYear() - parseInt(age);
    const birthDate = new Date(birthYear, today.getMonth(), today.getDate());
    return birthDate.toISOString().split('T')[0];
  };

  const calculateAgeFromDob = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  useEffect(() => {
    if (!id) return;
    fetchPatientData();
  }, [id, fetchPatientData]);

  const lastPrescription = (prescriptions && prescriptions.length > 0) ? prescriptions[0] : null;

  const handleDeletePrescription = async (presc) => {
    const prescId = presc?.id;
    if (!prescId) {
      addToast('Prescription ID not found', 'error');
      return;
    }

    const ok = window.confirm('Delete this visit/prescription?');
    if (!ok) return;

    try {
      await api.delete(`/api/prescriptions/detail/${prescId}`);
      setPrescriptions(prev => (prev || []).filter(p => p?.id !== prescId));
      if (selectedVisit?.id === prescId) {
        setShowPrescriptionModal(false);
        setSelectedVisit(null);
      }
      addToast('Deleted successfully', 'success');
    } catch (err) {
      console.error('Failed to delete prescription:', err);
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  // Share the patient's latest bill via WhatsApp
  const handleShareLatestBillWhatsApp = async () => {
    if (!patient?.phone) { addToast('Patient phone not available', 'error'); return; }
    try {
      const res = await api.get(`/api/bills?patient_id=${id}&limit=1`);
      const bills = res.data?.data?.bills || res.data?.bills || [];
      if (bills.length === 0) { addToast('No bills found for this patient', 'info'); return; }
      const billId = bills[0].id;
      const lh = shareWithLetterhead ? '?with_letterhead=1' : '';
      const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/bill/${billId}${lh}`;
      const msg = `Hello ${patient.name},\n\nYour bill/receipt is ready.\nView/Download PDF: ${pdfUrl}`;
      openWhatsApp(patient.phone, msg);
    } catch {
      addToast('Failed to fetch bill', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Patient Overview</h1>
      {loading && <div className="text-sm text-slate-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {patient && (
        <div className="bg-white border rounded shadow-sm p-6">
          {/* Patient Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                {patient.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{patient.name}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    UHID: {patient.patient_id}
                  </span>
                  {patient.abha_id && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                      ABHA: {patient.abha_id}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const age = patient.dob ? calculateAgeFromDob(patient.dob) : '';
                  setEditForm({
                    name: patient.name || '',
                    phone: patient.phone || '',
                    email: patient.email || '',
                    dob: patient.dob || '',
                    age: age,
                    useAgeInput: false,
                    gender: patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender || '',
                    blood_group: patient.blood_group || '',
                    address: patient.address || '',
                    city: patient.city || '',
                    state: patient.state || '',
                    pincode: patient.pincode || '',
                    emergency_contact: patient.emergency_contact_name || '',
                    emergency_phone: patient.emergency_contact_phone || '',
                    medical_conditions: patient.medical_conditions || '',
                    allergies: patient.allergies || '',
                    current_medications: patient.current_medications || '',
                    patient_id: patient.patient_id || ''
                  });
                  setShowEditPatientModal(true);
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Patient
              </button>
              <button
                disabled={sendingFollowup}
                onClick={async () => {
                  if (!patient?.phone) {
                    addToast('Patient phone number not available', 'error');
                    return;
                  }
                  setSendingFollowup(true);
                  try {
                    // Config-driven: pulls the logged-in doctor's own
                    // website/Google-review/social links and (optional)
                    // custom template from Doctor Settings — nothing here is
                    // hardcoded per-doctor, so this works unchanged for any
                    // doctor on the platform.
                    let doctorConfig = {};
                    if (user?.doctor_id) {
                      try {
                        const res = await api.get(`/api/doctors/${user.doctor_id}`);
                        doctorConfig = res.data || {};
                      } catch (e) {
                        // Fall back to a generic message below if this fails.
                      }
                    }
                    const doctorName = doctorConfig?.name || user?.name || '';
                    const message = buildWhatsAppFollowupMessage({
                      patientName: patient.name,
                      doctorName,
                      bookingUrl: doctorConfig?.booking_url,
                      websiteUrl: doctorConfig?.website_url,
                      googleReviewUrl: doctorConfig?.google_review_url,
                      showGoogleReview: !!doctorConfig?.show_google_review,
                      template: doctorConfig?.whatsapp_followup_template,
                    });
                    openWhatsApp(patient.phone, message);
                  } finally {
                    setSendingFollowup(false);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-2 disabled:opacity-60"
                title="Send follow-up message on WhatsApp"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                WhatsApp
              </button>
              <button
                onClick={() => navigate(`/orders/${id}`, { state: { returnTo: `/patient-overview/${id}` } })}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 text-sm"
              >
                New Prescription
              </button>
              <button
                onClick={async () => {
                  try {
                    const resp = await api.get(`/api/prescriptions/patient/${id}/last`);
                    const rx = resp.data?.prescription || resp.data?.data?.prescription || resp.data;
                    if (!rx) throw new Error('No prescription data');
                    // Format for PrescriptionPad sessionStorage copy mechanism
                    const copyData = {
                      symptoms: rx.symptoms || (rx.chief_complaint ? rx.chief_complaint.split(',').map(s => s.trim()).filter(Boolean) : []),
                      diagnoses: rx.diagnosis || rx.diagnoses || [],
                      medications: (rx.medications || []).map(m => ({
                        name: m.medication_name || m.name || '',
                        brand: m.brand_name || '',
                        composition: m.generic_name || '',
                        dosage: m.dosage || '',
                        frequency: m.frequency || '',
                        duration: m.duration || '',
                        timing: m.timing || '',
                        instructions: m.instructions || m.notes || '',
                        qty: m.quantity || '',
                        is_tapering: m.is_tapering || 0,
                        tapering_schedule: m.tapering_schedule || []
                      })),
                      advice: rx.advice || '',
                      follow_up_days: rx.follow_up_days || '',
                      patient_notes: rx.patient_notes || '',
                      custom_fields: rx.custom_fields || null
                    };
                    sessionStorage.setItem('copyPrescription', JSON.stringify(copyData));
                    addToast('Last prescription loaded! Review and save.', 'success');
                    navigate(`/orders/${id}?copy=true`);
                  } catch (err) {
                    addToast(err.response?.data?.message || 'No last prescription found', 'error');
                  }
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
                title="Load last prescription into Rx pad"
              >
                Repeat Last Rx
              </button>
              <button
                onClick={() => navigate(`/family-history/${id}`, { state: { returnTo: `/patient-overview/${id}` } })}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
              >
                Family History
              </button>
              <button
                onClick={async () => {
                  setShowReferralModal(true);
                  try {
                    const resp = await api.get('/api/patient-referrals/network/doctors');
                    setReferralNetwork(resp.data?.network || resp.data?.doctors || resp.data?.data?.network || []);
                  } catch (e) { console.error('Network fetch error:', e); }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Refer to Doctor
              </button>
            </div>
          </div>

          {/* Patient Demographics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-slate-50 rounded">
              <div className="text-xs text-slate-500 mb-1">Age</div>
              <div className="font-semibold text-slate-800">
                {patient.dob ? calculateAge(patient.dob) : (patient.age_years ?? 'N/A')} years
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <div className="text-xs text-slate-500 mb-1">Gender</div>
              <div className="font-semibold text-slate-800 capitalize">
                {patient.gender || 'N/A'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <div className="text-xs text-slate-500 mb-1">Date of Birth</div>
              <div className="font-semibold text-slate-800">
                {patient.dob ? new Date(patient.dob).toLocaleDateString('en-IN') : 'N/A'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <div className="text-xs text-slate-500 mb-1">Blood Group</div>
              <div className="font-semibold text-slate-800">
                {patient.blood_group || 'N/A'}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <div className="text-xs text-slate-500">Phone</div>
                <div className="text-sm font-medium">{patient.phone || 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-sm font-medium">{patient.email || 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="text-xs text-slate-500">Address</div>
                <div className="text-sm font-medium truncate">{patient.address || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Medical Alerts */}
          {(patient.allergies || patient.medical_conditions) && (
            <div className="flex flex-wrap gap-2">
              {patient.allergies && (
                <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Allergies: {patient.allergies}
                </div>
              )}
              {patient.medical_conditions && (
                <div className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Conditions: {patient.medical_conditions}
                </div>
              )}
            </div>
          )}

          {/* ABHA Integration */}
          <div className="mt-4">
            <AbhaIntegration patientId={id} onAbhaLinked={fetchPatientData} />
          </div>
          {followups && followups.length > 0 && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-green-700">Next Follow-up</div>
                  <div className="font-semibold text-green-800">
                    {new Date(followups[0].followup_date).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!patient?.phone) { addToast('Patient phone not available', 'error'); return; }
                    const dateStr = new Date(followups[0].followup_date).toLocaleDateString('en-IN');
                    const msg = `Hello ${patient.name},\n\nYour follow-up is scheduled on ${dateStr}.\nPlease confirm your availability.`;
                    openWhatsApp(patient.phone, msg);
                  }}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Send on WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white border rounded shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold">Medical Records</h3>
                <span className="text-xs text-slate-500">
                  Last updated at {lastUpdated.toLocaleTimeString()}
                </span>
                <button
                  onClick={handleRefresh}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90"
                  onClick={() => setShowUploadRecordModal(true)}
                >
                  Upload File
                </button>
              </div>
            </div>

            {/* Include other profiles checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeOtherProfiles"
                checked={includeOtherProfiles}
                onChange={(e) => setIncludeOtherProfiles(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="includeOtherProfiles" className="text-sm text-slate-600">
                +{records.length} records from other profiles
              </label>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {records.map((r, idx) => (
                <div key={`${r.name}-${idx}`} className="p-3 border rounded bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{r.name}</p>
                      <p className="text-xs text-slate-600">{r.date}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryBadgeColor(r.category)}`}>
                      {r.category}
                    </span>
                  </div>

                  {/* Document preview placeholder */}
                  <div className="w-full h-20 bg-slate-200 rounded flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (r.file_path) {
                          window.open(fileUrl(r.file_path), '_blank');
                        } else {
                          addToast('No file available', 'error');
                        }
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      View
                    </button>
                    <button
                      onClick={async () => {
                        if (r.file_path) {
                          try {
                            const response = await fetch(fileUrl(r.file_path));
                            const blob = await response.blob();
                            const blobUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = r.name || 'record';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
                          } catch {
                            addToast('Download failed', 'error');
                          }
                        } else {
                          addToast('No file available', 'error');
                        }
                      }}
                      className="text-xs text-slate-600 hover:underline"
                    >
                      Download
                    </button>
                    <button 
                      className="text-xs text-red-600 hover:text-red-800 ml-2"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this record?')) {
                          api.delete(`/api/patient-data/records/${id}/${r.id}`)
                            .then(() => {
                              setRecords(prev => prev.filter(record => record.id !== r.id));
                              addToast('Record deleted', 'success');
                            })
                            .catch(() => addToast('Delete failed', 'error'));
                        }
                      }}
                    >
                      <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border rounded shadow-sm p-4 space-y-3" data-section-labs>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lab Results</h3>
              <button
                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => setShowLabUploadModal(true)}
                title="Add Lab Result"
              >
                Add Lab Result
              </button>
            </div>
            
            {/* Search and Category Filters */}
            <div className="space-y-2 p-3 bg-gray-50 rounded relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search lab tests by name or code... (Press Enter to add new)"
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && labSearch.trim()) {
                      const searchTerm = labSearch.trim();

                      // Check if already exists in custom tests (case-insensitive)
                      const existsInCustom = customLabTests.some(ct =>
                        ct.test_name.toLowerCase() === searchTerm.toLowerCase()
                      );

                      if (existsInCustom) {
                        addToast(`"${searchTerm}" already exists in custom tests`, 'warning');
                        return;
                      }

                      // Add to database
                      try {
                        const res = await api.post('/api/custom-lab-tests', {
                          patientId: id,
                          test_name: searchTerm,
                          remark: '',
                          result_value: '',
                          unit: ''
                        });
                        console.log('Added custom test to database:', res.data.customLabTest);
                        const updated = [...customLabTests, res.data.customLabTest];
                        setCustomLabTests(updated);
                        addToast(`"${searchTerm}" saved! Click on it to add remarks.`, 'success');
                        setLabSearch('');
                      } catch (err) {
                        console.error('Failed to add custom test:', err);
                        addToast('Failed to save custom test', 'error');
                      }
                    }
                  }}
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-400"
                />
                
                {/* Search Results Dropdown */}
                {labSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 border rounded bg-white shadow-lg z-50 max-h-64 overflow-y-auto">
                    {/* Existing Lab Results */}
                    {filteredLabs.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 sticky top-0">Existing Results</div>
                        {filteredLabs.map((l, idx) => (
                          <button
                            key={`result-${l.name}-${idx}`}
                            type="button"
                            onClick={() => {
                              setLabUploadForm({
                                test_name: l.name,
                                result_value: l.reading || '',
                                unit: l.unit || '',
                                reference_range: l.reference_range || ''
                              });
                              setShowLabUploadModal(true);
                              setLabSearch('');
                            }}
                            className="w-full text-left px-3 py-2 border-b text-sm hover:bg-blue-50 transition"
                          >
                            <div className="font-medium text-xs">{l.name}</div>
                            <div className="text-[10px] text-gray-600">
                              {l.reading} {l.unit ? l.unit : ''} • {l.date ? new Date(l.date).toLocaleDateString('en-IN') : 'No date'}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    
                    {/* Available Test Templates */}
                    {labTemplates.filter(t => t.test_name.toLowerCase().includes(labSearch.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labSearch.toLowerCase()))).length > 0 && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 sticky top-0">Available Tests</div>
                        {labTemplates
                          .filter(t => t.test_name.toLowerCase().includes(labSearch.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labSearch.toLowerCase())))
                          .slice(0, 20)
                          .map(t => (
                            <button
                              key={`template-${t.id}`}
                              type="button"
                              onClick={async () => {
                                setLabParamLoading(true);
                                setLabParamFormTest(t);
                                setLabUploadForm(prev => ({ ...prev, test_name: t.test_name, unit: t.unit || '', reference_range: t.reference_range || '' }));
                                setLabSearch('');
                                try {
                                  const res = await api.get(`/api/lab-templates/${t.id}/parameters`);
                                  const params = res.data.parameters || [];
                                  setLabParamFormData(params.map(p => ({ ...p, result_value: '' })));
                                } catch (err) {
                                  console.error('Failed to fetch parameters:', err);
                                  setLabParamFormData([]);
                                }
                                setLabParamLoading(false);
                                setShowLabUploadModal(true);
                              }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-purple-50 transition"
                            >
                              <div className="font-medium text-xs flex items-center gap-2">
                                {t.test_name}
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Add</span>
                              </div>
                              <div className="text-[10px] text-gray-600">
                                {t.category && <span className="text-purple-600">{t.category}</span>}
                                {t.sample_type && <span> • {t.sample_type}</span>}
                              </div>
                            </button>
                          ))}
                      </>
                    )}
                    
                    {/* Saved Custom Tests */}
                    {customLabTests.filter(ct => ct.test_name.toLowerCase().includes(labSearch.toLowerCase())).length > 0 && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold bg-orange-100 text-orange-700 sticky top-0">Saved Custom Tests</div>
                        {customLabTests
                          .filter(ct => ct.test_name.toLowerCase().includes(labSearch.toLowerCase()))
                          .map(ct => (
                            <button
                              key={`custom-${ct.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedCustomTest(ct);
                                setCustomTestForm({
                                  test_name: ct.test_name,
                                  remark: ct.remark || '',
                                  result_value: ct.result_value || '',
                                  unit: ct.unit || '',
                                  reference_range: '',
                                  result_date: getLocalDateString()
                                });
                                setShowCustomTestModal(true);
                                setLabSearch('');
                              }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-orange-50 transition"
                            >
                              <div className="font-medium text-xs flex items-center gap-2">
                                {ct.test_name}
                                <span className="text-[10px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">Custom</span>
                              </div>
                              {ct.remark && (
                                <div className="text-[10px] text-gray-500 truncate">{ct.remark}</div>
                              )}
                            </button>
                          ))}
                      </>
                    )}

                    {filteredLabs.length === 0 && labTemplates.filter(t => t.test_name.toLowerCase().includes(labSearch.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labSearch.toLowerCase()))).length === 0 && customLabTests.filter(ct => ct.test_name.toLowerCase().includes(labSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">
                        <div>No results found</div>
                        <div className="text-xs mt-1 text-blue-600">Press <span className="font-semibold">Enter</span> to save "{labSearch}" as custom test</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lab Results Grid - Only show when not searching */}
            {!labSearch && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLabs.length > 0 && filteredLabs.map((l, idx) => (
                  <div
                    key={`${l.name}-${idx}`}
                    className="border rounded p-3 hover:bg-blue-50 hover:border-blue-300 transition cursor-pointer bg-white"
                    onClick={() => {
                      setLabUploadForm({
                        test_name: l.name,
                        result_value: l.reading || '',
                        unit: l.unit || '',
                        reference_range: l.reference_range || ''
                      });
                      setShowLabUploadModal(true);
                    }}
                  >
                    <div className="font-medium text-sm text-gray-900">{l.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      <div className="font-semibold text-blue-600">
                        {l.reading} {l.unit ? l.unit : ''}
                      </div>
                      {l.reference_range && (
                        <div className="text-gray-500">Ref: {l.reference_range}</div>
                      )}
                      {l.date && (
                        <div className="text-gray-500 mt-1">
                          {new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                      {l.notes && (
                        <div className="text-orange-700 italic mt-0.5">{l.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Medical Records in Lab Results Section - removed */}
            {/* eslint-disable-next-line no-constant-binary-expression */}
            {false && !labSearch && records.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-sm mb-3">Medical Records</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {records.map((r, idx) => (
                    <div key={`${r.name}-record-${idx}`} className="p-3 border rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{r.name}</p>
                          <p className="text-xs text-gray-600">{r.date}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getCategoryBadgeColor(r.category)}`}>
                          {r.category}
                        </span>
                      </div>

                      {/* Document preview */}
                      <div 
                        className="w-full h-20 bg-gray-200 rounded flex items-center justify-center mb-2 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400"
                        onClick={() => {
                          setSelectedRecordPreview(r);
                          setShowRecordPreviewModal(true);
                        }}
                      >
                        {r.file_path && (r.file_path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                          <img 
                            src={fileUrl(r.file_path)}
                            alt={r.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (r.file_path && (r.file_path.match(/\.pdf$/i))) ? (
                          <div className="flex flex-col items-center justify-center text-gray-500">
                            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0112.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">PDF</span>
                          </div>
                        ) : (
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              if (r.file_path) {
                                const response = await fetch(fileUrl(r.file_path), {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  }
                                });
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.target = '_blank';
                                a.click();
                                window.URL.revokeObjectURL(url);
                              } else {
                                addToast('No file available', 'error');
                              }
                            } catch (err) {
                              console.error('Error opening file:', err);
                              addToast('Failed to open file', 'error');
                            }
                          }}
                          className="flex-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                        >
                          View
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              if (r.file_path) {
                                const response = await fetch(fileUrl(r.file_path), {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  }
                                });
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                // Extract filename from r.name or use default
                                a.download = r.name || 'record';
                                a.click();
                                window.URL.revokeObjectURL(url);
                                addToast('File downloaded', 'success');
                              } else {
                                addToast('No file available', 'error');
                              }
                            } catch (err) {
                              console.error('Error downloading file:', err);
                              addToast('Failed to download file', 'error');
                            }
                          }}
                          className="flex-1 text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-white border rounded shadow-sm p-4 space-y-3">
            <h3 className="font-semibold">Vitals</h3>
            <div className="grid grid-cols-2 gap-4">
              {getVitalsDisplay().map((vital, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{vital.label}</span>
                  <span className={`font-semibold ${vital.color}`}>
                    {vital.value} {vital.unit}
                  </span>
                </div>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post(`/api/patient-data/vitals/${id}`, {
                    temp: vitalsForm.temp || null,
                    height: vitalsForm.height || null,
                    weight: vitalsForm.weight || null,
                    pulse: vitalsForm.pulse || null,
                    spo2: vitalsForm.spo2 || null,
                    blood_pressure: vitalsForm.blood_pressure || null
                  });
                  addToast('Vitals updated', 'success');
                  setVitalsForm({ temp: '', height: '', weight: '', pulse: '', spo2: '', blood_pressure: '' });
                  fetchPatientData();
                } catch (err) {
                  addToast(err.response?.data?.error || 'Failed to update vitals', 'error');
                }
              }}
              className="grid md:grid-cols-6 gap-2 bg-slate-50 p-3 rounded"
            >
              <input className="px-2 py-1 border rounded text-sm" placeholder="Temp °F" value={vitalsForm.temp} onChange={(e)=>setVitalsForm({...vitalsForm, temp:e.target.value})} />
              <input className="px-2 py-1 border rounded text-sm" placeholder="BP" value={vitalsForm.blood_pressure} onChange={(e)=>setVitalsForm({...vitalsForm, blood_pressure:e.target.value})} />
              <input className="px-2 py-1 border rounded text-sm" placeholder="Pulse" value={vitalsForm.pulse} onChange={(e)=>setVitalsForm({...vitalsForm, pulse:e.target.value})} />
              <input className="px-2 py-1 border rounded text-sm" placeholder="SpO2" value={vitalsForm.spo2} onChange={(e)=>setVitalsForm({...vitalsForm, spo2:e.target.value})} />
              <input className="px-2 py-1 border rounded text-sm" placeholder="Height (cm)" value={vitalsForm.height} onChange={(e)=>setVitalsForm({...vitalsForm, height:e.target.value})} />
              <input className="px-2 py-1 border rounded text-sm" placeholder="Weight (kg)" value={vitalsForm.weight} onChange={(e)=>setVitalsForm({...vitalsForm, weight:e.target.value})} />
              <div className="md:col-span-6 flex justify-end">
                <button type="submit" className="px-3 py-1.5 text-sm bg-primary text-white rounded">Save Vitals</button>
              </div>
            </form>
          </section>

          <section className="bg-white border rounded shadow-sm p-4 space-y-3">
            <h3 className="font-semibold">Timeline</h3>
            <div className="grid grid-cols-2 gap-3">
              {timeline.slice(0, showAllHistory ? timeline.length : 3).map((t, idx) => (
                <div key={`${t.date}-${idx}`} className="p-3 border rounded bg-slate-50 text-sm relative">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold">{t.date}</p>
                    <button
                      className="text-slate-500 hover:text-slate-700 p-1"
                      onClick={() => {
                        const textToCopy = `${t.date}\nSymptoms: ${t.symptoms.join(', ')}\nDiagnosis: ${t.diagnosis}\nMedications: ${t.meds.join(', ')}`;
                        navigator.clipboard.writeText(textToCopy);
                        addToast('Copied to clipboard', 'success');
                      }}
                      title="Copy visit details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <p>Sx: {t.symptoms.join(', ')}</p>
                  <p>Dx: {t.diagnosis}</p>
                  <p>Mx: {t.meds.join(', ')}</p>
                </div>
              ))}
              {labs.slice(0, showAllHistory ? labs.length : 3).map((lab, idx) => (
                <div key={`lab-${lab.name}-${idx}`} className="p-3 border rounded bg-blue-50 text-sm relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <p className="font-semibold text-blue-900">{lab.date}</p>
                    </div>
                    {/* Lab share buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        title="Share Lab Report via WhatsApp"
                        onClick={() => {
                          if (!patient?.phone) { addToast('Patient phone not available', 'error'); return; }
                          const lh = shareWithLetterhead ? '&with_letterhead=1' : '';
                          const reportGroup = lab.report_group ? `?report_group=${encodeURIComponent(lab.report_group)}${lh}` : (lh ? `?${lh.slice(1)}` : '');
                          const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/lab-report/${id}${reportGroup}`;
                          const msg = `Hello ${patient.name},\n\nYour lab report is ready.\nView/Download: ${pdfUrl}`;
                          openWhatsApp(patient.phone, msg);
                        }}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                      <button
                        title="Copy Lab Report PDF Link"
                        onClick={() => {
                          const lh = shareWithLetterhead ? '&with_letterhead=1' : '';
                          const reportGroup = lab.report_group ? `?report_group=${encodeURIComponent(lab.report_group)}${lh}` : (lh ? `?${lh.slice(1)}` : '');
                          const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/lab-report/${id}${reportGroup}`;
                          navigator.clipboard.writeText(pdfUrl).then(() => addToast('Lab report link copied', 'success'));
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-200 rounded"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-blue-800 font-medium">{lab.name}</p>
                  <p className="text-blue-700">Result: <span className="font-semibold">{lab.reading} {lab.unit || ''}</span></p>
                </div>
              ))}
            </div>
            {(timeline.length > 3 || labs.length > 3) && (
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-sm text-primary hover:underline"
              >
                {showAllHistory ? 'Show less' : 'Show more'}
              </button>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {/* Vitals from Last Prescription - Show always if prescription exists */}
          {lastPrescription && (
            <div className="bg-white border rounded shadow-sm p-4">
              <h3 className="font-semibold mb-3">Vitals (from Last Visit)</h3>
              <div className="text-xs text-slate-500 mb-3 pb-3 border-b">
                {new Date(lastPrescription.created_at).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })}
                {lastPrescription.doctor_name && <span className="ml-2">• Dr. {lastPrescription.doctor_name}</span>}
              </div>
              {lastPrescription.vitals && Object.keys(lastPrescription.vitals).some(k => lastPrescription.vitals[k]) ? (
                <div className="grid grid-cols-2 gap-3">
                  {lastPrescription.vitals.temp && (
                    <div className="p-2 bg-red-50 rounded">
                      <div className="text-xs text-slate-600">Temperature</div>
                      <div className="font-semibold text-red-700">{lastPrescription.vitals.temp}°F</div>
                    </div>
                  )}
                  {lastPrescription.vitals.blood_pressure && (
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-xs text-slate-600">Blood Pressure</div>
                      <div className="font-semibold text-blue-700">{lastPrescription.vitals.blood_pressure}</div>
                    </div>
                  )}
                  {lastPrescription.vitals.pulse && (
                    <div className="p-2 bg-orange-50 rounded">
                      <div className="text-xs text-slate-600">Pulse</div>
                      <div className="font-semibold text-orange-700">{lastPrescription.vitals.pulse} bpm</div>
                    </div>
                  )}
                  {lastPrescription.vitals.spo2 && (
                    <div className="p-2 bg-cyan-50 rounded">
                      <div className="text-xs text-slate-600">SpO2</div>
                      <div className="font-semibold text-cyan-700">{lastPrescription.vitals.spo2}%</div>
                    </div>
                  )}
                  {lastPrescription.vitals.weight && (
                    <div className="p-2 bg-green-50 rounded">
                      <div className="text-xs text-slate-600">Weight</div>
                      <div className="font-semibold text-green-700">{lastPrescription.vitals.weight} kg</div>
                    </div>
                  )}
                  {lastPrescription.vitals.height && (
                    <div className="p-2 bg-purple-50 rounded">
                      <div className="text-xs text-slate-600">Height</div>
                      <div className="font-semibold text-purple-700">{lastPrescription.vitals.height} cm</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded">
                  No vitals recorded for last visit
                </div>
              )}
            </div>
          )}

          {/* Last Prescription - Click to view full prescription */}
          {lastPrescription && (
            <div
              className="bg-white border rounded shadow-sm p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => {
                setSelectedVisit(lastPrescription);
                setShowPrescriptionModal(true);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Last Prescription</h3>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="text-xs text-slate-500 mb-3 pb-3 border-b">
                {new Date(lastPrescription.created_at).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })}
                {lastPrescription.doctor_name && <span className="ml-2">• Dr. {lastPrescription.doctor_name}</span>}
              </div>
              <div className="space-y-2 text-sm">
                {/* Symptoms */}
                {lastPrescription.symptoms && lastPrescription.symptoms.length > 0 && (
                  <div>
                    <span className="font-medium text-slate-600">Sx:</span> <span className="text-slate-800">{lastPrescription.symptoms.slice(0, 3).map(s => cleanReasonForVisit(s)).join(', ')}{lastPrescription.symptoms.length > 3 ? '…' : ''}</span>
                  </div>
                )}

                {/* Diagnoses */}
                {lastPrescription.diagnoses && lastPrescription.diagnoses.length > 0 && (
                  <div>
                    <span className="font-medium text-slate-600">Dx:</span> <span className="text-slate-800">{lastPrescription.diagnoses.slice(0, 3).map(d => cleanReasonForVisit(d)).join(', ')}{lastPrescription.diagnoses.length > 3 ? '…' : ''}</span>
                  </div>
                )}

                {/* Medications */}
                {lastPrescription.medications && lastPrescription.medications.length > 0 && (
                  <div>
                    <span className="font-medium text-slate-600">Rx:</span> <span className="text-slate-800">{lastPrescription.medications.length} medication(s)</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-primary mt-3 font-medium">Click to view full prescription →</div>
            </div>
          )}
          <div className="bg-white border rounded shadow-sm p-4">
            <h3 className="font-semibold mb-3">History & Private Notes</h3>

            <div className="flex border-b mb-4">
              {[
                { key: 'P', label: 'Past Visits' },
                { key: 'H', label: 'History' },
                { key: 'V', label: 'Vitals' },
                { key: 'R', label: 'Records' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {activeTab === 'P' && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recent Visits & Prescriptions</h4>
                  {prescriptions.length === 0 && (
                    <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">
                      No previous visits found
                    </div>
                  )}
                  {(() => {
                    const visibleRx = prescriptions.slice(0, showAllHistory ? prescriptions.length : 5);
                    // Group by date
                    const grouped = {};
                    visibleRx.forEach(presc => {
                      const dateKey = new Date(presc.created_at).toLocaleDateString('en-IN');
                      if (!grouped[dateKey]) grouped[dateKey] = [];
                      grouped[dateKey].push(presc);
                    });
                    return Object.entries(grouped).map(([date, rxList]) => (
                      <div key={date} className="mb-3">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1 px-1">{date}</div>
                        {rxList.map((presc, idx) => (
                          <div
                            key={idx}
                            className="text-xs p-3 bg-slate-50 hover:bg-slate-100 border rounded mb-2 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedVisit(presc);
                              setShowPrescriptionModal(true);
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-800">Dr. {presc.doctor_name || 'N/A'}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeletePrescription(presc);
                                }}
                                className="text-[11px] px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                                title="Delete"
                              >
                                Delete
                              </button>
                            </div>
                            {presc.diagnoses && presc.diagnoses.length > 0 && (
                              <div className="text-slate-600 mb-1">
                                <span className="font-medium">Dx:</span> {presc.diagnoses.slice(0, 3).map(d => cleanReasonForVisit(d)).join(', ')}
                                {presc.diagnoses.length > 3 && '...'}
                              </div>
                            )}
                            {presc.medications && presc.medications.length > 0 && (
                              <div className="text-slate-600">
                                <span className="font-medium">Rx:</span> {presc.medications.map(m => m.medication_name || m.medicine_name || m.name || '').filter(Boolean).slice(0, 3).join(', ')}
                                {presc.medications.length > 3 && ` +${presc.medications.length - 3} more`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                  {prescriptions.length > 5 && (
                    <button
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="text-xs text-primary hover:underline mt-2 w-full text-center"
                    >
                      {showAllHistory ? 'Show less' : `Show all ${prescriptions.length} visits`}
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'H' && (
                <div className="space-y-4">
                  {/* Medical Conditions */}
                  {patient?.medical_conditions && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-800 mb-2">Medical Conditions</h4>
                      <div className="text-xs p-2 bg-orange-50 border border-orange-200 rounded text-orange-900 whitespace-pre-wrap">
                        {patient.medical_conditions}
                      </div>
                    </div>
                  )}

                  {/* Allergies */}
                  {patient?.allergies && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-800 mb-2">Allergies</h4>
                      <div className="text-xs p-2 bg-red-50 border border-red-200 rounded text-red-900 whitespace-pre-wrap">
                        {patient.allergies}
                      </div>
                    </div>
                  )}

                  {/* Current Medications */}
                  {patient?.current_medications && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-800 mb-2">Current Medications</h4>
                      <div className="text-xs p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 whitespace-pre-wrap">
                        {patient.current_medications}
                      </div>
                    </div>
                  )}

                  {!patient?.medical_conditions && !patient?.allergies && !patient?.current_medications && (
                    <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">
                      No medical history recorded. Edit patient to add.
                    </div>
                  )}

                  {/* Structured: Existing Conditions */}
                  {structuredMedHistory.existingConditions?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-800 mb-2">Existing Conditions</h4>
                      <div className="flex flex-wrap gap-2">
                        {structuredMedHistory.existingConditions.map((c, i) => (
                          <span key={c.id || i} className="px-2 py-1 bg-orange-50 border border-orange-200 text-orange-800 rounded text-xs">
                            {c.condition_name}{c.status ? ` (${c.status})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structured: Surgical History */}
                  {structuredMedHistory.surgicalHistory?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-800 mb-2">Surgical History</h4>
                      <div className="space-y-1">
                        {structuredMedHistory.surgicalHistory.map((s, i) => (
                          <div key={s.id || i} className="text-xs p-2 bg-slate-50 border rounded">
                            <span className="font-medium">{s.surgery_name || s.procedure_name}</span>
                            {s.surgery_date && <span className="text-slate-500 ml-2">{new Date(s.surgery_date).toLocaleDateString('en-IN')}</span>}
                            {s.hospital && <span className="text-slate-500 ml-2">• {s.hospital}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Family History */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-slate-800">Family History</h4>
                      <button
                        onClick={() => navigate(`/family-history/${id}`, { state: { returnTo: `/patient-overview/${id}` } })}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Manage →
                      </button>
                    </div>
                    {familyHistory.length === 0 ? (
                      <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">
                        No family history recorded
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {familyHistory.map((fh, idx) => (
                          <div key={fh.id || idx} className="text-xs p-2 bg-teal-50 border border-teal-200 rounded">
                            <div className="flex items-start gap-2">
                              <svg className="w-3 h-3 mt-0.5 text-teal-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                              </svg>
                              <div className="flex-1">
                                <div className="font-semibold text-teal-900 capitalize">{fh.relation}</div>
                                <div className="text-teal-800">{fh.condition}</div>
                                {fh.notes && (
                                  <div className="text-teal-600 mt-1 italic">{fh.notes}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Insurance Link */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-slate-800">Insurance</h4>
                      <button
                        onClick={() => navigate(`/insurance/${id}`, { state: { returnTo: `/patient-overview/${id}` } })}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Manage →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'V' && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Latest Vitals</h4>
                  {getVitalsDisplay().slice(0, 4).map((vital, idx) => (
                    <div key={idx} className="text-xs text-slate-600 flex justify-between">
                      <span>{vital.label}:</span>
                      <span className={vital.color}>
                        {vital.value} {vital.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'R' && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recent Records</h4>
                  {records.length === 0 ? (
                    <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">
                      No records found
                    </div>
                  ) : (
                    records.slice(0, 5).map((record, idx) => (
                      <div key={idx} className="text-xs p-2 bg-slate-50 hover:bg-slate-100 border rounded mb-2 transition-colors">
                        <div className="font-medium text-slate-800 mb-1">{record.name}</div>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded ${getCategoryBadgeColor(record.category)}`}>
                            {record.category}
                          </span>
                          <span className="text-slate-500">{record.date}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Prescription Details Modal */}
      {showPrescriptionModal && selectedVisit && (
        <Modal
          isOpen={showPrescriptionModal}
          onClose={() => {
            setShowPrescriptionModal(false);
            setSelectedVisit(null);
          }}
          title={`Prescription - ${new Date(selectedVisit.created_at).toLocaleDateString('en-IN')}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Visit Info */}
            <div className="bg-slate-50 p-4 rounded">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Doctor:</span>
                  <span className="ml-2 font-medium">{selectedVisit.doctor_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Date:</span>
                  <span className="ml-2 font-medium">
                    {new Date(selectedVisit.created_at).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Vitals */}
            {selectedVisit.vitals && Object.keys(selectedVisit.vitals).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Vitals</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {selectedVisit.vitals.temp && (
                    <div className="p-2 bg-red-50 rounded">
                      <div className="text-xs text-slate-600">Temperature</div>
                      <div className="font-semibold text-red-700">{selectedVisit.vitals.temp}°F</div>
                    </div>
                  )}
                  {selectedVisit.vitals.blood_pressure && (
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-xs text-slate-600">BP</div>
                      <div className="font-semibold text-blue-700">{selectedVisit.vitals.blood_pressure}</div>
                    </div>
                  )}
                  {selectedVisit.vitals.pulse && (
                    <div className="p-2 bg-orange-50 rounded">
                      <div className="text-xs text-slate-600">Pulse</div>
                      <div className="font-semibold text-orange-700">{selectedVisit.vitals.pulse} bpm</div>
                    </div>
                  )}
                  {selectedVisit.vitals.weight && (
                    <div className="p-2 bg-green-50 rounded">
                      <div className="text-xs text-slate-600">Weight</div>
                      <div className="font-semibold text-green-700">{selectedVisit.vitals.weight} kg</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Symptoms */}
            {selectedVisit.symptoms && selectedVisit.symptoms.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Symptoms (Sx)</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedVisit.symptoms.map((symptom, idx) => (
                    <span key={idx} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnoses */}
            {selectedVisit.diagnoses && selectedVisit.diagnoses.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Diagnosis (Dx)</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedVisit.diagnoses.map((diagnosis, idx) => (
                    <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      {diagnosis}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {selectedVisit.medications && selectedVisit.medications.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Medications (Rx)</h4>
                <div className="border rounded divide-y">
                  {selectedVisit.medications.map((med, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50">
                      <div className="font-medium text-sm mb-1">{med.medication_name || med.medicine_name || med.name || med.brand || 'Unknown'}</div>
                      {med.generic_name && (
                        <div className="text-xs text-slate-500 mb-1">{med.generic_name}</div>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {med.dosage && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {med.dosage}
                          </span>
                        )}
                        {med.frequency && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {med.frequency}
                          </span>
                        )}
                        {med.timing && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                            {med.timing}
                          </span>
                        )}
                        {med.duration && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                            {med.duration}
                          </span>
                        )}
                        {med.quantity > 0 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            Qty: {med.quantity}
                          </span>
                        )}
                      </div>
                      {med.instructions && (
                        <div className="text-xs text-slate-600 mt-1 italic">{med.instructions}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advice */}
            {selectedVisit.advice && (
              <div>
                <h4 className="font-semibold mb-2">Advice</h4>
                <div className="p-3 bg-blue-50 rounded text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedVisit.advice}
                </div>
              </div>
            )}

            {/* Follow-up */}
            {selectedVisit.follow_up_date && (
              <div>
                <h4 className="font-semibold mb-2">Follow-up</h4>
                <div className="p-3 bg-green-50 rounded text-sm">
                  <span className="font-medium text-green-800">
                    {new Date(selectedVisit.follow_up_date).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t flex-wrap">
              {/* Copy All to New Prescription */}
              <button
                onClick={() => {
                  const rxData = {
                    symptoms: selectedVisit.symptoms || [],
                    diagnoses: selectedVisit.diagnoses || [],
                    medications: (selectedVisit.medications || []).map(m => ({
                      name: m.medication_name || m.medicine_name || m.name || '',
                      brand: m.medication_name || m.medicine_name || m.name || '',
                      dosage: m.dosage || '',
                      frequency: m.frequency || '',
                      timing: m.timing || '',
                      duration: m.duration || '',
                      instructions: m.instructions || '',
                      qty: m.quantity || 0,
                      is_tapering: m.is_tapering || 0,
                      tapering_schedule: m.tapering_schedule || []
                    })),
                    advice: selectedVisit.advice || '',
                    follow_up_days: selectedVisit.follow_up_days || '',
                    patient_notes: selectedVisit.patient_notes || '',
                    custom_fields: selectedVisit.custom_fields || null
                  };
                  sessionStorage.setItem('copyPrescription', JSON.stringify(rxData));
                  navigate(`/orders/${id}?copy=true`);
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
              >
                Copy All
              </button>
              {/* Copy only Medications */}
              {selectedVisit.medications && selectedVisit.medications.length > 0 && (
                <button
                  onClick={() => {
                    const existing = JSON.parse(sessionStorage.getItem('copyPrescription') || '{}');
                    const rxData = {
                      ...existing,
                      medications: (selectedVisit.medications || []).map(m => ({
                        name: m.medication_name || m.medicine_name || m.name || '',
                        brand: m.medication_name || m.medicine_name || m.name || '',
                        dosage: m.dosage || '',
                        frequency: m.frequency || '',
                        timing: m.timing || '',
                        duration: m.duration || '',
                        instructions: m.instructions || '',
                        qty: m.quantity || 0,
                        is_tapering: m.is_tapering || 0,
                        tapering_schedule: m.tapering_schedule || []
                      }))
                    };
                    sessionStorage.setItem('copyPrescription', JSON.stringify(rxData));
                    addToast('Medications copied - click Copy All or go to Rx pad', 'success');
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                >
                  Copy Rx
                </button>
              )}
              {/* Copy only Symptoms */}
              {selectedVisit.symptoms && selectedVisit.symptoms.length > 0 && (
                <button
                  onClick={() => {
                    const existing = JSON.parse(sessionStorage.getItem('copyPrescription') || '{}');
                    const rxData = { ...existing, symptoms: selectedVisit.symptoms || [] };
                    sessionStorage.setItem('copyPrescription', JSON.stringify(rxData));
                    addToast('Symptoms copied - click Copy All or go to Rx pad', 'success');
                  }}
                  className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs font-medium"
                >
                  Copy Sx
                </button>
              )}
              {/* Copy only Diagnosis */}
              {selectedVisit.diagnoses && selectedVisit.diagnoses.length > 0 && (
                <button
                  onClick={() => {
                    const existing = JSON.parse(sessionStorage.getItem('copyPrescription') || '{}');
                    const rxData = { ...existing, diagnoses: selectedVisit.diagnoses || [] };
                    sessionStorage.setItem('copyPrescription', JSON.stringify(rxData));
                    addToast('Diagnosis copied - click Copy All or go to Rx pad', 'success');
                  }}
                  className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-medium"
                >
                  Copy Dx
                </button>
              )}
              {/* Open Rx Pad with copied data */}
              <button
                onClick={() => {
                  const existing = sessionStorage.getItem('copyPrescription');
                  if (existing) {
                    navigate(`/orders/${id}?copy=true`);
                  } else {
                    addToast('No data copied yet. Use Copy Rx/Sx/Dx first.', 'info');
                  }
                }}
                className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-medium"
              >
                Open Rx Pad
              </button>
              {/* Letterhead toggle for sharing */}
              <label className="flex items-center gap-1.5 px-3 py-2 border rounded bg-slate-50 cursor-pointer text-xs text-slate-700 select-none" title="Include clinic header & footer in shared PDF">
                <input
                  type="checkbox"
                  checked={shareWithLetterhead}
                  onChange={e => setShareWithLetterhead(e.target.checked)}
                  className="cursor-pointer"
                />
                With Letterhead
              </label>
              <button
                onClick={() => {
                  const lh = shareWithLetterhead ? '?with_letterhead=1' : '';
                  const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${selectedVisit.id}${lh}`;
                  navigator.clipboard.writeText(pdfUrl).then(() => addToast('PDF link copied', 'success'));
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
              >
                Copy PDF Link
              </button>
              <button
                onClick={() => {
                  const lh = shareWithLetterhead ? '?with_letterhead=1' : '';
                  const link = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${selectedVisit.id}${lh}`;
                  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
                  window.open(qr, '_blank');
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
              >
                Show QR
              </button>
              <button
                onClick={() => {
                  if (!patient?.phone) { addToast('Patient phone not available', 'error'); return; }
                  const lh = shareWithLetterhead ? '?with_letterhead=1' : '';
                  const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${selectedVisit.id}${lh}`;
                  const msg = `Hello ${patient.name},\n\nYour prescription from Dr. is ready.\nView/Download PDF: ${pdfUrl}`;
                  openWhatsApp(patient.phone, msg);
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
              >
                Share via WhatsApp
              </button>
              <button
                onClick={() => {
                  const lh = shareWithLetterhead ? '?with_letterhead=1' : '';
                  const link = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${selectedVisit.id}${lh}`;
                  const subj = encodeURIComponent('Your Prescription PDF');
                  const body = encodeURIComponent(`Dear ${patient.name},\n\nYour prescription PDF: ${link}\n\nRegards`);
                  window.location.href = `mailto:${patient.email || ''}?subject=${subj}&body=${body}`;
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
              >
                Share via Email
              </button>
              {/* Bill share */}
              <button
                onClick={handleShareLatestBillWhatsApp}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                title="Send latest bill PDF via WhatsApp"
              >
                Share Bill on WhatsApp
              </button>
              <div className="flex-1" />
              <button
                onClick={() => {
                  setShowPrescriptionModal(false);
                  setSelectedVisit(null);
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigate(`/prescription-preview/${id}`, {
                    state: { prescription: selectedVisit }
                  });
                }}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                View Full Prescription
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Surgery Modal */}
      {showAddSurgeryModal && (
        <Modal
          isOpen={showAddSurgeryModal}
          onClose={() => {
            setShowAddSurgeryModal(false);
            setNewSurgery({ procedure: '', date: '', notes: '' });
          }}
          title="Add Surgical Procedure"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Procedure Name *
              </label>
              <input
                type="text"
                placeholder="e.g., Appendectomy, Cesarean Section"
                value={newSurgery.procedure}
                onChange={(e) => setNewSurgery({ ...newSurgery, procedure: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date of Surgery *
              </label>
              <input
                type="date"
                value={newSurgery.date}
                onChange={(e) => setNewSurgery({ ...newSurgery, date: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Additional Notes (Optional)
              </label>
              <textarea
                placeholder="Hospital, surgeon name, complications, recovery notes..."
                value={newSurgery.notes}
                onChange={(e) => setNewSurgery({ ...newSurgery, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAddSurgeryModal(false);
                  setNewSurgery({ procedure: '', date: '', notes: '' });
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSurgery}
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                Add Surgery
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Record Modal */}
      {/* Add Lab Result Modal with Template Selection & Parameter Forms */}
      {showLabUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {labParamFormTest ? `Fill Results: ${labParamFormTest.test_name}` : 'Add Lab Result'}
              </h2>
              <button onClick={() => { setShowLabUploadModal(false); setLabParamFormTest(null); setLabParamFormData([]); setLabSearchQuery(''); }} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Parameter Form View */}
            {labParamFormTest ? (
              <>
                <div className="overflow-y-auto flex-1 p-4">
                  <div className="mb-3 p-3 bg-purple-50 rounded-lg">
                    <div className="text-sm font-semibold text-purple-800">{labParamFormTest.test_name}</div>
                    <div className="text-xs text-purple-600">{labParamFormTest.category} | Sample: {labParamFormTest.sample_type || 'Blood'}</div>
                  </div>
                  {labParamLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading parameters...</div>
                  ) : labParamFormData.length > 0 ? (
                    <div className="border rounded overflow-hidden">
                      <div className="grid grid-cols-12 bg-gray-100 text-xs font-semibold text-gray-700 px-3 py-2 gap-2">
                        <span className="col-span-4">Parameter</span>
                        <span className="col-span-3">Result Value</span>
                        <span className="col-span-2">Unit</span>
                        <span className="col-span-3">Reference Range</span>
                      </div>
                      {labParamFormData.map((param, idx) => (
                        <div key={idx} className="grid grid-cols-12 px-3 py-2 text-sm border-t items-center gap-2">
                          <div className="col-span-4">
                            <div className="text-xs font-medium">{param.parameter_name}</div>
                            {param.short_name && param.short_name !== param.parameter_name && (
                              <div className="text-[10px] text-gray-400">{param.short_name}</div>
                            )}
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              className="w-full px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                              placeholder="Enter value"
                              value={param.result_value || ''}
                              onChange={(e) => {
                                const updated = [...labParamFormData];
                                updated[idx].result_value = e.target.value;
                                setLabParamFormData(updated);
                              }}
                            />
                          </div>
                          <span className="col-span-2 text-xs text-gray-500">{param.unit || '-'}</span>
                          <span className="col-span-3 text-xs text-gray-500">{param.reference_range || '-'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-gray-500 text-sm">No predefined parameters for this test. Enter result manually:</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Result Value</label>
                          <input type="text" className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., 110"
                            value={labUploadForm.reading} onChange={(e) => setLabUploadForm(prev => ({ ...prev, reading: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                          <input type="text" className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., mg/dL"
                            value={labUploadForm.unit} onChange={(e) => setLabUploadForm(prev => ({ ...prev, unit: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Reference Range</label>
                          <input type="text" className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., 70-100"
                            value={labUploadForm.reference_range} onChange={(e) => setLabUploadForm(prev => ({ ...prev, reference_range: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                          <input type="date" className="w-full px-3 py-2 border rounded text-sm"
                            value={labUploadForm.date} onChange={(e) => setLabUploadForm(prev => ({ ...prev, date: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                        <textarea className="w-full px-3 py-2 border rounded text-sm" rows={2} placeholder="Optional notes..."
                          value={labUploadForm.notes} onChange={(e) => setLabUploadForm(prev => ({ ...prev, notes: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between gap-3 p-4 border-t bg-gray-50">
                  <button type="button" onClick={() => { setLabParamFormTest(null); setLabParamFormData([]); }}
                    className="px-4 py-2 border rounded hover:bg-gray-100 text-sm">← Back to Tests</button>
                  <button type="button" disabled={labUploadLoading}
                    onClick={async () => {
                      setLabUploadLoading(true);
                      try {
                        if (labParamFormData.length > 0) {
                          // Save each parameter as separate lab result
                          const filledParams = labParamFormData.filter(p => p.result_value);
                          for (const p of filledParams) {
                            await api.post(`/api/labs/${id}`, {
                              test_name: `${labParamFormTest.test_name} - ${p.parameter_name}`,
                              result_value: p.result_value,
                              result_unit: p.unit || '',
                              reference_range: p.reference_range || '',
                              result_date: getLocalDateString(),
                              notes: `Panel: ${labParamFormTest.test_name}`,
                              status: 'completed'
                            });
                          }
                          addToast(`${filledParams.length} results added for ${labParamFormTest.test_name}`, 'success');
                        } else {
                          await api.post(`/api/labs/${id}`, {
                            test_name: labParamFormTest.test_name,
                            result_value: labUploadForm.reading,
                            result_unit: labUploadForm.unit || labParamFormTest.unit || '',
                            reference_range: labUploadForm.reference_range || labParamFormTest.reference_range || '',
                            result_date: labUploadForm.date,
                            notes: labUploadForm.notes,
                            status: 'completed'
                          });
                          addToast('Lab result added', 'success');
                        }
                        setShowLabUploadModal(false);
                        setLabParamFormTest(null);
                        setLabParamFormData([]);
                        setLabUploadForm({ test_name: '', reading: '', unit: '', date: getLocalDateString(), notes: '', reference_range: '' });
                        fetchPatientData();
                      } catch (error) {
                        console.error('Error adding lab result:', error);
                        addToast(error.response?.data?.error || 'Failed to add lab result', 'error');
                      } finally {
                        setLabUploadLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm">
                    {labUploadLoading ? 'Adding...' : 'Save Results'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Search and Template Selection */}
                <div className="p-3 border-b space-y-2 relative overflow-visible">
                  <div className="relative overflow-visible">
                    <input type="text" className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                      placeholder="Search lab tests by name or code..." value={labSearchQuery}
                      autoComplete="off"
                      onChange={(e) => setLabSearchQuery(e.target.value)} />
                    
                    {/* Search Results Dropdown */}
                    {labSearchQuery && (
                      <div className="absolute top-full left-0 right-0 mt-1 border rounded bg-white shadow-lg z-50 max-h-64 overflow-y-auto">
                        {labTemplates
                          .filter(t => !selectedLabCategory || t.category === selectedLabCategory)
                          .filter(t => t.test_name.toLowerCase().includes(labSearchQuery.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labSearchQuery.toLowerCase())))
                          .slice(0, 50)
                          .map(t => (
                            <button key={t.id} type="button"
                              onClick={async () => {
                                setLabParamLoading(true);
                                setLabParamFormTest(t);
                                setLabUploadForm(prev => ({ ...prev, test_name: t.test_name, unit: t.unit || '', reference_range: t.reference_range || '' }));
                                setLabSearchQuery('');
                                try {
                                  const res = await api.get(`/api/lab-templates/${t.id}/parameters`);
                                  const params = res.data.parameters || [];
                                  setLabParamFormData(params.map(p => ({ ...p, result_value: '' })));
                                } catch (err) {
                                  console.error('Failed to fetch parameters:', err);
                                  setLabParamFormData([]);
                                }
                                setLabParamLoading(false);
                                setShowLabUploadModal(true);
                              }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-purple-100 transition"
                            >
                              <div className="font-medium text-xs">{t.test_name}</div>
                              <div className="text-[10px] text-gray-500">
                                {t.category && <span className="text-purple-600">{t.category}</span>}
                                {t.sample_type && <span> · {t.sample_type}</span>}
                              </div>
                            </button>
                          ))}
                        {labTemplates.filter(t => !selectedLabCategory || t.category === selectedLabCategory).filter(t => t.test_name.toLowerCase().includes(labSearchQuery.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labSearchQuery.toLowerCase()))).length === 0 && (
                          <div className="px-3 py-3 text-sm text-gray-500 text-center">No tests found</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => setSelectedLabCategory('')}
                      className={`px-2 py-0.5 text-[10px] rounded-full border ${!selectedLabCategory ? 'bg-purple-600 text-white' : 'bg-white'}`}>All</button>
                    {labTemplateCategories.map(cat => (
                      <button key={cat} type="button" onClick={() => setSelectedLabCategory(cat)}
                        className={`px-2 py-0.5 text-[10px] rounded-full border ${selectedLabCategory === cat ? 'bg-purple-600 text-white' : 'bg-white'}`}>{cat}</button>
                    ))}
                  </div>
                </div>

                {/* Grid display when no search is active */}
                {!labSearchQuery && (
                  <div className="overflow-y-auto flex-1 p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {labTemplates
                        .filter(t => !selectedLabCategory || t.category === selectedLabCategory)
                        .slice(0, 150)
                        .map(t => (
                          <button key={t.id} type="button"
                            onClick={async () => {
                              setLabParamLoading(true);
                              setLabParamFormTest(t);
                              setLabUploadForm(prev => ({ ...prev, test_name: t.test_name, unit: t.unit || '', reference_range: t.reference_range || '' }));
                              try {
                                const res = await api.get(`/api/lab-templates/${t.id}/parameters`);
                                const params = res.data.parameters || [];
                                setLabParamFormData(params.map(p => ({ ...p, result_value: '' })));
                              } catch (err) {
                                console.error('Failed to fetch parameters:', err);
                                setLabParamFormData([]);
                              }
                              setLabParamLoading(false);
                              setShowLabUploadModal(true);
                            }}
                            className="text-left p-2 border rounded text-sm hover:bg-purple-50 hover:border-purple-300 transition"
                          >
                            <div className="font-medium text-xs">{t.test_name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {t.category && <span className="text-purple-600">{t.category}</span>}
                              {t.sample_type && <span> · {t.sample_type}</span>}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                {/* Manual entry option */}
                <div className="p-3 border-t bg-gray-50">
                  <form onSubmit={handleAddLabResult} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Or enter manually:</label>
                      <input type="text" className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Test name"
                        value={labUploadForm.test_name} onChange={(e) => setLabUploadForm(prev => ({ ...prev, test_name: e.target.value }))} required />
                    </div>
                    <input type="text" className="w-20 px-2 py-1.5 border rounded text-xs" placeholder="Value"
                      value={labUploadForm.reading} onChange={(e) => setLabUploadForm(prev => ({ ...prev, reading: e.target.value }))} required />
                    <input type="text" className="w-16 px-2 py-1.5 border rounded text-xs" placeholder="Unit"
                      value={labUploadForm.unit} onChange={(e) => setLabUploadForm(prev => ({ ...prev, unit: e.target.value }))} />
                    <button type="submit" disabled={labUploadLoading} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                      {labUploadLoading ? '...' : 'Add'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showUploadRecordModal && (
        <Modal
          isOpen={showUploadRecordModal}
          onClose={() => {
            setShowUploadRecordModal(false);
            setUploadForm({ name: '', category: 'OTHERS', description: '', file: null });
          }}
          title="Upload Medical Record"
        >
          <form onSubmit={handleUploadRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Record Name *
              </label>
              <input
                type="text"
                placeholder="e.g., Blood Test Report, X-Ray, MRI Scan"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="BLOOD_TEST">🩸 Blood Test</option>
                <option value="REPORT">Lab Report</option>
                <option value="PRESCRIPTION">Prescription</option>
                <option value="XRAY">X-Ray</option>
                <option value="MRI">MRI</option>
                <option value="OTHERS">Others</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                File * <span className="text-xs text-green-600 font-normal">(Image/PDF → auto scan)</span>
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                JPG, PNG, PDF → Lab values auto extract | DOC, XLS → Manual entry (Max 10MB)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                placeholder="Add any additional notes or description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowUploadRecordModal(false);
                  setUploadForm({ name: '', category: 'OTHERS', description: '', file: null });
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
                disabled={uploadLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                disabled={uploadLoading}
              >
                {uploadLoading ? 'Uploading...' : 'Upload Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manual Record Modal */}
      {showManualRecordModal && (
        <Modal
          isOpen={showManualRecordModal}
          onClose={() => {
            setShowManualRecordModal(false);
            setManualRecordForm({ name: '', category: 'OTHERS', description: '', date: getLocalDateString() });
          }}
          title="Add Medical Record"
        >
          <form onSubmit={handleManualRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Record Name *
              </label>
              <input
                type="text"
                placeholder="e.g., Consultation Notes, Diagnosis, Treatment Plan"
                value={manualRecordForm.name}
                onChange={(e) => setManualRecordForm({ ...manualRecordForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={manualRecordForm.category}
                onChange={(e) => setManualRecordForm({ ...manualRecordForm, category: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="PRESCRIPTION">Prescription</option>
                <option value="REPORT">Report</option>
                <option value="XRAY">X-Ray</option>
                <option value="MRI">MRI</option>
                <option value="BLOOD_TEST">Blood Test</option>
                <option value="OTHERS">Others</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={manualRecordForm.date}
                onChange={(e) => setManualRecordForm({ ...manualRecordForm, date: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description *
              </label>
              <textarea
                placeholder="Enter record details, findings, or notes"
                value={manualRecordForm.description}
                onChange={(e) => setManualRecordForm({ ...manualRecordForm, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                required
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowManualRecordModal(false);
                  setManualRecordForm({ name: '', category: 'OTHERS', description: '', date: getLocalDateString() });
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
                disabled={uploadLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                disabled={uploadLoading}
              >
                {uploadLoading ? 'Creating...' : 'Create Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Patient Modal */}
      {showEditPatientModal && (
        <Modal
          isOpen={showEditPatientModal}
          onClose={() => setShowEditPatientModal(false)}
          title="Edit Patient Information"
          size="lg"
        >
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editForm.useAgeInput ? 'Age (Years)' : 'Date of Birth'}
                </label>
                <div className="flex gap-2">
                  {editForm.useAgeInput ? (
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={editForm.age}
                      onChange={(e) => {
                        const age = e.target.value;
                        const calculatedDob = calculateDobFromAge(age);
                        setEditForm({ ...editForm, age, dob: calculatedDob });
                      }}
                      placeholder="Enter age"
                      className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  ) : (
                    <input
                      type="date"
                      value={editForm.dob ? getLocalDateString(new Date(editForm.dob)) : ''}
                      onChange={(e) => {
                        const dob = e.target.value;
                        const calculatedAge = calculateAgeFromDob(dob);
                        setEditForm({ ...editForm, dob, age: calculatedAge });
                      }}
                      className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, useAgeInput: !editForm.useAgeInput })}
                    className="px-3 py-2 border rounded hover:bg-slate-50 text-sm whitespace-nowrap"
                    title={editForm.useAgeInput ? 'Switch to Date of Birth' : 'Switch to Age'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                </div>
                {editForm.dob && (
                  <div className="mt-1 text-xs text-slate-500">
                    {editForm.useAgeInput ? `DOB: ${new Date(editForm.dob).toLocaleDateString('en-IN')}` : `Age: ${calculateAge(editForm.dob)} years`}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                <select
                  value={editForm.blood_group}
                  onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
                <input
                  type="text"
                  value={editForm.pincode}
                  onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={editForm.emergency_contact}
                  onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={editForm.emergency_phone}
                  onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Medical Conditions</label>
                <textarea
                  value={editForm.medical_conditions}
                  onChange={(e) => setEditForm({ ...editForm, medical_conditions: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Allergies</label>
                <textarea
                  value={editForm.allergies}
                  onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Medications</label>
                <textarea
                  value={editForm.current_medications}
                  onChange={(e) => setEditForm({ ...editForm, current_medications: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">UHID (Optional)</label>
                <input
                  type="text"
                  value={editForm.patient_id}
                  onChange={(e) => setEditForm({ ...editForm, patient_id: e.target.value })}
                  placeholder="Leave blank if not yet created"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => setShowEditPatientModal(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setEditLoading(true);
                  try {
                    const normalizedId = String(id || '').split(':')[0].split('/')[0].trim();
                    const normalizePhone = (p) => {
                      if (!p) return null;
                      const digits = String(p).replace(/\D/g, '');
                      const last10 = digits.slice(-10);
                      return last10.length === 10 ? last10 : null;
                    };
                    const normalizeDob = (d) => {
                      if (!d) return null;
                      const part = String(d).split('T')[0];
                      return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
                    };
                    await api.put(`/api/patients/${normalizedId}`, {
                      name: editForm.name,
                      phone: normalizePhone(editForm.phone),
                      email: editForm.email,
                      dob: normalizeDob(editForm.dob),
                      gender: editForm.gender === 'Male' ? 'M' : editForm.gender === 'Female' ? 'F' : editForm.gender === 'Other' ? 'O' : editForm.gender || null,
                      blood_group: editForm.blood_group,
                      address: editForm.address,
                      city: editForm.city,
                      state: editForm.state,
                      pincode: editForm.pincode,
                      emergency_contact_name: editForm.emergency_contact,
                      emergency_contact_phone: normalizePhone(editForm.emergency_phone),
                      medical_conditions: editForm.medical_conditions,
                      allergies: editForm.allergies,
                      current_medications: editForm.current_medications,
                      patient_id: (editForm.patient_id && String(editForm.patient_id).trim()) || patient.patient_id
                    });
                    addToast('Patient information updated successfully', 'success');
                    setShowEditPatientModal(false);
                    fetchPatientData();
                  } catch (error) {
                    addToast(error.response?.data?.error || 'Failed to update patient', 'error');
                  } finally {
                    setEditLoading(false);
                  }
                }}
                disabled={editLoading}
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Referral Modal */}
      {showReferralModal && (
        <Modal isOpen={showReferralModal} title="Refer Patient to Doctor" onClose={() => setShowReferralModal(false)}>
          <div className="space-y-4 p-2">
            {/* Select from network or enter new */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor from Network</label>
              <select
                className="w-full px-3 py-2 border rounded text-sm"
                value={referralForm.selectedDoctor}
                onChange={(e) => {
                  const docId = e.target.value;
                  if (docId === 'new') {
                    setReferralForm(prev => ({ ...prev, selectedDoctor: 'new', referred_doctor_name: '', referred_doctor_phone: '', referred_doctor_specialization: '', hospital_name: '' }));
                  } else if (docId) {
                    const doc = referralNetwork.find(d => String(d.id) === docId);
                    if (doc) {
                      setReferralForm(prev => ({
                        ...prev,
                        selectedDoctor: docId,
                        referred_doctor_name: doc.network_doctor_name || '',
                        referred_doctor_phone: doc.network_doctor_phone || '',
                        referred_doctor_specialization: doc.specialization || '',
                        hospital_name: doc.hospital_name || ''
                      }));
                    }
                  } else {
                    setReferralForm(prev => ({ ...prev, selectedDoctor: '' }));
                  }
                }}
              >
                <option value="">-- Select Doctor --</option>
                {referralNetwork.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.network_doctor_name}{doc.specialization ? ` (${doc.specialization})` : ''}{doc.hospital_name ? ` - ${doc.hospital_name}` : ''}
                  </option>
                ))}
                <option value="new">+ Add New Doctor</option>
              </select>
            </div>

            {/* Doctor details (editable if new or selected) */}
            {(referralForm.selectedDoctor === 'new' || referralForm.selectedDoctor) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name *</label>
                  <input className="w-full px-3 py-2 border rounded text-sm" value={referralForm.referred_doctor_name}
                    onChange={e => setReferralForm(prev => ({ ...prev, referred_doctor_name: e.target.value }))} placeholder="Dr. Name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input className="w-full px-3 py-2 border rounded text-sm" value={referralForm.referred_doctor_phone}
                    onChange={e => setReferralForm(prev => ({ ...prev, referred_doctor_phone: e.target.value }))} placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Specialization</label>
                  <input className="w-full px-3 py-2 border rounded text-sm" value={referralForm.referred_doctor_specialization}
                    onChange={e => setReferralForm(prev => ({ ...prev, referred_doctor_specialization: e.target.value }))} placeholder="e.g. Cardiologist" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hospital</label>
                  <input className="w-full px-3 py-2 border rounded text-sm" value={referralForm.hospital_name}
                    onChange={e => setReferralForm(prev => ({ ...prev, hospital_name: e.target.value }))} placeholder="Hospital name" />
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Referral *</label>
              <input className="w-full px-3 py-2 border rounded text-sm" value={referralForm.reason}
                onChange={e => setReferralForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="e.g., Further cardiac evaluation" />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="priority" value="routine" checked={referralForm.priority === 'routine'}
                    onChange={() => setReferralForm(prev => ({ ...prev, priority: 'routine' }))} className="accent-blue-600" />
                  <span className="text-sm">Routine</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="priority" value="urgent" checked={referralForm.priority === 'urgent'}
                    onChange={() => setReferralForm(prev => ({ ...prev, priority: 'urgent' }))} className="accent-red-600" />
                  <span className="text-sm text-red-600 font-medium">Urgent</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea className="w-full px-3 py-2 border rounded text-sm" rows={3} value={referralForm.notes}
                onChange={e => setReferralForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes..." />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowReferralModal(false)}
                className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50"
              >Cancel</button>
              <button
                disabled={referralLoading || !referralForm.referred_doctor_name || !referralForm.reason}
                onClick={async () => {
                  setReferralLoading(true);
                  try {
                    await api.post('/api/patient-referrals', {
                      patient_id: parseInt(id),
                      referred_doctor_name: referralForm.referred_doctor_name,
                      referred_doctor_phone: referralForm.referred_doctor_phone,
                      referred_doctor_specialization: referralForm.referred_doctor_specialization,
                      hospital_name: referralForm.hospital_name,
                      referral_date: getLocalDateString(),
                      reason: referralForm.reason,
                      priority: referralForm.priority,
                      notes: referralForm.notes
                    });
                    addToast('Referral saved successfully! You can share via WhatsApp from Doctor Settings > Referrals', 'success');

                    // Also save to network if new doctor
                    if (referralForm.selectedDoctor === 'new' && referralForm.referred_doctor_name) {
                      try {
                        await api.post('/api/patient-referrals/network/doctors', {
                          network_doctor_name: referralForm.referred_doctor_name,
                          network_doctor_phone: referralForm.referred_doctor_phone,
                          specialization: referralForm.referred_doctor_specialization,
                          hospital_name: referralForm.hospital_name
                        });
                      } catch (e) { /* ignore if already exists */ }
                    }

                    setShowReferralModal(false);
                    setReferralForm({ selectedDoctor: '', referred_doctor_name: '', referred_doctor_phone: '', referred_doctor_specialization: '', hospital_name: '', reason: '', priority: 'routine', notes: '' });
                  } catch (err) {
                    addToast(err.response?.data?.error || 'Failed to create referral', 'error');
                  } finally {
                    setReferralLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {referralLoading ? 'Saving...' : 'Save Referral'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custom Test Modal - Edit Remarks */}
      {showCustomTestModal && selectedCustomTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Custom Test: {selectedCustomTest.test_name}</h3>
              <button
                onClick={() => {
                  setShowCustomTestModal(false);
                  setSelectedCustomTest(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  value={customTestForm.test_name}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, test_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result Value</label>
                <input
                  type="text"
                  value={customTestForm.result_value}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, result_value: e.target.value })}
                  placeholder="e.g., 120, Positive, Normal"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={customTestForm.unit}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, unit: e.target.value })}
                  placeholder="e.g., mg/dL, mmHg"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Range</label>
                  <input
                    type="text"
                    value={customTestForm.reference_range}
                    onChange={(e) => setCustomTestForm({ ...customTestForm, reference_range: e.target.value })}
                    placeholder="e.g., 70-100"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={customTestForm.result_date}
                    onChange={(e) => setCustomTestForm({ ...customTestForm, result_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remark / Notes</label>
                <textarea
                  value={customTestForm.remark}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, remark: e.target.value })}
                  placeholder="Add any remarks or notes about this test..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={async () => {
                  // Delete custom test from database
                  try {
                    await api.delete(`/api/custom-lab-tests/${selectedCustomTest.id}`);
                    const updated = customLabTests.filter(ct => ct.id !== selectedCustomTest.id);
                    setCustomLabTests(updated);
                    addToast('Custom test removed', 'success');
                    setShowCustomTestModal(false);
                    setSelectedCustomTest(null);
                  } catch (err) {
                    console.error('Failed to delete custom test:', err);
                    addToast('Failed to delete custom test', 'error');
                  }
                }}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                Delete
              </button>
              <button
                onClick={async () => {
                  // Save changes
                  try {
                    // Update custom test template (name + remark only)
                    await api.put(`/api/custom-lab-tests/${selectedCustomTest.id}`, {
                      test_name: customTestForm.test_name,
                      remark: customTestForm.remark,
                      result_value: '',
                      unit: ''
                    });

                    // If result_value is provided, save as actual lab result
                    if (customTestForm.result_value) {
                      await api.post(`/api/labs/${id}`, {
                        test_name: customTestForm.test_name,
                        result_value: customTestForm.result_value,
                        result_unit: customTestForm.unit || '',
                        reference_range: customTestForm.reference_range || '',
                        result_date: customTestForm.result_date || getLocalDateString(),
                        status: 'completed'
                      });
                      addToast('Lab result added', 'success');
                      // Refresh patient data to show in lab results grid
                      fetchPatientData();
                    } else {
                      addToast('Custom test updated', 'success');
                    }

                    // Update local state
                    const updated = customLabTests.map(ct =>
                      ct.id === selectedCustomTest.id
                        ? { ...ct, test_name: customTestForm.test_name, remark: customTestForm.remark }
                        : ct
                    );
                    setCustomLabTests(updated);
                    setShowCustomTestModal(false);
                    setSelectedCustomTest(null);
                  } catch (err) {
                    console.error('Failed to update custom test:', err);
                    addToast('Failed to update custom test', 'error');
                  }
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Preview Modal */}
      {showRecordPreviewModal && selectedRecordPreview && (
        <Modal
          isOpen={showRecordPreviewModal}
          title={selectedRecordPreview.name}
          onClose={() => {
            setShowRecordPreviewModal(false);
            setSelectedRecordPreview(null);
          }}
          size="lg"
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p><strong>Category:</strong> {selectedRecordPreview.category}</p>
              <p><strong>Date:</strong> {selectedRecordPreview.date}</p>
            </div>

            {/* Preview Container */}
            <div className="bg-gray-50 rounded p-4 max-h-96 overflow-auto flex items-center justify-center">
              {selectedRecordPreview.file_path && (selectedRecordPreview.file_path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                <img 
                  src={fileUrl(selectedRecordPreview.file_path)}
                  alt={selectedRecordPreview.name}
                  className="max-w-full max-h-80 object-contain"
                  onError={() => addToast('Failed to load image', 'error')}
                />
              ) : (selectedRecordPreview.file_path && (selectedRecordPreview.file_path.match(/\.pdf$/i))) ? (
                <div className="flex flex-col items-center justify-center w-full h-80">
                  <svg className="w-16 h-16 text-blue-500 mb-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.707 7.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414-1.414l-2-2z" />
                    <path fillRule="evenodd" d="M5 4V3H2a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1h-3V3a1 1 0 011-1h2a2 2 0 012 2v1a2 2 0 01-2 2H5z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-600 font-medium mb-2">PDF Document</p>
                  <p className="text-xs text-gray-500 text-center mb-3">Click the View button below to open and view the full PDF</p>
                  <button
                    onClick={() => setShowRecordPreviewModal(false)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Full PDF
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-80">
                  <svg className="w-16 h-16 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 font-medium">File Preview Unavailable</p>
                  <p className="text-xs text-gray-500 text-center mt-1">Download to view this file</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowRecordPreviewModal(false);
                  setSelectedRecordPreview(null);
                }}
                className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (selectedRecordPreview?.file_path) {
                    window.open(fileUrl(selectedRecordPreview.file_path), '_blank');
                  } else {
                    addToast('No file available', 'error');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                View
              </button>
              <button
                onClick={async () => {
                  if (selectedRecordPreview?.file_path) {
                    try {
                      const response = await fetch(fileUrl(selectedRecordPreview.file_path));
                      const blob = await response.blob();
                      const blobUrl = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = blobUrl;
                      a.download = selectedRecordPreview.name || 'record';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
                    } catch {
                      addToast('Download failed', 'error');
                    }
                  } else {
                    addToast('No file available', 'error');
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                Download
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Extraction Results Modal */}
      {showExtractionModal && extractionStatus && (
        <Modal
          isOpen={showExtractionModal}
          title="Lab Tests Auto-Extracted"
          onClose={() => {
            setShowExtractionModal(false);
            setExtractionStatus(null);
          }}
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-sm text-green-800 font-medium">
                ✓ {extractionStatus.count} lab test(s) automatically extracted and added!
              </p>
              {extractionStatus.unmatchedCount > 0 && (
                <p className="text-xs text-yellow-700 mt-1">
                  {extractionStatus.unmatchedCount} test(s) could not be automatically matched
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Extracted Tests:</h4>
              <div className="bg-gray-50 rounded p-3 space-y-2 max-h-60 overflow-y-auto">
                {extractionStatus.results.map((result, idx) => (
                  <div key={idx} className="text-sm border-l-4 border-blue-500 pl-2 py-1">
                    <div className="font-medium text-gray-900">{result.test_name}</div>
                    <div className="text-xs text-gray-600 flex gap-3 mt-0.5">
                      <span><strong>{result.reading}</strong> {result.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowExtractionModal(false);
                  setExtractionStatus(null);
                }}
                className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowExtractionModal(false);
                  setExtractionStatus(null);
                  // Scroll to lab results section
                  const labSection = document.querySelector('[data-section-labs]');
                  if (labSection) labSection.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                View in Lab Results
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

