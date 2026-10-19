import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FiDownload, FiEdit2, FiTrash2, FiPlus, FiX } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';
import Modal from '../components/Modal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { downloadCertificatePDF, openCertificatePDF } from '../services/pdfService';
import LetterheadToggle from '../components/LetterheadToggle';
import { useCertificateLetterhead } from '../hooks/useBillLetterhead';
import { getSelectedDoctor } from '../utils/doctorUtils';
import { getLocalDateString } from '../utils/localDate';

/* ─── Printed-layout cleanup (mirrors the certificate PDF) ───────────────
   Templates usually include their own title line and a trailing signature /
   "Date:" block; the certificate layout already shows a title and signature,
   so those lines would appear twice. */
const cleanCertificateContent = (text, cert) => {
  const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const titles = new Set([norm(cert?.certificate_title), norm(cert?.certificate_type_name)].filter(Boolean));
  const first = lines.findIndex(l => l.trim() !== '');
  if (first !== -1 && titles.has(norm(lines[first]))) lines.splice(0, first + 1);
  const doctor = norm(String(cert?.doctor_name || '').replace(/^\s*dr\.?\s*/i, ''));
  const qualification = norm(cert?.doctor_qualification);
  const isSignatureLine = (line) => {
    const raw = line.trim();
    if (!raw) return true;
    if (raw.length > 60) return false;
    const n = norm(raw);
    return /^date\s*[:-]?\s*(\d|\{\{)/i.test(raw)
      || (doctor && (n === doctor || n === `dr ${doctor}`))
      || /^reg(istration)?\.?\s*(no\.?|number)?\s*[:-]?\s*\S+$/i.test(raw)
      || (qualification && n === qualification)
      || /^(doctor s |doctors |medical officer s )?signature\b|^authori[sz]ed signatory/.test(n);
  };
  while (lines.length && isSignatureLine(lines[lines.length - 1])) lines.pop();
  while (lines.length && lines[0].trim() === '') lines.shift();
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
};

/* ─── Standard paragraph template ─────────────────────────────────────── */
const STANDARD_PARAGRAPH = `This is to certify that Mr./Ms. {{patient_name}}, Age {{age}} years,
was examined at our clinic and is suffering from {{diagnosis}}.

The patient is advised complete rest from {{valid_from}} to {{valid_until}}.

He/She is expected to resume duties on {{resume_date}}.

This certificate is issued on patient's request for official purposes.`;

/* ─── Variable substitution ────────────────────────────────────────────── */
function substituteVars(content, data) {
  if (!content) return '';
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-IN'); } catch { return d; }
  };
  return content
    .replace(/\{\{patient_name\}\}/g,       data.patient_name        || '')
    .replace(/\{\{age\}\}/g,                data.age                 || '')
    .replace(/\{\{gender\}\}/g,             data.gender              || '')
    .replace(/\{\{diagnosis\}\}/g,          data.diagnosis           || '')
    .replace(/\{\{valid_from\}\}/g,         fmt(data.valid_from))
    .replace(/\{\{valid_until\}\}/g,        fmt(data.valid_until))
    .replace(/\{\{resume_date\}\}/g,        fmt(data.resume_date))
    .replace(/\{\{doctor_name\}\}/g,        data.doctor_name         || '')
    .replace(/\{\{doctor_registration\}\}/g,data.doctor_registration || '')
    .replace(/\{\{issued_date\}\}/g,        fmt(data.issued_date))
    // legacy bracket style
    .replace(/\[PATIENT_NAME\]/g, data.patient_name || '')
    .replace(/\[AGE\]/g,          data.age          || '')
    .replace(/\[GENDER\]/g,       data.gender       || '')
    .replace(/\[DIAGNOSIS\]/g,    data.diagnosis    || '')
    .replace(/\[DATE\]/g,         fmt(data.issued_date));
}

/* ─── Compute age from dob ──────────────────────────────────────────────── */
function calcAge(patient) {
  if (!patient) return '';
  // Direct age fields (some APIs return these)
  if (patient.age)       return String(patient.age);
  if (patient.age_years) return String(patient.age_years);
  // Compute from dob
  if (patient.dob) {
    try {
      const dob  = new Date(patient.dob);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      return age >= 0 ? String(age) : '';
    } catch { return ''; }
  }
  return '';
}

/* ─── Auto-derive certificate title from type name ──────────────────────── */
function getAutoTitle(typeName) {
  if (!typeName || typeName === 'Other') return '';
  // If name already includes a document-type word, use as-is
  if (/certificate|report|summary|letter|assessment/i.test(typeName)) return typeName;
  // Otherwise append " Certificate"
  return typeName.trim() + ' Certificate';
}

const BLANK_CERT_FORM = {
  patient_id: '',
  doctor_name: '',
  doctor_registration_no: '',
  type_id: '',
  certificate_title: '',
  diagnosis: '',
  certificate_content: '',
  issued_date: getLocalDateString(),
  valid_from: '',
  valid_until: '',
  resume_date: '',
  notes: '',
  header_image: '',
  footer_image: '',
};

export default function MedicalCertificates() {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [templates, setTemplates]       = useState([]);
  const [patients, setPatients]         = useState([]);
  const [loading, setLoading]           = useState(false);

  const [showCreateModal,      setShowCreateModal]      = useState(false);
  const [showViewModal,        setShowViewModal]        = useState(false);
  const [showTemplateModal,    setShowTemplateModal]    = useState(false);
  const [showAddTypeModal,     setShowAddTypeModal]     = useState(false);
  const [showEditTemplateModal,setShowEditTemplateModal]= useState(false);
  const [viewingCertificate,   setViewingCertificate]  = useState(null);
  const [editingTemplate,      setEditingTemplate]     = useState(null);

  /* patient search */
  const [patientSearch,     setPatientSearch]     = useState('');
  const [patientResults,    setPatientResults]    = useState([]);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [selectedPatient,   setSelectedPatient]   = useState(null);
  const patientInputRef = useRef(null);

  const [filters, setFilters] = useState({ patient_id: '', type_id: '', from_date: '', to_date: '' });

  const [certificateForm, setCertificateForm] = useState({ ...BLANK_CERT_FORM });

  const [templateForm, setTemplateForm] = useState({
    template_name: '', type_id: 1, template_content: '',
    header_image: '', footer_image: '', is_default: false,
  });

  const [certificateTypes,  setCertificateTypes]  = useState([]);
  const [newTypeName,        setNewTypeName]        = useState('');
  const [editTypeId,         setEditTypeId]         = useState(null);
  const [editTypeName,       setEditTypeName]       = useState('');
  const [showEditTypeModal,  setShowEditTypeModal]  = useState(false);

  /* ─── fetch helpers ────────────────────────────────────────────────── */
  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.patient_id) params.append('patient_id', filters.patient_id);
      if (filters.type_id)    params.append('type_id',    filters.type_id);
      if (filters.from_date)  params.append('from_date',  filters.from_date);
      if (filters.to_date)    params.append('to_date',    filters.to_date);
      const res = await api.get(`/api/medical-certificates?${params}`);
      setCertificates(res.data?.data?.certificates || res.data?.certificates || []);
    } catch (e) { console.error('Failed to fetch certificates:', e); }
    finally { setLoading(false); }
  }, [api, filters]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/api/medical-certificates/templates/list');
      setTemplates(res.data?.data?.templates || res.data?.templates || []);
    } catch (e) { console.error('Failed to fetch templates:', e); }
  }, [api]);

  const fetchCertificateTypes = useCallback(async () => {
    try {
      const res = await api.get('/api/certificate-types');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setCertificateTypes(data);
    } catch (e) {
      console.error('Failed to fetch certificate types:', e);
      setCertificateTypes([]);
    }
  }, [api]);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/api/patients');
      setPatients(res.data?.data?.data || res.data?.data?.patients || res.data?.patients || []);
    } catch (e) { console.error('Failed to fetch patients:', e); }
  }, [api]);

  useEffect(() => {
    fetchCertificates(); fetchTemplates(); fetchPatients(); fetchCertificateTypes();
  }, [fetchCertificates, fetchTemplates, fetchPatients, fetchCertificateTypes]);

  /* auto-fill doctor name (no "Dr." prefix — templates already have "Dr. {{doctor_name}}")
     Prefer the doctor picked in the admin "Select Doctor" switcher over the
     logged-in account's own name — admins/reception generate certificates on
     behalf of a doctor, and this field is read-only, so getting it wrong here
     meant every certificate was permanently mis-attributed with no way to fix it. */
  useEffect(() => {
    if (showCreateModal) {
      const doctorName = getSelectedDoctor()?.name || user?.name;
      if (doctorName) {
        setCertificateForm(prev => ({
          ...prev,
          // Only set if not already filled (e.g. from handlePatientSelect)
          doctor_name: prev.doctor_name || doctorName,
        }));
      }
    }
  }, [showCreateModal, user]);

  useEffect(() => {
    if (showCreateModal && patientInputRef.current) {
      setTimeout(() => patientInputRef.current?.focus(), 50);
    }
  }, [showCreateModal]);

  /* ─── patient search ────────────────────────────────────────────────── */
  const searchPatients = async (query) => {
    if (!query || query.length < 2) { setPatientResults([]); setShowPatientSearch(false); return; }
    try {
      const res = await api.get(`/api/patients?search=${encodeURIComponent(query)}`);
      // ApiResponse.paginated typically returns: res.data.data = { data: [...], pagination: {} }
      // Legacy endpoints may return: { patients: [...] } or { data: { patients: [...] } }
      const payload = res.data?.data;
      const list =
        payload?.data ||
        payload?.patients ||
        res.data?.patients ||
        [];
      setPatientResults(Array.isArray(list) ? list : []);
      setShowPatientSearch(true);
    } catch { setPatientResults([]); }
  };

  const handlePatientSelect = (patient) => {
    // Set patient state FIRST, then reset form (keeping patient_id), then open modal
    setSelectedPatient(patient);
    setPatientSearch(`${patient.name} (${patient.patient_id})`);
    setShowPatientSearch(false);
    setPatientResults([]);
    // Reset form but preserve patient — do NOT call resetCertificateForm() as it clears selectedPatient
    setCertificateForm({
      ...BLANK_CERT_FORM,
      patient_id: patient.id,
      doctor_name: getSelectedDoctor()?.name || user?.name || '',
    });
    setShowCreateModal(true);
  };

  /* ─── certificate type select ───────────────────────────────────────── */
  const handleCertificateTypeSelect = (typeId) => {
    if (typeId === '__add_new__') { setShowAddTypeModal(true); return; }

    const selType  = certificateTypes.find(t => t.id === parseInt(typeId));
    const typeName = selType?.name || '';
    const isOther  = typeName === 'Other';
    const autoTitle = getAutoTitle(typeName);

    // Load default template for this type (if any)
    const defaultTemplate = templates.find(
      t => parseInt(t.type_id) === parseInt(typeId) && t.is_default
    );

    let templateContent = defaultTemplate?.template_content || '';

    // Ensure the standard advisory paragraph is present in the content
    if (!templateContent.includes('This is to certify that')) {
      const sigIdx = templateContent.indexOf('Dr. {{doctor_name}}');
      if (sigIdx !== -1) {
        // Insert before the doctor signature line
        templateContent =
          templateContent.substring(0, sigIdx) +
          STANDARD_PARAGRAPH + '\n\n' +
          templateContent.substring(sigIdx);
      } else {
        // No signature section found — use paragraph as full content or append
        templateContent = templateContent
          ? templateContent + '\n\n' + STANDARD_PARAGRAPH
          : STANDARD_PARAGRAPH;
      }
    }

    setCertificateForm(prev => ({
      ...prev,
      type_id:             parseInt(typeId),
      certificate_title:   isOther ? prev.certificate_title : autoTitle,
      certificate_content: templateContent,
    }));
  };

  /* ─── reset ─────────────────────────────────────────────────────────── */
  const resetCertificateForm = () => {
    setCertificateForm({ ...BLANK_CERT_FORM });
    setSelectedPatient(null);
    setPatientSearch('');
  };

  /* ─── create certificate ────────────────────────────────────────────── */
  const handleCreateCertificate = async () => {
    if (!certificateForm.patient_id || !certificateForm.doctor_name ||
        !certificateForm.type_id    || !certificateForm.certificate_title) {
      addToast('Please fill in all required fields (Patient, Doctor, Type, Title)', 'error');
      return;
    }
    try {
      // Pre-substitute variables into certificate_content before saving
      const age = calcAge(selectedPatient);
      const doctorName = (certificateForm.doctor_name || '').replace(/^Dr\.\s*/i, '');
      const subData = {
        patient_name:        selectedPatient?.name   || '',
        age,
        gender:              selectedPatient?.gender || '',
        diagnosis:           certificateForm.diagnosis,
        valid_from:          certificateForm.valid_from,
        valid_until:         certificateForm.valid_until,
        resume_date:         certificateForm.resume_date,
        doctor_name:         doctorName,
        doctor_registration: certificateForm.doctor_registration_no || '',
        issued_date:         certificateForm.issued_date,
      };
      const processedContent = substituteVars(certificateForm.certificate_content, subData);

      await api.post('/api/medical-certificates', {
        ...certificateForm,
        certificate_content: processedContent,
      });
      setShowCreateModal(false);
      fetchCertificates();
      resetCertificateForm();
      addToast('Medical certificate created successfully!', 'success');
    } catch (e) {
      addToast('Failed to create certificate: ' + (e.response?.data?.error || e.message), 'error');
    }
  };

  const handleDeleteCertificate = async (id) => {
    if (!confirm('Delete this certificate?')) return;
    try {
      await api.delete(`/api/medical-certificates/${id}`);
      fetchCertificates();
    } catch { addToast('Failed to delete certificate', 'error'); }
  };

  // With the prescription-pad letterhead, or plain (pre-printed) paper —
  // remembered in the browser like the pad.
  const [withLetterhead, setWithLetterhead] = useCertificateLetterhead();
  const [pdfBusy, setPdfBusy] = useState(false);

  const printCertificate = async (cert) => {
    setPdfBusy(true);
    try { await openCertificatePDF(cert.id, { withLetterhead }); }
    catch { addToast('Failed to open certificate PDF', 'error'); }
    finally { setPdfBusy(false); }
  };
  const downloadCertificate = async (cert) => {
    try { await downloadCertificatePDF(cert.id, { withLetterhead }); }
    catch { addToast('Failed to download certificate PDF', 'error'); }
  };

  const handleViewCertificate = async (cert) => {
    try {
      const res = await api.get(`/api/medical-certificates/${cert.id}`);
      setViewingCertificate(res.data?.data?.certificate || res.data?.certificate);
      setShowViewModal(true);
    } catch { addToast('Failed to load certificate', 'error'); }
  };

  const handleLoadTemplate = (templateId) => {
    const t = templates.find(t => t.id === parseInt(templateId));
    if (t) setCertificateForm(prev => ({
      ...prev,
      type_id: t.type_id,
      certificate_content: t.template_content,
    }));
  };

  /* ─── template CRUD ─────────────────────────────────────────────────── */
  const handleCreateTemplate = async () => {
    if (!templateForm.template_name || !templateForm.template_content) {
      addToast('Please fill in template name and content', 'error'); return;
    }
    try {
      await api.post('/api/medical-certificates/templates', templateForm);
      setShowTemplateModal(false);
      fetchTemplates();
      setTemplateForm({ template_name: '', type_id: 1, template_content: '', header_image: '', footer_image: '', is_default: false });
      addToast('Template created!', 'success');
    } catch { addToast('Failed to create template', 'error'); }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await api.put(`/api/medical-certificates/templates/${editingTemplate.id}`, editingTemplate);
      setShowEditTemplateModal(false);
      setEditingTemplate(null);
      fetchTemplates();
      addToast('Template updated!', 'success');
    } catch { addToast('Failed to update template', 'error'); }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/medical-certificates/templates/${id}`);
      fetchTemplates();
    } catch { addToast('Failed to delete template', 'error'); }
  };

  /* ─── certificate type CRUD ─────────────────────────────────────────── */
  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    try {
      const res = await api.post('/api/certificate-types', { name: newTypeName.trim() });
      setCertificateTypes(prev => [...prev, { id: res.data.id, name: res.data.name, is_active: 1 }]);
      setShowAddTypeModal(false);
      setNewTypeName('');
    } catch { addToast('Failed to add certificate type', 'error'); }
  };

  const handleUpdateType = async () => {
    if (!editTypeName.trim() || !editTypeId) return;
    try {
      await api.put(`/api/certificate-types/${editTypeId}`, { name: editTypeName.trim() });
      setCertificateTypes(prev => prev.map(t => t.id === editTypeId ? { ...t, name: editTypeName.trim() } : t));
      setShowEditTypeModal(false);
      setEditTypeId(null);
      setEditTypeName('');
    } catch { addToast('Failed to update certificate type', 'error'); }
  };

  const handleDeleteType = async (id) => {
    if (!confirm('Delete this certificate type?')) return;
    try {
      await api.delete(`/api/certificate-types/${id}`);
      setCertificateTypes(prev => prev.filter(t => t.id !== id));
    } catch { addToast('Failed to delete certificate type', 'error'); }
  };

  /* ─── available template vars (extracted from content) ─────────────── */
  const extractVars = (content) => {
    const matches = content?.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  /* ─── live preview — substitutes real values as user fills the form ── */
  const livePreview = useMemo(() => {
    if (!certificateForm.certificate_content) return '';
    const age = calcAge(selectedPatient);
    // Strip "Dr." prefix if user typed it — templates already have "Dr. {{doctor_name}}"
    const doctorName = (certificateForm.doctor_name || '').replace(/^Dr\.\s*/i, '');
    const subData = {
      patient_name:        selectedPatient?.name  || '',
      age,
      gender:              selectedPatient?.gender || '',
      diagnosis:           certificateForm.diagnosis,
      valid_from:          certificateForm.valid_from,
      valid_until:         certificateForm.valid_until,
      resume_date:         certificateForm.resume_date,
      doctor_name:         doctorName,
      doctor_registration: certificateForm.doctor_registration_no || '',
      issued_date:         certificateForm.issued_date,
    };
    return substituteVars(certificateForm.certificate_content, subData);
  }, [selectedPatient, certificateForm]);

  /* ─── render ────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <HeaderBar title="Medical Certificates" />

      {/* ── Patient Search ─────────────────────────────────────────── */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h3 className="text-md font-semibold mb-3">Search & Select Patient</h3>
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
            placeholder="Search patient by name, ID, phone..."
            value={patientSearch}
            onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value); }}
            onFocus={() => { if (patientSearch.length >= 2) setShowPatientSearch(true); }}
            autoComplete="off"
          />
          {showPatientSearch && patientResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {patientResults.map(p => (
                <div key={p.id} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0" onClick={() => handlePatientSelect(p)}>
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-sm text-slate-600">ID: {p.patient_id} | {calcAge(p)}y, {p.gender}{p.phone && ` | ${p.phone}`}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedPatient && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="font-medium text-blue-900">Selected: </span>
              <span className="text-blue-700">{selectedPatient.name} ({selectedPatient.patient_id})</span>
              <span className="text-blue-600 text-sm ml-2">{calcAge(selectedPatient)}y, {selectedPatient.gender}</span>
            </div>
            <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-blue-600 hover:text-blue-800 text-sm underline">Clear</button>
          </div>
        )}
      </div>

      {/* ── Filters & Actions ──────────────────────────────────────── */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-2">Patient</label>
            <select className="w-full px-3 py-2 border rounded" value={filters.patient_id} onChange={e => setFilters(f => ({ ...f, patient_id: e.target.value }))}>
              <option value="">All Patients</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.patient_id})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Certificate Type</label>
            <select className="w-full px-3 py-2 border rounded" value={filters.type_id} onChange={e => setFilters(f => ({ ...f, type_id: e.target.value }))}>
              <option value="">All Types</option>
              {certificateTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Print on</label>
            <LetterheadToggle value={withLetterhead} onChange={setWithLetterhead} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { resetCertificateForm(); setShowCreateModal(true); }} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
              Create Certificate
            </button>
            <button onClick={() => setShowTemplateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Manage Templates
            </button>
          </div>
        </div>
      </div>

      {/* ── Certificates Table ─────────────────────────────────────── */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-4">Medical Certificates</h2>
        <div className="border rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {['DATE','PATIENT','DOCTOR','TYPE','TITLE','ACTIONS'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : certificates.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No certificates found.</td></tr>
              ) : certificates.map(cert => (
                <tr key={cert.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{new Date(cert.issued_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {cert.patient_name}
                    <div className="text-xs text-slate-500">{cert.patient_identifier}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{cert.doctor_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {certificateTypes.find(t => t.id === cert.type_id)?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{cert.certificate_title}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => handleViewCertificate(cert)} className="text-blue-600 hover:underline">View</button>
                      <button onClick={() => downloadCertificate(cert)} className="text-green-600 hover:underline flex items-center gap-1" title={withLetterhead ? 'Download PDF with letterhead' : 'Download PDF for pre-printed paper'}>
                        <FiDownload className="w-3 h-3" /> PDF
                      </button>
                      <button onClick={() => handleDeleteCertificate(cert.id)} className="text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── Create Certificate Modal ──────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetCertificateForm(); }} title="Create Medical Certificate" size="xl">
        <div className="space-y-4">

          {/* Row 1: Patient + Certificate Type */}
          <div className="grid grid-cols-2 gap-4">
            {/* Patient search */}
            <div className="relative">
              <label className="block text-sm font-medium mb-2">Patient *</label>
              <input
                type="text" ref={patientInputRef}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary"
                placeholder="Search by name, ID, phone..."
                value={patientSearch}
                onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value); }}
                onFocus={() => { if (patientSearch.length >= 2) setShowPatientSearch(true); }}
                autoComplete="off"
              />
              {selectedPatient && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 bg-slate-100 rounded-md text-sm">
                    {selectedPatient.name} • {selectedPatient.patient_id}
                  </span>
                  <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setSelectedPatient(null); setPatientSearch(''); setCertificateForm(p => ({ ...p, patient_id: '' })); }}>Clear</button>
                </div>
              )}
              {showPatientSearch && patientResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {patientResults.map(p => (
                    <div key={p.id} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => { setSelectedPatient(p); setPatientSearch(`${p.name} (${p.patient_id})`); setShowPatientSearch(false); setPatientResults([]); setCertificateForm(prev => ({ ...prev, patient_id: p.id })); }}>
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-sm text-slate-600">ID: {p.patient_id} | {calcAge(p)}y, {p.gender}{p.phone && ` | ${p.phone}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certificate Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Certificate Type *</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={certificateForm.type_id}
                onChange={e => handleCertificateTypeSelect(e.target.value)}
              >
                <option value="">Select Certificate Type</option>
                {certificateTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="__add_new__">＋ Add New Type</option>
              </select>
            </div>
          </div>

          {/* Load from Template */}
          <div>
            <label className="block text-sm font-medium mb-2">Load from Template (Optional)</label>
            <select className="w-full px-3 py-2 border rounded" onChange={e => handleLoadTemplate(e.target.value)} defaultValue="">
              <option value="">Select a template...</option>
              {templates.filter(t => t.type_id === certificateForm.type_id).map(t => (
                <option key={t.id} value={t.id}>{t.template_name} {t.is_default ? '(Default)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Doctor Name + Registration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Doctor Name *</label>
              <input type="text" className="w-full px-3 py-2 border rounded bg-slate-50 text-slate-700" value={certificateForm.doctor_name} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Registration No <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., MH12345"
                value={certificateForm.doctor_registration_no}
                onChange={e => setCertificateForm(p => ({ ...p, doctor_registration_no: e.target.value }))}
              />
            </div>
          </div>

          {/* Certificate Title */}
          {(() => {
            const selTypeName = certificateTypes.find(t => t.id === certificateForm.type_id)?.name || '';
            const isOther     = selTypeName === 'Other' || !certificateForm.type_id;
            return (
              <div>
                <label className="block text-sm font-medium mb-2">Certificate Title *</label>
                <input
                  type="text"
                  className={`w-full px-3 py-2 border rounded ${!isOther ? 'bg-slate-50 text-slate-700' : ''}`}
                  placeholder="e.g., Medical Leave Certificate"
                  value={certificateForm.certificate_title}
                  onChange={e => setCertificateForm(p => ({ ...p, certificate_title: e.target.value }))}
                  readOnly={!isOther}
                />
                {!isOther && certificateForm.type_id && (
                  <p className="text-xs text-slate-500 mt-1">
                    Auto-filled from type. Select "Other" to enter a custom title.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Dates row */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Issued Date *</label>
              <input type="date" className="w-full px-3 py-2 border rounded" value={certificateForm.issued_date}
                onChange={e => setCertificateForm(p => ({ ...p, issued_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Valid From</label>
              <input type="date" className="w-full px-3 py-2 border rounded" value={certificateForm.valid_from}
                onChange={e => setCertificateForm(p => ({ ...p, valid_from: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Valid Until</label>
              <input type="date" className="w-full px-3 py-2 border rounded" value={certificateForm.valid_until}
                onChange={e => setCertificateForm(p => ({ ...p, valid_until: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Resume Date</label>
              <input type="date" className="w-full px-3 py-2 border rounded" value={certificateForm.resume_date}
                onChange={e => setCertificateForm(p => ({ ...p, resume_date: e.target.value }))} />
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-sm font-medium mb-2">Diagnosis / Condition</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g., Viral Fever, Hypertension..."
              value={certificateForm.diagnosis}
              onChange={e => setCertificateForm(p => ({ ...p, diagnosis: e.target.value }))}
            />
          </div>

          {/* Certificate Content (Paragraph Editor) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Certificate Content / Paragraph</label>
              {/* Reset to standard paragraph */}
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setCertificateForm(p => ({ ...p, certificate_content: STANDARD_PARAGRAPH }))}
              >
                Reset to Standard Paragraph
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows="8"
              placeholder="Certificate text. Use {{patient_name}}, {{age}}, {{diagnosis}}, {{valid_from}}, {{valid_until}}, {{resume_date}}, {{doctor_name}}"
              value={certificateForm.certificate_content}
              onChange={e => setCertificateForm(p => ({ ...p, certificate_content: e.target.value }))}
            />
            {/* Show detected variables as info pills */}
            {certificateForm.certificate_content && (
              <div className="mt-1 flex flex-wrap gap-1">
                {extractVars(certificateForm.certificate_content).map(v => (
                  <span key={v} className="inline-flex px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded border font-mono">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Variables are auto-filled from patient data and the fields above when you save.
            </p>
          </div>

          {/* ── Live Preview ── */}
          {livePreview && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-slate-700">Live Preview</label>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Auto-updated</span>
              </div>
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded text-sm whitespace-pre-wrap leading-relaxed text-slate-800 font-mono max-h-64 overflow-y-auto">
                {livePreview}
              </div>
              <p className="text-xs text-slate-400 mt-1">This is how the certificate will look after saving.</p>
            </div>
          )}

          {/* Header Image */}
          <div>
            <label className="block text-sm font-medium mb-1">Header Image (Optional)</label>
            <p className="text-xs text-slate-500 mb-2">Leave empty to use the prescription pad letterhead automatically.</p>
            <input type="file" accept="image/*" className="w-full px-3 py-2 border rounded text-sm"
              onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onloadend = () => setCertificateForm(p => ({ ...p, header_image: r.result })); r.readAsDataURL(f); } }} />
            {certificateForm.header_image && (
              <div className="mt-2 flex items-center gap-2">
                <img src={certificateForm.header_image} alt="Header preview" className="max-h-16 border rounded" onError={e => e.target.style.display = 'none'} />
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setCertificateForm(p => ({ ...p, header_image: '' }))}>Remove</button>
              </div>
            )}
          </div>

          {/* Footer Image */}
          <div>
            <label className="block text-sm font-medium mb-1">Footer Image (Optional)</label>
            <p className="text-xs text-slate-500 mb-2">Leave empty to use the prescription pad footer.</p>
            <input type="file" accept="image/*" className="w-full px-3 py-2 border rounded text-sm"
              onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onloadend = () => setCertificateForm(p => ({ ...p, footer_image: r.result })); r.readAsDataURL(f); } }} />
            {certificateForm.footer_image && (
              <div className="mt-2 flex items-center gap-2">
                <img src={certificateForm.footer_image} alt="Footer preview" className="max-h-16 border rounded" onError={e => e.target.style.display = 'none'} />
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setCertificateForm(p => ({ ...p, footer_image: '' }))}>Remove</button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowCreateModal(false); resetCertificateForm(); }} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50">Cancel</button>
            <button
              onClick={handleCreateCertificate}
              disabled={!(certificateForm.patient_id && certificateForm.doctor_name && certificateForm.type_id && certificateForm.certificate_title)}
              className={`flex-1 px-4 py-2 text-white rounded ${(certificateForm.patient_id && certificateForm.doctor_name && certificateForm.type_id && certificateForm.certificate_title) ? 'bg-primary hover:bg-primary/90' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            >
              Create Certificate
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Add New Certificate Type Modal ────────────────────────── */}
      <Modal isOpen={showAddTypeModal} onClose={() => { setShowAddTypeModal(false); setNewTypeName(''); }} title="Add New Certificate Type" size="sm">
        <div className="space-y-4">
          <input type="text" className="w-full px-3 py-2 border rounded" placeholder="Enter type name" value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddType()} />
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-2 border rounded" onClick={() => { setShowAddTypeModal(false); setNewTypeName(''); }}>Cancel</button>
            <button className="px-4 py-2 bg-primary text-white rounded" disabled={!newTypeName.trim()} onClick={handleAddType}>Add</button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Certificate Type Modal ────────────────────────────── */}
      <Modal isOpen={showEditTypeModal} onClose={() => { setShowEditTypeModal(false); setEditTypeId(null); setEditTypeName(''); }} title="Edit Certificate Type" size="sm">
        <div className="space-y-4">
          <input type="text" className="w-full px-3 py-2 border rounded" value={editTypeName} onChange={e => setEditTypeName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdateType()} />
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-2 border rounded" onClick={() => { setShowEditTypeModal(false); }}>Cancel</button>
            <button className="px-4 py-2 bg-primary text-white rounded" disabled={!editTypeName.trim()} onClick={handleUpdateType}>Update</button>
          </div>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── View Certificate Modal ────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setViewingCertificate(null); }} title="Medical Certificate" size="xl">
        {viewingCertificate && (() => {
          const lh = viewingCertificate.letterhead || {
            header_image: viewingCertificate.header_image || null,
            footer_image: viewingCertificate.footer_image || null,
          };
          const hasHeaderArt = Boolean(lh.header_image || lh.header_content);
          const sourceLabel = {
            certificate: 'Images uploaded on this certificate',
            pad: 'Prescription pad letterhead',
            default_template: `Clinic default template${lh.template_name ? ` (${lh.template_name})` : ''}`,
            clinic: 'Clinic name & address (no letterhead image set)',
          }[lh.source];
          return (
          <div className="space-y-6">
            {/* Print options — same choice as the prescription pad */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2.5">
              <LetterheadToggle value={withLetterhead} onChange={setWithLetterhead} />
              <p className="text-xs text-slate-500">
                {withLetterhead
                  ? (sourceLabel ? `Letterhead: ${sourceLabel}` : 'Printed with the clinic letterhead')
                  : 'Top of the page stays blank for your pre-printed letterhead.'}
              </p>
            </div>

            <div className="border-2 rounded p-8 bg-white overflow-hidden" id="certificate-print">
              {!withLetterhead && (
                <div className="-mx-8 -mt-8 mb-6 h-24 border-b border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                  Pre-printed letterhead area (left blank)
                </div>
              )}
              {withLetterhead && lh.header_image && (
                <div className="-mx-8 -mt-8 mb-4">
                  <img src={lh.header_image} alt="Letterhead" className="w-full h-auto block" onError={e => e.target.style.display = 'none'} />
                </div>
              )}
              {withLetterhead && !hasHeaderArt && viewingCertificate.clinic_name && (
                <div className="text-center mb-4 pb-3 border-b-2">
                  <h2 className="text-2xl font-bold text-slate-800">{viewingCertificate.clinic_name}</h2>
                  {viewingCertificate.clinic_address && <p className="text-sm text-slate-600">{viewingCertificate.clinic_address}</p>}
                  {viewingCertificate.clinic_phone  && <p className="text-sm text-slate-600">Phone: {viewingCertificate.clinic_phone}</p>}
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 mt-2 uppercase tracking-wide">{viewingCertificate.certificate_title}</h3>
              </div>

              <div className="mb-6">
                <p className="text-sm"><strong>Doctor:</strong> {viewingCertificate.doctor_name}</p>
                {viewingCertificate.doctor_registration_no && <p className="text-sm"><strong>Registration No:</strong> {viewingCertificate.doctor_registration_no}</p>}
              </div>

              {/* Certificate content — variables already substituted at creation time */}
              <div className="mb-6">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {cleanCertificateContent(substituteVars(viewingCertificate.certificate_content, viewingCertificate), viewingCertificate)}
                </div>
              </div>

              {(viewingCertificate.valid_from || viewingCertificate.valid_until) && (
                <div className="mb-6">
                  <p className="text-sm">
                    <strong>Validity:</strong>{' '}
                    {viewingCertificate.valid_from  && `From ${new Date(viewingCertificate.valid_from).toLocaleDateString('en-IN')}`}
                    {viewingCertificate.valid_from && viewingCertificate.valid_until && ' '}
                    {viewingCertificate.valid_until && `To ${new Date(viewingCertificate.valid_until).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
              )}

              <div className="mt-12 text-right">
                <div className="inline-block pt-2 min-w-[200px]">
                  {lh.signature_image
                    ? <img src={lh.signature_image} alt="Signature" className="h-14 ml-auto mb-1" onError={e => e.target.style.display = 'none'} />
                    : <div className="border-t border-slate-400 mb-2" />}
                  <p className="text-sm font-semibold">{viewingCertificate.doctor_name}</p>
                  {viewingCertificate.doctor_registration_no && <p className="text-xs text-slate-600">{viewingCertificate.doctor_registration_no}</p>}
                </div>
              </div>

              <div className="mt-8 text-center text-xs text-slate-500">
                <p>Date: {new Date(viewingCertificate.issued_date).toLocaleDateString('en-IN')}</p>
              </div>

              {withLetterhead && lh.footer_image && (
                <div className="-mx-8 -mb-8 mt-8">
                  <img src={lh.footer_image} alt="Footer" className="w-full h-auto block" onError={e => e.target.style.display = 'none'} />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowViewModal(false); setViewingCertificate(null); }} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50">Close</button>
              <button
                onClick={() => printCertificate(viewingCertificate)}
                disabled={pdfBusy}
                className="flex-1 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-60"
                title={withLetterhead ? 'Print with letterhead' : 'Print on pre-printed paper'}
              >
                {pdfBusy ? 'Opening…' : 'Print'}
              </button>
              <button onClick={() => downloadCertificate(viewingCertificate)} className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 flex items-center justify-center gap-2">
                <FiDownload /> Download PDF
              </button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── Manage Templates Modal ────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Manage Certificate Templates" size="lg">
        <div className="space-y-6">

          {/* ── Create New Template ── */}
          <div className="border rounded p-4 bg-slate-50">
            <h4 className="font-semibold mb-3">Create New Template</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input type="text" className="w-full px-3 py-2 border rounded" placeholder="e.g., Standard Sick Leave"
                  value={templateForm.template_name} onChange={e => setTemplateForm(p => ({ ...p, template_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Certificate Type</label>
                <select className="w-full px-3 py-2 border rounded" value={templateForm.type_id}
                  onChange={e => setTemplateForm(p => ({ ...p, type_id: parseInt(e.target.value) }))}>
                  {certificateTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Template Content</label>
                <textarea className="w-full px-3 py-2 border rounded font-mono text-sm" rows="6"
                  placeholder={`Use {{patient_name}}, {{age}}, {{diagnosis}}, {{valid_from}}, {{valid_until}}, {{resume_date}}, {{doctor_name}}\n\n` + STANDARD_PARAGRAPH}
                  value={templateForm.template_content} onChange={e => setTemplateForm(p => ({ ...p, template_content: e.target.value }))} />
                <button type="button" className="text-xs text-blue-600 hover:underline mt-1"
                  onClick={() => setTemplateForm(p => ({ ...p, template_content: STANDARD_PARAGRAPH }))}>
                  Insert Standard Paragraph
                </button>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="tpl_default" className="mr-2" checked={templateForm.is_default}
                  onChange={e => setTemplateForm(p => ({ ...p, is_default: e.target.checked }))} />
                <label htmlFor="tpl_default" className="text-sm">Set as default for this type</label>
              </div>
              <button onClick={handleCreateTemplate} className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create Template</button>
            </div>
          </div>

          {/* ── Certificate Types Manager ── */}
          <div className="border rounded p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Certificate Types</h4>
              <button className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
                onClick={() => setShowAddTypeModal(true)}>
                <FiPlus /> Add Type
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {certificateTypes.map(type => (
                <div key={type.id} className="flex items-center gap-2 p-2 border rounded bg-white">
                  <span className="flex-1 text-sm">{type.name}</span>
                  <button className="p-1 text-slate-400 hover:text-blue-600" title="Edit"
                    onClick={() => { setEditTypeId(type.id); setEditTypeName(type.name); setShowEditTypeModal(true); }}>
                    <FiEdit2 size={13} />
                  </button>
                  <button className="p-1 text-slate-400 hover:text-red-600" title="Delete" onClick={() => handleDeleteType(type.id)}>
                    <FiTrash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Existing Templates List ── */}
          <div>
            <h4 className="font-semibold mb-3">Existing Templates</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No templates yet.</p>
              ) : templates.map(t => (
                <div key={t.id} className="border rounded p-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{t.template_name}</p>
                      <p className="text-xs text-slate-500">
                        {certificateTypes.find(ct => ct.id === t.type_id)?.name}
                        {t.is_default && <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Default</span>}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{t.template_content}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 border rounded" title="Edit"
                        onClick={() => { setEditingTemplate({ ...t }); setShowEditTemplateModal(true); }}>
                        <FiEdit2 size={13} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-red-600 border rounded" title="Delete" onClick={() => handleDeleteTemplate(t.id)}>
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 border rounded hover:bg-slate-50">Close</button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Template Modal ────────────────────────────────────── */}
      <Modal isOpen={showEditTemplateModal} onClose={() => { setShowEditTemplateModal(false); setEditingTemplate(null); }} title="Edit Template" size="lg">
        {editingTemplate && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name</label>
              <input type="text" className="w-full px-3 py-2 border rounded" value={editingTemplate.template_name}
                onChange={e => setEditingTemplate(p => ({ ...p, template_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Certificate Type</label>
              <select className="w-full px-3 py-2 border rounded" value={editingTemplate.type_id}
                onChange={e => setEditingTemplate(p => ({ ...p, type_id: parseInt(e.target.value) }))}>
                {certificateTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Template Content</label>
              <textarea className="w-full px-3 py-2 border rounded font-mono text-sm" rows="10"
                value={editingTemplate.template_content}
                onChange={e => setEditingTemplate(p => ({ ...p, template_content: e.target.value }))} />
              {/* Variable pills */}
              <div className="mt-1 flex flex-wrap gap-1">
                {extractVars(editingTemplate.template_content).map(v => (
                  <span key={v} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded border font-mono">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <input type="checkbox" id="edit_tpl_default" className="mr-2" checked={!!editingTemplate.is_default}
                onChange={e => setEditingTemplate(p => ({ ...p, is_default: e.target.checked }))} />
              <label htmlFor="edit_tpl_default" className="text-sm">Set as default for this type</label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowEditTemplateModal(false); setEditingTemplate(null); }} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50">Cancel</button>
              <button onClick={handleUpdateTemplate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
