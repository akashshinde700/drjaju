import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiUser, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Modal from '../Modal';
import { useApiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { openWhatsApp } from '../../utils/whatsapp';
import { getLocalDateString } from '../../utils/localDate';

export default function BookAppointmentModal({ isOpen, onClose, patientId: initialPatientId, onSuccess }) {
  const api = useApiClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: patient, 2: date/doctor/time
  const [patientId, setPatientId] = useState(initialPatientId);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [arrivalType, setArrivalType] = useState('online');
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  const [patientSearch, setPatientSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [suggestedPatient, setSuggestedPatient] = useState(null); // fuzzy match result
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPatientDetails = useCallback(async (id) => {
    try {
      const res = await api.get(`/api/patients/${id}`);
      const patient = res.data?.data || res.data;
      setPatientName(patient.name);
      setPatientPhone(patient.phone || patient.contact || '');
      setPatientId(id);
    } catch (err) {
      console.error('Error fetching patient:', err);
    }
  }, [api]);

  const searchPatients = async (query) => {
    if (!query || query.length < 2) {
      setPatients([]);
      return;
    }
    try {
      const res = await api.get(`/api/patients?search=${query}&limit=10`);
      const body = res.data;
      const list =
        body?.data?.patients ||
        body?.patients ||
        body?.data?.data ||
        body?.data ||
        [];
      setPatients(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error searching patients:', err);
    }
  };

  /** Run duplicate check when both name and phone are provided */
  const checkForSimilarPatient = useCallback(async (name, phone) => {
    if (!name || name.length < 2 || !phone || phone.length !== 10) {
      setSuggestedPatient(null);
      return;
    }
    try {
      const res = await api.get(
        `/api/patients/check-duplicate?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`
      );
      const data = res.data?.data || res.data;
      setSuggestedPatient(data?.found ? data.patient : null);
    } catch {
      setSuggestedPatient(null);
    }
  }, [api]);

  const handleSearchChange = (value) => {
    setPatientSearch(value);
    searchPatients(value);
    checkForSimilarPatient(value, phoneSearch);
  };

  const handlePhoneChange = (value) => {
    setPhoneSearch(value);
    checkForSimilarPatient(patientSearch, value);
  };

  const selectPatient = (patient) => {
    setPatientId(patient.id);
    setPatientName(patient.name);
    setPatientPhone(patient.phone || patient.contact || '');
    setPatientSearch('');
    setPhoneSearch('');
    setPatients([]);
    setSuggestedPatient(null);
    setStep(2);
  };

  const fetchDoctors = useCallback(async () => {
    try {
      if (user && user.role === 'doctor') {
        const res = await api.get(`/api/doctors/by-user/${user.id}`);
        const selfDoctorId = res.data?.id;
        const selfDoctorName = res.data?.name;
        const clinicId = res.data?.clinic_id;

        // Fetch doctors for dropdown; backend may ignore clinic filter, so filter client-side when possible
        const clinicDoctorsRes = await api.get('/api/doctors');
        const doctorsList = clinicDoctorsRes.data.doctors || clinicDoctorsRes.data || [];
        const filtered = clinicId ? doctorsList.filter(d => String(d.clinic_id) === String(clinicId)) : doctorsList;
        const mapped = filtered.map(doc => ({
          id: doc.id,
          username: doc.name || doc.username,
          name: doc.name || doc.username
        }));
        setDoctors(mapped);

        // Auto-select the logged-in doctor when possible
        if (selfDoctorId && !doctorId) {
          setDoctorId(String(selfDoctorId));
          setDoctorName(selfDoctorName || '');
        } else if (!doctorId && mapped.length === 1) {
          setDoctorId(String(mapped[0].id));
          setDoctorName(mapped[0].username || mapped[0].name || '');
        }
      } else {
        const res = await api.get('/api/doctors');
        const doctorsList = res.data.doctors || res.data || [];
        setDoctors(doctorsList.map(doc => ({
          id: doc.id,
          username: doc.name || doc.username,
          name: doc.name || doc.username
        })));
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setDoctors([]);
    }
  }, [api, user, doctorId]);

  const handleBook = async () => {
    if (!patientId || !doctorId || !selectedDate || !selectedTime) {
      const missing = [];
      if (!patientId) missing.push('Patient');
      if (!doctorId) missing.push('Doctor');
      if (!selectedDate) missing.push('Date');
      if (!selectedTime) missing.push('Time');
      setError(`Please fill in: ${missing.join(', ')}`);
      return;
    }

    if (selectedDate === getTodayDate()) {
      const now = new Date();
      const [selH, selM] = selectedTime.split(':').map(Number);
      if (selH < now.getHours() || (selH === now.getHours() && selM <= now.getMinutes())) {
        setError('Selected time has already passed. Please choose a future time.');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/api/appointments', {
        patient_id: typeof patientId === 'string' ? parseInt(patientId, 10) : patientId,
        doctor_id: typeof doctorId === 'string' ? parseInt(doctorId, 10) : doctorId,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        slot_time: selectedTime,
        arrival_type: arrivalType,
        reason_for_visit: reason,
        status: 'scheduled'
      });

      if (sendWhatsapp) {
        sendWhatsAppNotification();
      }
      if (onSuccess) onSuccess();
      alert(sendWhatsapp ? 'Appointment booked successfully! WhatsApp opened for notification.' : 'Appointment booked successfully!');
      resetAndClose();
    } catch (err) {
      console.error('Error booking appointment:', err);
      setError(err.response?.data?.error || err.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(initialPatientId ? 2 : 1);
    setPatientId(initialPatientId || '');
    setPatientName('');
    setPatientPhone('');
    setDoctorId('');
    setDoctorName('');
    setSelectedDate('');
    setSelectedTime('');
    setReason('');
    setArrivalType('online');
    setSendWhatsapp(false);
    setPatientSearch('');
    setPhoneSearch('');
    setPatients([]);
    setSuggestedPatient(null);
    setError('');
    onClose();
  };

  const getTodayDate = () => getLocalDateString();

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minutes} ${ampm}`;
  };

  const formatIndianDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const sendWhatsAppNotification = () => {
    if (!patientPhone) return;
    const message = `Hello ${patientName},\n\nYour appointment has been successfully booked!\n\n📅 *Date:* ${formatIndianDate(selectedDate)}\n⏰ *Time:* ${formatTime(selectedTime)}\n👨‍⚕️ *Doctor:* Dr. ${doctorName || 'Doctor'}\n${reason ? `📝 *Reason:* ${reason}` : ''}\n\nPlease arrive 10 minutes early.\n\nThank you!`;
    openWhatsApp(patientPhone, message);
  };

  useEffect(() => {
    if (initialPatientId) {
      fetchPatientDetails(initialPatientId);
      setStep(2);
    }
  }, [initialPatientId, fetchPatientDetails]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Is the suggested patient already in the regular results?
  const suggestedIsInResults = suggestedPatient && patients.some(p => p.id === suggestedPatient.id);

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Book Appointment" size="lg">
      <div className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 pb-4 border-b">
          <div className={`flex items-center ${step >= 1 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
              {step > 1 ? <FiCheck /> : '1'}
            </div>
            <span className="ml-2 text-sm font-medium">Patient</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <div className={`flex items-center ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Appointment Details</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Patient Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Name search */}
              <div>
                <label className="block text-sm font-medium mb-1">Patient Name</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Search by name or ID..."
                    value={patientSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              {/* Phone search */}
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="10-digit number"
                  maxLength={10}
                  value={phoneSearch}
                  onChange={(e) => handlePhoneChange(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            {/* Fuzzy-match suggestion (phone + name) */}
            {suggestedPatient && !suggestedIsInResults && (
              <div className="border border-amber-300 bg-amber-50 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 border-b border-amber-200">
                  <FiAlertCircle className="text-amber-600 w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-800">Similar patient found — is this the same person?</span>
                </div>
                <button
                  onClick={() => selectPatient(suggestedPatient)}
                  className="w-full px-4 py-3 text-left hover:bg-amber-100 flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800">{suggestedPatient.name}</p>
                    <p className="text-sm text-gray-500">
                      ID: {suggestedPatient.patient_id} &bull; {suggestedPatient.phone}
                      {suggestedPatient.age_years && ` \u2022 ${suggestedPatient.age_years}y`}
                    </p>
                  </div>
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Select</span>
                </button>
              </div>
            )}

            {/* Regular search results */}
            {patients.length > 0 && (
              <div className="max-h-64 overflow-y-auto border rounded divide-y">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => selectPatient(patient)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{patient.name}</p>
                      <p className="text-sm text-gray-500">
                        ID: {patient.patient_id} &bull; {patient.phone}
                      </p>
                    </div>
                    <FiUser className="text-gray-400" />
                  </button>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button onClick={resetAndClose} className="px-4 py-2 border rounded hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Appointment Details */}
        {step === 2 && (
          <div className="space-y-4">
            {patientName && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
                <FiUser className="text-blue-600" />
                <span className="text-sm text-blue-800">
                  <strong>Patient:</strong> {patientName}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Select Doctor *</label>
              <select
                value={doctorId}
                onChange={(e) => {
                  const selectedDoc = doctors.find(d => d.id === parseInt(e.target.value));
                  setDoctorId(e.target.value);
                  setDoctorName(selectedDoc ? selectedDoc.username : '');
                }}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Select Doctor --</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>Dr. {doctor.username}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Date *</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getTodayDate()}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Select Time *</label>
                {(() => {
                  const isToday = selectedDate === getTodayDate();
                  const now = new Date();
                  const nowH24 = now.getHours();
                  const nowM = now.getMinutes();

                  const selH24 = selectedTime ? parseInt(selectedTime.split(':')[0], 10) : -1;
                  const selM = selectedTime ? parseInt(selectedTime.split(':')[1], 10) : -1;
                  const selPeriod = selH24 >= 12 ? 'PM' : (selH24 >= 0 ? 'AM' : '');
                  const selH12 = selH24 > 0 ? (selH24 % 12 || 12) : (selH24 === 0 ? 12 : '');

                  const availablePeriods = isToday && nowH24 >= 12 ? ['PM'] : ['AM', 'PM'];

                  const getAvailableHours = (period) =>
                    [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(h12 => {
                      const h24 = period === 'AM' ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
                      return !isToday || h24 >= nowH24;
                    });

                  const availableMinutes = Array.from({ length: 60 }, (_, i) => i).filter(m =>
                    !isToday || selH24 > nowH24 || m > nowM
                  );

                  const updateTime = (h12, m, period) => {
                    if (h12 === '' || m === '' || period === '') { setSelectedTime(''); return; }
                    const h24 = period === 'AM' ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
                    setSelectedTime(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  };

                  const curPeriod = selPeriod || availablePeriods[0];

                  return (
                    <div className="flex items-center w-full border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400">
                      <select
                        value={selH12}
                        onChange={(e) => updateTime(e.target.value === '' ? '' : parseInt(e.target.value), selM !== -1 ? selM : 0, curPeriod)}
                        className="w-16 px-2 py-2 text-sm text-center border-none outline-none bg-transparent cursor-pointer"
                      >
                        <option value="">HH</option>
                        {getAvailableHours(curPeriod).map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 font-bold text-base select-none">:</span>
                      <select
                        value={selM !== -1 ? selM : ''}
                        onChange={(e) => updateTime(selH12 !== '' ? selH12 : getAvailableHours(curPeriod)[0] || '', e.target.value === '' ? '' : parseInt(e.target.value), curPeriod)}
                        className="w-16 px-2 py-2 text-sm text-center border-none outline-none bg-transparent cursor-pointer"
                      >
                        <option value="">MM</option>
                        {availableMinutes.map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <div className="w-px h-6 bg-gray-200 mx-1 flex-shrink-0" />
                      <select
                        value={selPeriod}
                        onChange={(e) => {
                          const newPeriod = e.target.value;
                          const hrs = getAvailableHours(newPeriod);
                          const h = selH12 !== '' && hrs.includes(selH12) ? selH12 : (hrs[0] || '');
                          updateTime(h, selM !== -1 ? selM : 0, newPeriod);
                        }}
                        className="w-20 px-2 py-2 text-sm font-semibold border-none outline-none bg-transparent cursor-pointer text-blue-600"
                      >
                        <option value="">--</option>
                        {availablePeriods.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Reason for Visit</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows="2"
                placeholder="Brief reason for appointment..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Arrival Type</label>
              <select
                value={arrivalType}
                onChange={(e) => setArrivalType(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="online">Online Booking</option>
                <option value="walk-in">Walk-in</option>
                <option value="referral">Phone Booking</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
              />
              Send WhatsApp message after booking
            </label>

            <div className="pt-4 flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 px-4 py-2 border rounded hover:bg-gray-50">
                Back
              </button>
              <button
                onClick={handleBook}
                disabled={!doctorId || !selectedDate || !selectedTime || loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
