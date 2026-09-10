import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import Modal from '../components/Modal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { FiEdit2, FiTrash2, FiEye, FiDownload, FiPlus } from 'react-icons/fi';
import { getLocalDateString } from '../utils/localDate';

export default function Prescriptions() {
  const api = useApiClient();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, _setPage] = useState(1);
  const [limit] = useState(20);
  const [filters, setFilters] = useState({
    status: '',
    dateRange: 'today'
  });
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

  // Prescription creation states
  const [prescriptionModal, setPrescriptionModal] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [medicationTemplates, setMedicationTemplates] = useState([]);
  const [injectionTemplates, setInjectionTemplates] = useState([]);
  const [diagnosisTemplates, setDiagnosisTemplates] = useState([]);
  
  const [selectedMedicationTemplate, setSelectedMedicationTemplate] = useState(null);
  const [selectedInjectionTemplate, setSelectedInjectionTemplate] = useState(null);
  const [selectedDiagnosisTemplate, setSelectedDiagnosisTemplate] = useState(null);

  const [medicines, setMedicines] = useState([]);
  const [injections, setInjections] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [notes, setNotes] = useState('');

  // Fetch prescriptions
  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (filters.status) params.append('status', filters.status);
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (filters.dateRange === 'today') {
        const today = getLocalDateString();
        params.append('start_date', today);
        params.append('end_date', today);
      } else if (filters.dateRange === 'last7days') {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        params.append('start_date', start.toISOString().split('T')[0]);
        params.append('end_date', end.toISOString().split('T')[0]);
      } else if (filters.dateRange === 'custom' && customDateRange.start && customDateRange.end) {
        params.append('start_date', customDateRange.start);
        params.append('end_date', customDateRange.end);
      }

      const res = await api.get(`/api/prescriptions?${params}`);
      const payload = res.data?.data || res.data;
      setPrescriptions(payload?.prescriptions || []);
    } catch (error) {
      console.error('Failed to fetch prescriptions:', error);
      addToast('Failed to load prescriptions', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, search, filters, customDateRange, addToast, page, limit]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const [medRes, injRes, diagRes] = await Promise.all([
        api.get('/api/medications-templates'),
        api.get('/api/injection-templates'),
        api.get('/api/diagnosis-templates')
      ]);
      setMedicationTemplates(medRes.data.templates || []);
      setInjectionTemplates(injRes.data?.templates || injRes.data?.data?.templates || []);
      setDiagnosisTemplates(diagRes.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchPrescriptions();
    }, 350);
    return () => clearTimeout(t);
  }, [fetchPrescriptions]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle medication template selection
  const handleMedicationTemplateSelect = (template) => {
    setSelectedMedicationTemplate(template);
    if (template.medications) {
      const meds = Array.isArray(template.medications) ? template.medications : JSON.parse(template.medications || '[]');
      setMedicines(meds);
    }
  };

  // Handle injection template selection
  const handleInjectionTemplateSelect = (template) => {
    setSelectedInjectionTemplate(template);
    if (template) {
      setInjections([{
        name: template.injection_name,
        genericName: template.generic_name,
        dose: template.dose,
        route: template.route,
        frequency: template.frequency,
        duration: template.duration,
        instructions: template.instructions || ''
      }]);
    }
  };

  // Handle diagnosis template selection
  const handleDiagnosisTemplateSelect = (template) => {
    setSelectedDiagnosisTemplate(template);
    if (template.diagnoses) {
      const diags = Array.isArray(template.diagnoses) ? template.diagnoses : JSON.parse(template.diagnoses || '[]');
      setDiagnoses(diags);
    }
  };

  // Add medicine
  const handleAddMedicine = () => {
    setMedicines([...medicines, { name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  };

  // Remove medicine
  const handleRemoveMedicine = (index) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  // Update medicine
  const handleMedicineChange = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  // Add injection
  const handleAddInjection = () => {
    setInjections([...injections, { name: '', genericName: '', dose: '', route: '', frequency: '', duration: '', instructions: '' }]);
  };

  // Remove injection
  const handleRemoveInjection = (index) => {
    setInjections(injections.filter((_, i) => i !== index));
  };

  // Update injection
  const handleInjectionChange = (index, field, value) => {
    const updated = [...injections];
    updated[index][field] = value;
    setInjections(updated);
  };

  // Add diagnosis
  const handleAddDiagnosis = () => {
    setDiagnoses([...diagnoses, { code: '', description: '' }]);
  };

  // Remove diagnosis
  const handleRemoveDiagnosis = (index) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
  };

  // Update diagnosis
  const handleDiagnosisChange = (index, field, value) => {
    const updated = [...diagnoses];
    updated[index][field] = value;
    setDiagnoses(updated);
  };

  // Open prescription modal
  const handleCreatePrescription = (patient = null) => {
    setPrescriptionModal(patient || {});
    setPatientSearch('');
    setPatientResults([]);
    setMedicines([{ name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
    setInjections([]);
    setDiagnoses([]);
    setNotes('');
    setSelectedMedicationTemplate(null);
    setSelectedInjectionTemplate(null);
    setSelectedDiagnosisTemplate(null);
  };

  const searchPatients = useCallback(async (q) => {
    const query = (q || '').trim();
    if (query.length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      setPatientLoading(true);
      const res = await api.get('/api/patients', { params: { search: query, limit: 10 } });
      const list = res.data?.data?.data || res.data?.data?.patients || res.data?.patients || [];
      setPatientResults(Array.isArray(list) ? list : []);
    } catch (e) {
      setPatientResults([]);
    } finally {
      setPatientLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (prescriptionModal === null) return;
    const t = setTimeout(() => {
      searchPatients(patientSearch);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients, prescriptionModal]);

  // Submit prescription
  const handleSubmitPrescription = async () => {
    if (!prescriptionModal?.patient_id) {
      addToast('Please select a patient', 'error');
      return;
    }

    if (medicines.length === 0 && injections.length === 0) {
      addToast('Please add at least one medicine or injection', 'error');
      return;
    }

    try {
      const prescriptionData = {
        patient_id: prescriptionModal.patient_id,
        appointment_id: prescriptionModal.appointment_id,
        medications: [
          ...medicines
            .filter(m => m.name)
            .map(m => ({
              medication_name: m.name,
              dosage: m.dose || '',
              frequency: m.frequency || '',
              duration: m.duration || '',
              instructions: m.instructions || ''
            })),
          ...injections
            .filter(i => i.name)
            .map(i => ({
              medication_name: i.name,
              dosage: i.dose || '',
              frequency: i.frequency || '',
              duration: i.duration || '',
              instructions: i.instructions || ''
            }))
        ],
        diagnoses: diagnoses.filter(d => d.code || d.description),
        notes,
        prescribed_date: getLocalDateString()
      };

      await api.post('/api/prescriptions', prescriptionData);
      addToast('Prescription created successfully', 'success');
      
      setPrescriptionModal(null);
      fetchPrescriptions();
    } catch (error) {
      console.error('Failed to create prescription:', error);
      addToast(error.response?.data?.error || 'Failed to create prescription', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <HeaderBar title="Prescriptions" />

      {/* Action Buttons */}
      <section className="bg-white rounded shadow-sm border p-4 flex gap-3">
        <button
          onClick={() => handleCreatePrescription()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <FiPlus size={18} />
          New Prescription
        </button>
      </section>

      {/* Search and Filters */}
      <section className="bg-white rounded shadow-sm border p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by Patient Name / UHID / Phone"
            className="flex-1 px-3 py-2 border rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                fetchPrescriptions();
              }
            }}
          />
          <select
            className="px-3 py-2 border rounded"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="px-3 py-2 border rounded"
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          >
            <option value="today">Today</option>
            <option value="last7days">Last 7 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          <button
            onClick={fetchPrescriptions}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
          >
            Search
          </button>
        </div>

        {/* Custom Date Range */}
        {filters.dateRange === 'custom' && (
          <div className="flex gap-4">
            <input
              type="date"
              className="px-3 py-2 border rounded flex-1"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
            />
            <input
              type="date"
              className="px-3 py-2 border rounded flex-1"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
            />
          </div>
        )}
      </section>

      {/* Prescriptions Table */}
      <section className="bg-white rounded shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">S.NO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">PATIENT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">CONTACT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">MEDICINES</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">INJECTIONS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">DIAGNOSIS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">DATE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : prescriptions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    No prescriptions found
                  </td>
                </tr>
              ) : (
                prescriptions.map((prescription, index) => (
                  <tr key={prescription.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">{index + 1}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium">{prescription.patient_name || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{prescription.patient_id || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{prescription.patient_phone || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-xs">
                        {prescription.medicines && prescription.medicines.length > 0
                          ? `${prescription.medicines.length} item(s)`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-xs">
                        {prescription.injections && prescription.injections.length > 0
                          ? `${prescription.injections.length} item(s)`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-xs">
                        {prescription.diagnoses && prescription.diagnoses.length > 0
                          ? `${prescription.diagnoses.length} item(s)`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(prescription.prescribed_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/print-prescription/${prescription.id}`)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View"
                        >
                          <FiEye size={16} />
                        </button>
                        <button
                          onClick={() => {/* Edit prescription */}}
                          className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                          title="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = window.confirm('Delete this prescription?');
                            if (!ok) return;
                            try {
                              await api.delete(`/api/prescriptions/detail/${prescription.id}`);
                              addToast('Prescription deleted', 'success');
                              fetchPrescriptions();
                            } catch (e) {
                              addToast(e.response?.data?.error || 'Failed to delete prescription', 'error');
                            }
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                        <button
                          onClick={() => window.open(`/api/pdf/prescription/${prescription.id}`, '_blank')}
                          className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                          title="Download"
                        >
                          <FiDownload size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Prescription Creation Modal */}
      {prescriptionModal !== null && (
        <Modal
          isOpen={prescriptionModal !== null}
          onClose={() => setPrescriptionModal(null)}
          title="Create Prescription"
          size="xl"
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Patient Selection */}
            <div className="bg-white border rounded p-4 space-y-3">
              <label className="block text-sm font-medium">Patient</label>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search patient by Name / UHID / Phone"
                autoComplete="off"
                className="w-full px-3 py-2 border rounded"
              />
              {patientLoading && (
                <div className="text-xs text-slate-500">Searching...</div>
              )}
              {!prescriptionModal?.patient_id && patientResults.length > 0 && (
                <div className="border rounded max-h-40 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPrescriptionModal(prev => ({
                          ...(prev || {}),
                          patient_id: p.id,
                          patient_name: p.name,
                          patient_uhid: p.patient_id,
                          patient_phone: p.phone
                        }));
                        setPatientResults([]);
                        setPatientSearch(p.name || '');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                      type="button"
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.patient_id} {p.phone ? `• ${p.phone}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}

              {prescriptionModal?.patient_id && (
                <div className="text-sm text-slate-700 bg-slate-50 rounded p-3">
                  <div className="font-medium">{prescriptionModal.patient_name || 'Selected patient'}</div>
                  <div className="text-xs text-slate-500">
                    {prescriptionModal.patient_uhid || ''} {prescriptionModal.patient_phone ? `• ${prescriptionModal.patient_phone}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrescriptionModal(prev => ({ ...(prev || {}), patient_id: null, patient_name: '', patient_uhid: '', patient_phone: '' }))}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    Change patient
                  </button>
                </div>
              )}
            </div>

            {/* Templates Selection */}
            <div className="bg-blue-50 p-4 rounded space-y-3">
              <h3 className="font-semibold text-sm">Quick Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Medication Template
                  </label>
                  <select
                    value={selectedMedicationTemplate?.id || ''}
                    onChange={(e) => {
                      const template = medicationTemplates.find(t => t.id === parseInt(e.target.value));
                      if (template) handleMedicationTemplateSelect(template);
                    }}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Select template</option>
                    {medicationTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Injection Template
                  </label>
                  <select
                    value={selectedInjectionTemplate?.id || ''}
                    onChange={(e) => {
                      const template = injectionTemplates.find(t => t.id === parseInt(e.target.value));
                      if (template) handleInjectionTemplateSelect(template);
                    }}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Select template</option>
                    {injectionTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Diagnosis Template
                  </label>
                  <select
                    value={selectedDiagnosisTemplate?.id || ''}
                    onChange={(e) => {
                      const template = diagnosisTemplates.find(t => t.id === parseInt(e.target.value));
                      if (template) handleDiagnosisTemplateSelect(template);
                    }}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Select template</option>
                    {diagnosisTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Medicines Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">Medicines</h3>
                <button
                  onClick={handleAddMedicine}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  + Add Medicine
                </button>
              </div>
              <div className="space-y-2">
                {medicines.map((medicine, index) => (
                  <div key={index} className="grid grid-cols-6 gap-2 p-3 bg-slate-50 rounded">
                    <input
                      type="text"
                      placeholder="Medicine Name"
                      value={medicine.name || ''}
                      onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Dose"
                      value={medicine.dose || ''}
                      onChange={(e) => handleMedicineChange(index, 'dose', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={medicine.frequency || ''}
                      onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Duration"
                      value={medicine.duration || ''}
                      onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <button
                      onClick={() => handleRemoveMedicine(index)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Injections Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">Injections</h3>
                <button
                  onClick={handleAddInjection}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  + Add Injection
                </button>
              </div>
              <div className="space-y-2">
                {injections.map((injection, index) => (
                  <div key={index} className="grid grid-cols-6 gap-2 p-3 bg-slate-50 rounded">
                    <input
                      type="text"
                      placeholder="Injection Name"
                      value={injection.name || ''}
                      onChange={(e) => handleInjectionChange(index, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Dose"
                      value={injection.dose || ''}
                      onChange={(e) => handleInjectionChange(index, 'dose', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={injection.frequency || ''}
                      onChange={(e) => handleInjectionChange(index, 'frequency', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Duration"
                      value={injection.duration || ''}
                      onChange={(e) => handleInjectionChange(index, 'duration', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <button
                      onClick={() => handleRemoveInjection(index)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Diagnosis Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">Diagnosis</h3>
                <button
                  onClick={handleAddDiagnosis}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  + Add Diagnosis
                </button>
              </div>
              <div className="space-y-2">
                {diagnoses.map((diagnosis, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 p-3 bg-slate-50 rounded">
                    <input
                      type="text"
                      placeholder="ICD Code"
                      value={diagnosis.code || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'code', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={diagnosis.description || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'description', e.target.value)}
                      className="col-span-3 px-2 py-1 border rounded text-sm"
                    />
                    <button
                      onClick={() => handleRemoveDiagnosis(index)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional instructions or notes for the prescription"
                className="w-full px-3 py-2 border rounded text-sm"
                rows="3"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => setPrescriptionModal(null)}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPrescription}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                Create Prescription
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
