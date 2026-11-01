import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { openWhatsApp, generatePrescriptionMessage } from '../utils/whatsapp';
import HeaderBar from '../components/HeaderBar';
const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';

export default function PrescriptionPreview() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const { addToast } = useToast();
  const [prescription, setPrescription] = useState(null);
  const [patient, setPatient] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [_notify, _setNotify] = useState({ email: '', phone: '' });
  const [_showTemplateSection, _setShowTemplateSection] = useState(false);
  const [_templateName, _setTemplateName] = useState('');
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current
  });

  const fetchPrescriptionData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch latest prescription for the patient
      const res = await api.get(`/api/prescriptions/${patientId}`);
      const prescriptions = res.data?.data?.prescriptions || res.data?.prescriptions || [];
      if (prescriptions.length > 0) {
        const latestPrescription = prescriptions[0];
        setPrescription(latestPrescription);

        // Fetch doctor details if doctor_id exists
        if (latestPrescription.doctor_id) {
          try {
            const doctorRes = await api.get(`/api/doctors/${latestPrescription.doctor_id}`);
            setDoctor(doctorRes.data);

            // Fetch clinic details if clinic exists in doctor data
            if (doctorRes.data.clinic_id) {
              try {
                const clinicRes = await api.get(`/api/clinics/${doctorRes.data.clinic_id}`);
                setClinic(clinicRes.data?.data || clinicRes.data);
              } catch (clinicErr) {
                console.warn('Clinic fetch failed:', clinicErr);
              }
            }
          } catch (err) {
            console.warn('Doctor fetch failed:', err);
            if (latestPrescription.doctor_name) {
              setDoctor({ name: latestPrescription.doctor_name, specialization: latestPrescription.specialization || '' });
            }
          }
        }
      }

      // Fetch patient details
      const patientRes = await api.get(`/api/patients/${patientId}`);
      setPatient(patientRes.data?.data || patientRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load prescription data');
    } finally {
      setLoading(false);
    }
  }, [api, patientId]);

  useEffect(() => {
    if (!patientId) return;
    fetchPrescriptionData();
  }, [fetchPrescriptionData, patientId]);

  // Helper to calculate age
  const calcAge = (dob) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  // Parse symptoms from chief_complaint string
  const getSymptoms = () => {
    if (!prescription?.chief_complaint) return [];
    return prescription.chief_complaint.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Parse diagnosis from diagnosis string
  const getDiagnoses = () => {
    if (!prescription?.diagnosis) return [];
    return prescription.diagnosis.split(',').map(d => d.trim()).filter(Boolean);
  };

  const handleSend = async (method) => {
    try {
      if (method === 'whatsapp') {
        if (!patient?.phone) { addToast('Patient phone number not available', 'error'); return; }
        if (!prescription?.id) { addToast('No prescription found', 'error'); return; }
        const message = generatePrescriptionMessage({
          patientName: patient.name,
          doctorName: prescription?.doctor_name || doctor?.name || 'Doctor',
          date: new Date(prescription?.created_at || Date.now()).toLocaleDateString('en-IN')
        });
        const pdfLink = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(prescription.id)}?with_letterhead=1`;
        openWhatsApp(patient.phone, `${message}\n\nView or download the prescription PDF with clinic letterhead: ${pdfLink}`);
        addToast('Opening WhatsApp...', 'success');
      }
      if (method === 'attachment') { handlePrint(); }
      if (method === 'pdf') {
        if (!prescription?.id) { addToast('No prescription found', 'error'); return; }
        const response = await api.get(`/api/pdf/prescription/${prescription.id}?with_letterhead=1`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `prescription-${prescription.id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        addToast('PDF downloaded', 'success');
      }
    } catch (error) {
      console.error('Send error:', error);
      addToast('Send failed', 'error');
    }
  };

  const handleBillPatient = () => {
    if (!patientId) { addToast('Patient info not available', 'error'); return; }
    const queryParams = new URLSearchParams({ patientId, ...(prescription?.id && { prescriptionId: prescription.id }) });
    navigate(`/billing?${queryParams.toString()}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <HeaderBar title="Prescription Preview" />
        <div className="text-sm text-slate-500">Loading prescription...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <HeaderBar title="Prescription Preview" />
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  const symptoms = getSymptoms();
  const diagnoses = getDiagnoses();
  const vitals = prescription?.vitals || {};
  const hasVitals = Object.keys(vitals).some(k => vitals[k]);
  const medications = prescription?.medications || [];
  const patientAge = patient?.dob ? calcAge(patient.dob) : (patient?.age_years ?? 'N/A');

  return (
    <div className="space-y-4">
      <HeaderBar title="Prescription Preview" />

      {/* Prescription Preview */}
      <div className="bg-white border rounded shadow-sm" ref={printRef}>
        <div className="p-6 space-y-6">
          {/* Doctor Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-bold text-slate-800">
              Dr. {prescription?.doctor_name || doctor?.name || 'N/A'}
            </h1>
            {(doctor?.qualification || prescription?.qualification) && (
              <p className="text-slate-600">{doctor?.qualification || prescription?.qualification}</p>
            )}
            {(doctor?.specialization || prescription?.specialization) && (
              <p className="text-slate-500">{doctor?.specialization || prescription?.specialization}</p>
            )}
            {doctor?.registration_number && (
              <p className="text-sm text-slate-500 mt-2">Reg No: {doctor.registration_number}</p>
            )}
          </div>

          {/* Clinic Details */}
          {(clinic?.name || prescription?.clinic_name) && (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-800">{clinic?.name || prescription?.clinic_name}</h2>
              {(clinic?.address) && <p className="text-slate-600">{clinic.address}</p>}
              {clinic?.phone && <p className="text-slate-600">Phone: {clinic.phone}</p>}
            </div>
          )}

          {/* Date and Time */}
          <div className="flex justify-between items-center text-sm text-slate-600">
            <span>Date: {prescription?.created_at ? new Date(prescription.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</span>
            <span>Time: {prescription?.created_at ? new Date(prescription.created_at).toLocaleTimeString('en-IN') : ''}</span>
          </div>

          {/* Patient Details */}
          <div className="border rounded p-4 bg-slate-50">
            <h3 className="font-semibold text-slate-800 mb-3">Patient Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Name:</span>
                <p>{patient?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium">Age/Gender:</span>
                <p>{patientAge} Years / {patient?.gender || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium">UHID:</span>
                <p>{patient?.patient_id || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium">Phone:</span>
                <p>{patient?.phone || 'N/A'}</p>
              </div>
              {patient?.address && (
                <div>
                  <span className="font-medium">Address:</span>
                  <p>{patient.address}</p>
                </div>
              )}
              {patient?.blood_group && (
                <div>
                  <span className="font-medium">Blood Group:</span>
                  <p>{patient.blood_group}</p>
                </div>
              )}
            </div>
          </div>

          {/* Vitals */}
          <div className="border rounded p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Vitals</h3>
            {hasVitals ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {vitals.temp && (
                  <div className="text-center p-2 bg-red-50 rounded">
                    <span className="text-xs text-slate-500">Temperature</span>
                    <p className="text-lg font-semibold text-red-600">{vitals.temp}°F</p>
                  </div>
                )}
                {vitals.blood_pressure && (
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <span className="text-xs text-slate-500">Blood Pressure</span>
                    <p className="text-lg font-semibold text-blue-600">{vitals.blood_pressure}</p>
                  </div>
                )}
                {vitals.pulse && (
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <span className="text-xs text-slate-500">Pulse Rate</span>
                    <p className="text-lg font-semibold text-orange-600">{vitals.pulse} bpm</p>
                  </div>
                )}
                {vitals.weight && (
                  <div className="text-center p-2 bg-green-50 rounded">
                    <span className="text-xs text-slate-500">Weight</span>
                    <p className="text-lg font-semibold text-green-600">{vitals.weight} kg</p>
                  </div>
                )}
                {vitals.height && (
                  <div className="text-center p-2 bg-purple-50 rounded">
                    <span className="text-xs text-slate-500">Height</span>
                    <p className="text-lg font-semibold text-purple-600">{vitals.height} cm</p>
                  </div>
                )}
                {vitals.spo2 && (
                  <div className="text-center p-2 bg-cyan-50 rounded">
                    <span className="text-xs text-slate-500">SpO2</span>
                    <p className="text-lg font-semibold text-cyan-600">{vitals.spo2}%</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded text-center">
                No vitals recorded for this prescription
              </div>
            )}
          </div>

          {/* Chief Complaints / Symptoms */}
          {symptoms.length > 0 && (
            <div className="border rounded p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Chief Complaints</h3>
              <div className="flex flex-wrap gap-2">
                {symptoms.map((s, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full text-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {diagnoses.length > 0 && (
            <div className="border rounded p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Diagnosis</h3>
              <div className="flex flex-wrap gap-2">
                {diagnoses.map((d, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-sm">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prescription Table */}
          <div className="border rounded p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Prescription (Rx)</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border px-3 py-2 text-left text-sm font-medium w-8">#</th>
                  <th className="border px-3 py-2 text-left text-sm font-medium">Medicine</th>
                  <th className="border px-3 py-2 text-center text-sm font-medium">Frequency</th>
                  <th className="border px-3 py-2 text-center text-sm font-medium">Timing</th>
                  <th className="border px-3 py-2 text-center text-sm font-medium">Duration</th>
                  <th className="border px-3 py-2 text-left text-sm font-medium">Instructions</th>
                  <th className="border px-3 py-2 text-center text-sm font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((med, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="border px-3 py-2 text-sm text-center">{index + 1}</td>
                    <td className="border px-3 py-2 text-sm">
                      <div className="font-medium">{med.medication_name || med.medicine_name || med.name || '-'}</div>
                      {med.generic_name && <div className="text-xs text-slate-500">{med.generic_name}</div>}
                    </td>
                    <td className="border px-3 py-2 text-sm text-center">{med.frequency || '-'}</td>
                    <td className="border px-3 py-2 text-sm text-center">{med.timing || '-'}</td>
                    <td className="border px-3 py-2 text-sm text-center">{med.duration || '-'}</td>
                    <td className="border px-3 py-2 text-sm">{med.instructions || '-'}</td>
                    <td className="border px-3 py-2 text-sm text-center">{med.quantity || '-'}</td>
                  </tr>
                ))}
                {medications.length === 0 && (
                  <tr>
                    <td colSpan="7" className="border px-3 py-4 text-center text-slate-500 text-sm">
                      No medications prescribed
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Advice Section */}
          {prescription?.advice && (
            <div className="border rounded p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Advice</h3>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-blue-50 p-3 rounded">
                {prescription.advice}
              </div>
            </div>
          )}

          {/* Lab Advice */}
          {prescription?.lab_advice && (
            <div className="border rounded p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Investigations</h3>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 p-3 rounded">
                {prescription.lab_advice}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {(prescription?.follow_up_date || prescription?.follow_up_days) && (
            <div className="border rounded p-4 bg-green-50">
              <h3 className="font-semibold text-slate-800 mb-3">Follow Up</h3>
              <div className="flex items-center gap-4 text-sm">
                {prescription.follow_up_date && (
                  <div>
                    <span className="font-medium">Date: </span>
                    <span className="bg-white px-3 py-1 rounded border">
                      {new Date(prescription.follow_up_date).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                )}
                {prescription.follow_up_days && (
                  <div>
                    <span className="font-medium">After: </span>
                    <span className="bg-white px-3 py-1 rounded border">{prescription.follow_up_days} days</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Doctor Signature */}
          <div className="text-right pt-6 border-t">
            <p className="font-medium">Dr. {prescription?.doctor_name || doctor?.name || 'N/A'}</p>
            {(doctor?.qualification || prescription?.qualification) && (
              <p className="text-sm text-slate-600">{doctor?.qualification || prescription?.qualification}</p>
            )}
            {doctor?.registration_number && (
              <p className="text-sm text-slate-600">Reg No: {doctor.registration_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm" onClick={() => handleSend('attachment')}>
          Print
        </button>
        <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm" onClick={() => handleSend('pdf')}>
          Download PDF
        </button>
        <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm" onClick={() => handleSend('whatsapp')}>
          WhatsApp
        </button>
        <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm" onClick={handleBillPatient}>
          Bill Patient
        </button>
        <button
          className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
          onClick={() => {
            if (!prescription?.id) return;
            const link = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(prescription.id)}?with_letterhead=1`;
            navigator.clipboard.writeText(link).then(() => addToast('PDF link copied', 'success'));
          }}
        >
          Copy PDF Link
        </button>
        <button
          className="px-4 py-2 border rounded hover:bg-slate-50 text-sm"
          onClick={() => {
            if (!prescription?.id) return;
            const link = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(prescription.id)}?with_letterhead=1`;
            const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
            window.open(qr, '_blank');
          }}
        >
          Show QR
        </button>
      </div>
    </div>
  );
}
