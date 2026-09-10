import { useState } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { getLocalDateString } from '../utils/localDate';

export default function AddPatientModal({ isOpen, onClose, onSuccess }) {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { patient, matchType }
  const [form, setForm] = useState({
    salutation: 'Mr.',
    name: '',
    email: '',
    phone: '',
    dob: '',
    age_years: '',
    gender: 'Male',
    blood_group: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Baby', 'Master'];

  /** Build the full name exactly as it will be sent to the API */
  const buildFullName = () => {
    let cleanName = form.name.trim();
    for (const s of SALUTATIONS) {
      if (cleanName.toLowerCase().startsWith(s.toLowerCase() + ' ')) {
        cleanName = cleanName.slice(s.length).trim();
        break;
      }
    }
    return `${form.salutation} ${cleanName}`.trim();
  };

  /** Create appointment + queue for the given patient id (new or existing). No bill — that's created manually. */
  const createAppointmentAndQueue = async (patientId) => {
    // appointments.doctor_id and queue.doctor_id are NOT NULL, so a non-doctor
    // user (admin/staff/reception) adding a walk-in must still get a real doctor
    // here or the create silently fails. Same fallback used by Queue.jsx's
    // quick check-in for this clinic.
    const clinicId = user?.clinic_id || user?.clinicId || 2;
    const doctorId = user?.doctor_id || user?.doctorId || 2;

    const appointmentData = {
      patient_id: patientId,
      doctor_id: doctorId,
      clinic_id: clinicId,
      appointment_date: getLocalDateString(),
      appointment_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      arrival_type: 'walk-in',
    };

    const appointmentResponse = await api.post('/api/appointments', appointmentData);
    const aptData = appointmentResponse.data;
    const appointmentId = aptData?.data?.id || aptData?.id;

    // NOTE (2026-07-11): bill is intentionally NOT created here. Booking a patient
    // only creates the appointment + queue entry. A bill is created explicitly by
    // staff from the billing/payment screens, never automatically on registration.

    const queueResponse = await api.post('/api/queue', {
      patient_id: patientId,
      appointment_id: appointmentId,
      doctor_id: doctorId,
      clinic_id: clinicId,
      status: 'waiting',
      priority: 0,
    });

    addToast(
      `Patient added! Token #${queueResponse.data?.data?.token_number || queueResponse.data?.token_number || 'N/A'} - Queued for treatment`,
      'success'
    );
  };

  /** Actually create the patient and run the post-create flow */
  const doCreatePatient = async () => {
    setLoading(true);
    try {
      const clinicId = user?.clinic_id || user?.clinicId || 1;

      const response = await api.post('/api/patients', {
        name: buildFullName(),
        email: form.email,
        phone: form.phone,
        dob: form.dob,
        age_years: form.age_years || null,
        gender: form.gender,
        blood_group: form.blood_group,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        clinic_id: clinicId,
        created_by: user?.id || null,
      });

      const patientData = response.data;
      const patient = patientData?.data || patientData?.patient || patientData;

      if (!patient?.id) {
        throw new Error('Patient creation failed: missing patient ID in response');
      }

      try {
        await createAppointmentAndQueue(patient.id);
      } catch (aptError) {
        console.error('Appointment/Queue creation failed:', aptError);
        addToast('Patient added but could not be queued. Please add to queue manually.', 'warning');
      }

      onSuccess?.(patient);
      handleClose();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Unable to add patient';
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  /** Use an already-existing patient — skip patient creation, just queue them */
  const handleUseExistingPatient = async () => {
    const existingPatient = duplicateWarning.patient;
    setDuplicateWarning(null);
    setLoading(true);
    try {
      await createAppointmentAndQueue(existingPatient.id);
      onSuccess?.(existingPatient);
      handleClose();
    } catch (err) {
      console.error('Queue creation for existing patient failed:', err);
      addToast('Could not add existing patient to queue. Please try manually.', 'warning');
      onSuccess?.(existingPatient);
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Check for a duplicate (same phone + similar name) before creating
    if (form.phone && form.name) {
      try {
        const fullName = buildFullName();
        const dupRes = await api.get(
          `/api/patients/check-duplicate?phone=${encodeURIComponent(form.phone)}&name=${encodeURIComponent(fullName)}`
        );
        const dupData = dupRes.data?.data || dupRes.data;
        if (dupData?.found) {
          setDuplicateWarning(dupData);
          return; // Stop and show the warning
        }
      } catch {
        // If the check fails, proceed with creation anyway
      }
    }

    doCreatePatient();
  };

  const handleClose = () => {
    setForm({
      salutation: 'Mr.',
      name: '',
      email: '',
      phone: '',
      dob: '',
      age_years: '',
      gender: 'Male',
      blood_group: '',
      address: '',
      city: '',
      state: '',
      pincode: ''
    });
    setError('');
    setDuplicateWarning(null);
    onClose();
  };

  if (!isOpen) return null;

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";
  const sectionCls = "space-y-3";
  const sectionHeadCls = "flex items-center gap-2 text-sm font-bold text-gray-700 pb-2 border-b border-gray-100";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 sm:rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add New Patient</h2>
              <p className="text-blue-200 text-xs">Fill in patient details below</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* ── Duplicate Patient Warning ── */}
          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">Similar patient already exists</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    A patient with a similar name and the same phone number was found in the system.
                  </p>
                  <div className="mt-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-sm font-bold text-gray-800">{duplicateWarning.patient.name}</p>
                    <p className="text-xs text-gray-500">
                      ID: {duplicateWarning.patient.patient_id} &bull; Phone: {duplicateWarning.patient.phone}
                      {duplicateWarning.patient.gender && ` \u2022 ${duplicateWarning.patient.gender === 'M' ? 'Male' : duplicateWarning.patient.gender === 'F' ? 'Female' : duplicateWarning.patient.gender}`}
                      {duplicateWarning.patient.age_years && ` \u2022 ${duplicateWarning.patient.age_years}y`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleUseExistingPatient}
                  disabled={loading}
                  className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing…' : 'Use Existing Patient'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDuplicateWarning(null); doCreatePatient(); }}
                  disabled={loading}
                  className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Create New Record Anyway
                </button>
              </div>
            </div>
          )}

          {/* ── Basic Information ── */}
          <div className={sectionCls}>
            <h3 className={sectionHeadCls}>
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Salutation</label>
                <select value={form.salutation} onChange={e => setForm({...form, salutation: e.target.value})} className={inputCls} required>
                  {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} placeholder="Patient's full name" required />
              </div>
              <div>
                <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputCls} placeholder="10-digit mobile number" pattern="[0-9]{10}" required />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputCls} placeholder="patient@example.com" />
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input type="date" value={form.dob} max={getLocalDateString()}
                  onChange={e => {
                    const val = e.target.value;
                    const updates = { dob: val };
                    if (val) {
                      const age = Math.floor((Date.now() - new Date(val)) / (365.25*24*3600*1000));
                      if (age >= 0) updates.age_years = String(age);
                    }
                    setForm({...form, ...updates});
                  }}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Age (Years)</label>
                <input type="number" min="0" max="150" value={form.age_years} onChange={e => setForm({...form, age_years: e.target.value, dob: ''})} className={inputCls} placeholder="e.g. 35" />
              </div>
              <div>
                <label className={labelCls}>Gender <span className="text-red-500">*</span></label>
                <select
                  value={form.gender}
                  onChange={e => {
                    const gender = e.target.value;
                    // Keep salutation in sync with gender so "Mr. <female name>"
                    // never gets baked into the stored name (staff routinely
                    // forgot to change the default 'Mr.'). Gender-neutral
                    // salutations (Dr., Baby) chosen manually are left alone.
                    setForm(prev => {
                      let salutation = prev.salutation;
                      if (gender === 'Female' && ['Mr.', 'Master'].includes(salutation)) salutation = 'Mrs.';
                      if (gender === 'Male' && ['Mrs.', 'Ms.'].includes(salutation)) salutation = 'Mr.';
                      return { ...prev, gender, salutation };
                    });
                  }}
                  className={inputCls}
                  required
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Blood Group</label>
                <select value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})} className={inputCls}>
                  <option value="">Select Blood Group</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Address ── */}
          <div className={sectionCls}>
            <h3 className={sectionHeadCls}>
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Address
            </h3>
            <div>
              <label className={labelCls}>Street Address</label>
              <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className={inputCls} placeholder="House / Street / Area" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className={inputCls} placeholder="City" />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input type="text" value={form.state} onChange={e => setForm({...form, state: e.target.value})} className={inputCls} placeholder="State" />
              </div>
              <div>
                <label className={labelCls}>Pincode</label>
                <input type="text" value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} className={inputCls} placeholder="123456" pattern="[0-9]{6}" />
              </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 sm:rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={handleClose} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium">
            Cancel
          </button>
          {!duplicateWarning && (
            <button type="submit" form="add-patient-form" onClick={handleSubmit} disabled={loading}
              className="flex-1 sm:flex-none sm:px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  Adding Patient…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Patient
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
