import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { getLocalDateString } from '../utils/localDate';

export default function Abha() {
  const api = useApiClient();
  const { addToast } = useToast();

  // Patient Selection State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);

  // ABHA Status State
  const [status, setStatus] = useState(null);

  // Registration Flow State
  const [regStep, setRegStep] = useState('idle'); // idle, aadhaar, otp, complete
  const [regAadhaar, setRegAadhaar] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regSessionId, setRegSessionId] = useState('');
  const [regTxnId, setRegTxnId] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Login Flow State
  const [loginStep, setLoginStep] = useState('idle'); // idle, address, otp, complete
  const [loginAbhaAddress, setLoginAbhaAddress] = useState('');
  const [loginSessionId, setLoginSessionId] = useState('');
  const [loginTxnId, setLoginTxnId] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Direct Link State
  const [abhaNumber, setAbhaNumber] = useState('');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Stats State
  const [filterType, setFilterType] = useState('yesterday');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState(null);

  // QR State
  const [qrData, setQrData] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  // ===== PATIENT SEARCH =====
  const handleSearchPatients = async () => {
    if (!patientSearchQuery.trim()) {
      addToast('Please enter a search term', 'error');
      return;
    }
    setPatientSearching(true);
    try {
      const res = await api.get(`/api/patients?search=${encodeURIComponent(patientSearchQuery.trim())}`);
      setPatientResults(res.data || []);
      if (!res.data || res.data.length === 0) {
        addToast('No patients found', 'info');
      }
    } catch (err) {
      console.error('Patient search failed', err);
      addToast(err.response?.data?.message || 'Patient search failed', 'error');
    } finally {
      setPatientSearching(false);
    }
  };

  const checkPatientStatus = useCallback(async (patient) => {
    try {
      const pid = patient?.id || patient?.patient_id;
      if (!pid) return;
      const res = await api.get(`/api/abha/status/${pid}`);
      setStatus(res.data);
    } catch (err) {
      console.error('Status check error', err);
      setStatus(null);
    }
  }, [api]);

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    try {
      localStorage.setItem('abha_selected_patient', JSON.stringify(p));
    } catch (e) {
      /* localStorage error silently ignored */
    }
    setPatientResults([]);
    setPatientSearchQuery('');
    // Reset all flows
    setRegStep('idle');
    setLoginStep('idle');
    setAbhaNumber('');
    setAbhaAddress('');
    // Auto-check ABHA status for selected patient
    checkPatientStatus(p);
  };

  // Load selected patient from localStorage and check status
  useEffect(() => {
    try {
      const raw = localStorage.getItem('abha_selected_patient');
      if (raw) {
        const patient = JSON.parse(raw);
        setSelectedPatient(patient);
        // Auto-check status on load
        checkPatientStatus(patient);
      }
    } catch (e) {
      /* localStorage error silently ignored */
    }
  }, [checkPatientStatus]);

  // ===== CHECK ABHA STATUS =====
  const checkStatus = async () => {
    try {
      const pid = selectedPatient?.id || selectedPatient?.patient_id;
      if (!pid) return addToast('Select a patient first', 'error');
      const res = await api.get(`/api/abha/status/${pid}`);
      setStatus(res.data);
    } catch (err) {
      console.error('Status check error', err);
      setStatus(null);
    }
  };

  // ===== REGISTRATION FLOW =====
  const initiateRegistration = async () => {
    setRegError('');
    
    // Validate Aadhaar format
    if (!regAadhaar || regAadhaar.length !== 12) {
      setRegError('Aadhaar must be 12 digits');
      return;
    }
    
    // Validate mobile format
    if (!regMobile || regMobile.length !== 10) {
      setRegError('Mobile number must be 10 digits');
      return;
    }
    
    setRegLoading(true);
    try {
      // If patient is selected, use their ID; otherwise use null
      const pid = selectedPatient?.id || selectedPatient?.patient_id || null;

      const res = await api.post('/api/abha/register/init', {
        patient_id: pid,
        aadhaar_number: regAadhaar,
        mobile_number: regMobile
      });

      if (res.data?.session_id) {
        setRegSessionId(res.data.session_id);
        setRegTxnId(res.data.txn_id || '');
        setRegStep('otp');
        addToast('OTP sent successfully! Check your mobile.', 'success');
      } else {
        throw new Error('Failed to initiate registration');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setRegError(msg || 'Registration initiation failed');
      addToast(msg || 'Registration initiation failed', 'error');
    } finally {
      setRegLoading(false);
    }
  };

  const verifyRegistrationOtp = async () => {
    setRegError('');
    if (!regOtp || regOtp.length !== 6) {
      setRegError('OTP must be 6 digits');
      return;
    }

    setRegLoading(true);
    try {
      const pid = selectedPatient?.id || selectedPatient?.patient_id || null;

      const res = await api.post('/api/abha/register/verify-otp', {
        patient_id: pid,
        session_id: regSessionId,
        otp: regOtp,
        txn_id: regTxnId
      });

      addToast('✅ ABHA registered and linked successfully!', 'success');
      setRegStep('complete');
      setAbhaNumber(res.data?.abha_number || '');
      setAbhaAddress(res.data?.abha_address || '');
      setStatus({
        has_abha: true,
        linked: true,
        abha_number: res.data?.abha_number,
        abha_address: res.data?.abha_address
      });

      // If new patient was created, set it as selected
      if (res.data?.patient && !selectedPatient) {
        const newPatient = {
          id: res.data.patient.id,
          patient_id: res.data.patient.patient_id,
          name: res.data.patient.name,
          phone: res.data.patient.phone,
          email: res.data.patient.email
        };
        setSelectedPatient(newPatient);
        try {
          localStorage.setItem('abha_selected_patient', JSON.stringify(newPatient));
        } catch (e) {
          /* localStorage error silently ignored */
        }
      } else if (selectedPatient) {
        // Auto-refresh status if patient was already selected
        await checkPatientStatus(selectedPatient);
      }

      // Reset form after 3 seconds
      setTimeout(() => {
        setRegStep('idle');
        setRegAadhaar('');
        setRegMobile('');
        setRegOtp('');
        setRegSessionId('');
        setRegTxnId('');
      }, 3000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setRegError(msg || 'OTP verification failed');
      addToast(msg || 'OTP verification failed', 'error');
    } finally {
      setRegLoading(false);
    }
  };

  // ===== LOGIN FLOW =====
  const initiateLogin = async () => {
    setLoginError('');
    if (!loginAbhaAddress || loginAbhaAddress.trim().length === 0) {
      setLoginError('ABHA Address is required');
      return;
    }
    
    // Basic format validation
    if (!loginAbhaAddress.includes('@')) {
      setLoginError('ABHA Address must contain @ (e.g., name@abdm)');
      return;
    }

    setLoginLoading(true);
    try {
      const pid = selectedPatient?.id || selectedPatient?.patient_id;
      if (!pid) {
        throw new Error('Please select a patient first');
      }

      const res = await api.post('/api/abha/login/init', {
        patient_id: pid,
        abha_address: loginAbhaAddress.toLowerCase()
      });

      if (res.data?.session_id) {
        setLoginSessionId(res.data.session_id);
        setLoginTxnId(res.data.txn_id || '');
        setLoginStep('otp');
        addToast('OTP sent successfully! Check your mobile.', 'success');
      } else {
        throw new Error('Failed to initiate login');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setLoginError(msg || 'Login initiation failed');
      addToast(msg || 'Login initiation failed', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const verifyLoginOtp = async () => {
    setLoginError('');
    if (!loginOtp || loginOtp.length !== 6) {
      setLoginError('OTP must be 6 digits');
      return;
    }

    setLoginLoading(true);
    try {
      const pid = selectedPatient?.id || selectedPatient?.patient_id;
      if (!pid) {
        throw new Error('Patient information missing');
      }

      const res = await api.post('/api/abha/login/verify-otp', {
        patient_id: pid,
        session_id: loginSessionId,
        otp: loginOtp,
        txn_id: loginTxnId
      });

      addToast('✅ ABHA login and link successful!', 'success');
      setLoginStep('complete');
      setStatus(res.data);

      // Auto-refresh status after login
      await checkPatientStatus(selectedPatient);

      // Reset form after 3 seconds
      setTimeout(() => {
        setLoginStep('idle');
        setLoginAbhaAddress('');
        setLoginOtp('');
        setLoginSessionId('');
        setLoginTxnId('');
      }, 3000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setLoginError(msg || 'OTP verification failed');
      addToast(msg || 'OTP verification failed', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // ===== DIRECT LINK =====
  const linkAbhaDirectly = async () => {
    if (!abhaNumber || abhaNumber.length !== 14) {
      addToast('ABHA Number must be 14 digits', 'error');
      return;
    }

    setLinkLoading(true);
    try {
      const pid = selectedPatient?.id || selectedPatient?.patient_id;
      if (!pid) {
        addToast('Please select a patient first', 'error');
        return;
      }

      await api.put(`/api/patients/${pid}`, {
        abha_number: abhaNumber,
        abha_address: abhaAddress || null
      });

      setStatus({ linked: true, patientId: pid, abha_number: abhaNumber, abha_address: abhaAddress });
      addToast('✅ ABHA linked successfully!', 'success');
      setAbhaNumber('');
      setAbhaAddress('');
      
      // Auto-refresh status after linking
      await checkPatientStatus(selectedPatient);
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      addToast(msg || 'Link failed', 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  // ===== UNLINK ABHA =====
  const unlinkAbha = async () => {
    try {
      const pid = selectedPatient?.id || selectedPatient?.patient_id;
      if (!pid) return addToast('Select a patient first', 'error');
      const res = await api.post('/api/abha/unlink', { patient_id: pid });
      setStatus(res.data);
      addToast('ABHA unlinked', 'success');
      // Auto-refresh status after unlinking
      await checkPatientStatus(selectedPatient);
    } catch (err) {
      console.error('Unlink error', err);
      addToast('Unlink failed', 'error');
    }
  };

  // ===== STATS =====
  const fetchStats = useCallback(async (params = {}) => {
    try {
      const res = await api.get('/api/abha/stats', { params });
      setStats(res.data || null);
    } catch (err) {
      console.error('ABHA stats error:', err);
      setStats(null);
    }
  }, [api]);

  useEffect(() => {
    const params = {};
    const today = new Date();
    if (filterType === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      params.start_date = getLocalDateString(y);
      params.end_date = params.start_date;
    } else if (filterType === 'month') {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 1);
      params.start_date = getLocalDateString(start);
      params.end_date = getLocalDateString(today);
    } else if (filterType === 'custom' && customStart && customEnd) {
      params.start_date = customStart;
      params.end_date = customEnd;
    }
    fetchStats(params);
  }, [filterType, customStart, customEnd, fetchStats]);

  // ===== QR CODE =====
  const generateQr = useCallback(() => {
    if (!qrData) return;
    const encoded = encodeURIComponent(qrData);
    const url = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encoded}`;
    setQrUrl(url);
  }, [qrData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-200">
        <div>
          <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">ABDM Integration</p>
          <h1 className="text-4xl font-bold text-gray-900 mt-1">ABHA Management</h1>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">📞 Help</button>
          <button className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 font-medium">📊 View Logs</button>
        </div>
      </div>

      {/* MAIN CONTENT: 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Patient Selection (2 cols) */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 sticky top-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">🔍 Select Patient</h2>
              <p className="text-sm text-gray-600 mt-1">Choose a patient to manage their ABHA account</p>
            </div>

            {!selectedPatient ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by name, phone, or patient ID…"
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchPatients()}
                    autoComplete="off"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  />
                  <button
                    onClick={handleSearchPatients}
                    className="px-5 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm disabled:opacity-50"
                    disabled={patientSearching}
                  >
                    {patientSearching ? '🔍 Searching…' : '🔍 Search'}
                  </button>
                </div>

                {patientResults && patientResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-96 overflow-auto bg-white rounded-lg border border-gray-200 p-3">
                    {patientResults.map((p) => (
                      <div key={p.id || p.patient_id} className="flex items-start justify-between p-3 hover:bg-blue-50 rounded-lg transition">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm">{p.name || p.full_name}</div>
                          <div className="text-xs text-gray-500 mt-1">ID: {p.patient_id || p.id} | Phone: {p.phone || p.mobile || '—'}</div>
                        </div>
                        <button
                          onClick={() => handleSelectPatient(p)}
                          className="ml-3 px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 whitespace-nowrap"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {patientResults.length === 0 && patientSearchQuery && !patientSearching && (
                  <div className="mt-6 space-y-4">
                    <div className="p-6 bg-white rounded-lg text-center border-2 border-dashed border-gray-300">
                      <p className="text-2xl mb-2">🔍</p>
                      <p className="font-bold text-gray-800">No patients found</p>
                      <p className="text-xs text-gray-500 mt-2">Try searching with patient name, phone, or ID</p>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-600 font-medium">OR</span>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        ⚡ Quick Register ABHA
                      </h3>
                      <p className="text-xs text-gray-600 mb-4">Register directly without selecting a patient</p>
                      <button
                        onClick={() => {
                          if (regStep === 'idle') setRegStep('aadhaar');
                          else setRegStep('idle');
                        }}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm transition"
                      >
                        {regStep === 'idle' ? '👤 Register with Aadhaar' : '✕ Close'}
                      </button>
                    </div>
                  </div>
                )}
                
                {!patientSearchQuery && patientResults.length === 0 && !patientSearching && (
                  <div className="mt-6 space-y-4">
                    <div className="p-6 bg-white rounded-lg text-center border-2 border-dashed border-gray-300">
                      <p className="text-3xl mb-3">👥</p>
                      <p className="font-bold text-gray-800">No patient selected</p>
                      <p className="text-xs text-gray-500 mt-2">Search and select a patient to manage their ABHA account</p>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-600 font-medium">OR</span>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        ⚡ Quick Register ABHA
                      </h3>
                      <p className="text-xs text-gray-600 mb-4">Register ABHA directly using Aadhaar</p>
                      <button
                        onClick={() => {
                          if (regStep === 'idle') setRegStep('aadhaar');
                          else setRegStep('idle');
                        }}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm transition"
                      >
                        {regStep === 'idle' ? '👤 Register with Aadhaar' : '✕ Close'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between p-5 bg-white rounded-lg border-3 border-green-400 shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-green-700 uppercase tracking-wider">✓ Selected</div>
                    <div className="text-2xl font-bold text-gray-900 mt-2">{selectedPatient.name || selectedPatient.full_name}</div>
                    <div className="text-xs text-gray-600 mt-2">ID: <span className="font-mono font-bold">{selectedPatient.patient_id || selectedPatient.id}</span> • {selectedPatient.phone || selectedPatient.mobile || '—'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPatient(null);
                      setStatus(null);
                      setPatientSearchQuery('');
                      localStorage.removeItem('abha_selected_patient');
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-100 font-medium whitespace-nowrap"
                  >
                    Change
                  </button>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={checkStatus}
                    className="px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold text-center transition transform hover:scale-105"
                  >
                    ✓ Check<br/>Status
                  </button>
                  <button
                    onClick={() => setRegStep(regStep === 'idle' ? 'aadhaar' : 'idle')}
                    className="px-3 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-bold text-center transition transform hover:scale-105"
                  >
                    👤 Register<br/>New ABHA
                  </button>
                  <button
                    onClick={() => setLoginStep(loginStep === 'idle' ? 'address' : 'idle')}
                    className="px-3 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-bold text-center transition transform hover:scale-105"
                  >
                    🔑 Login<br/>Existing
                  </button>
                </div>

                {/* Status Display */}
                {status && (
                  <div className={`p-4 rounded-lg text-sm font-medium transition ${status.has_abha || status.linked ? 'bg-green-100 border border-green-400 text-green-800' : 'bg-yellow-100 border border-yellow-400 text-yellow-800'}`}>
                    <p className="font-bold mb-2">
                      {status.has_abha || status.linked ? '✓ ABHA Linked' : '⚠ Not Linked'}
                    </p>
                    {(status.abha_number || status.abhaNumber) && (
                      <p className="text-xs font-mono bg-white/50 p-2 rounded mt-1">ABHA: {status.abha_number || status.abhaNumber}</p>
                    )}
                    {(status.abha_address || status.abhaAddress) && (
                      <p className="text-xs font-mono bg-white/50 p-2 rounded mt-1 break-all">Address: {status.abha_address || status.abhaAddress}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Stats Dashboard (1 col) */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              📊 Dashboard
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Date Range</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="yesterday">Yesterday</option>
                  <option value="month">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {filterType === 'custom' && (
                <div className="space-y-2">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium" />
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium" />
                </div>
              )}

              <button onClick={() => fetchStats()} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-bold transition">🔄 Refresh</button>
            </div>

            {/* Stat Cards */}
            <div className="mt-8 space-y-3">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-300">
                <p className="text-xs font-bold text-blue-700 uppercase">Total Linked</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{stats?.total || 0}</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-300">
                <p className="text-xs font-bold text-green-700 uppercase">KYC ✓</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{stats?.kyc_count || 0}</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-300">
                <p className="text-xs font-bold text-orange-700 uppercase">Consent ✓</p>
                <p className="text-3xl font-bold text-orange-900 mt-2">{stats?.consent_given || 0}</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-300">
                <p className="text-xs font-bold text-red-700 uppercase">Declined ✕</p>
                <p className="text-3xl font-bold text-red-900 mt-2">{stats?.consent_declined || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== REGISTRATION FLOW ===== */}
      {regStep !== 'idle' && (
        <div className="bg-white border-2 border-purple-400 rounded-xl p-8 bg-gradient-to-br from-white to-purple-50 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">👤 Register New ABHA</h2>
          <p className="text-sm text-gray-600 mb-6">
            {selectedPatient 
              ? `Create a new ABHA account for ${selectedPatient.name || selectedPatient.full_name}`
              : 'Register a new ABHA account using your Aadhaar number'}
          </p>

          {regError && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">
              ❌ {regError}
            </div>
          )}

          {regStep === 'aadhaar' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Aadhaar Number * <span className="text-xs text-gray-500 font-normal">(12 digits)</span></label>
                <input
                  type="text"
                  placeholder="123456789012"
                  value={regAadhaar}
                  onChange={(e) => setRegAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  maxLength={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Mobile Number * <span className="text-xs text-gray-500 font-normal">(10 digits)</span></label>
                <input
                  type="text"
                  placeholder="9876543210"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-lg font-bold"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={initiateRegistration}
                  disabled={regLoading || !regAadhaar || !regMobile}
                  className="flex-1 px-6 py-3 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regLoading ? '⏳ Sending OTP...' : '✓ Continue & Send OTP'}
                </button>
                <button
                  onClick={() => setRegStep('idle')}
                  className="px-6 py-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {regStep === 'otp' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800"><strong>OTP sent to your Aadhaar registered mobile.</strong> Enter the 6-digit OTP below.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">OTP * <span className="text-xs text-gray-500 font-normal">(6 digits)</span></label>
                <input
                  type="text"
                  placeholder="000000"
                  value={regOtp}
                  onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-2xl font-bold text-center tracking-widest"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={verifyRegistrationOtp}
                  disabled={regLoading || !regOtp}
                  className="flex-1 px-6 py-3 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regLoading ? '⏳ Verifying...' : '✓ Verify & Link ABHA'}
                </button>
                <button
                  onClick={() => setRegStep('aadhaar')}
                  className="px-6 py-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {regStep === 'complete' && (
            <div className="p-6 bg-green-100 border-2 border-green-400 rounded-lg text-center">
              <p className="text-lg font-bold text-green-800">✓ ABHA Registered & Linked!</p>
              <p className="text-sm text-green-700 mt-2">Your ABHA account has been successfully created and linked to this patient.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== LOGIN FLOW ===== */}
      {selectedPatient && loginStep !== 'idle' && (
        <div className="bg-white border-2 border-orange-400 rounded-xl p-8 bg-gradient-to-br from-white to-orange-50 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🔑 Login to Existing ABHA</h2>
          <p className="text-sm text-gray-600 mb-6">Link an existing ABHA account with <strong className="text-orange-700">{selectedPatient.name || selectedPatient.full_name}</strong></p>

          {loginError && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">
              ❌ {loginError}
            </div>
          )}

          {loginStep === 'address' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">ABHA Address *</label>
                <input
                  type="text"
                  placeholder="yourname@abdm or yourname@sbx"
                  value={loginAbhaAddress}
                  onChange={(e) => setLoginAbhaAddress(e.target.value.toLowerCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                />
                <p className="text-xs text-gray-500 mt-2">Your ABHA address (e.g., john.doe@abdm)</p>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={initiateLogin}
                  disabled={loginLoading || !loginAbhaAddress}
                  className="flex-1 px-6 py-3 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loginLoading ? '⏳ Sending OTP...' : '✓ Continue & Send OTP'}
                </button>
                <button
                  onClick={() => setLoginStep('idle')}
                  className="px-6 py-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loginStep === 'otp' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800"><strong>OTP sent to your registered mobile.</strong> Enter the 6-digit OTP below.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">OTP * <span className="text-xs text-gray-500 font-normal">(6 digits)</span></label>
                <input
                  type="text"
                  placeholder="000000"
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-2xl font-bold text-center tracking-widest"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={verifyLoginOtp}
                  disabled={loginLoading || !loginOtp}
                  className="flex-1 px-6 py-3 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loginLoading ? '⏳ Verifying...' : '✓ Verify & Link ABHA'}
                </button>
                <button
                  onClick={() => setLoginStep('address')}
                  className="px-6 py-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {loginStep === 'complete' && (
            <div className="p-6 bg-green-100 border-2 border-green-400 rounded-lg text-center">
              <p className="text-lg font-bold text-green-800">✓ ABHA Linked Successfully!</p>
              <p className="text-sm text-green-700 mt-2">Your existing ABHA account is now linked with this patient.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== DIRECT LINK SECTION ===== */}
      {selectedPatient && regStep === 'idle' && loginStep === 'idle' && (
        <div id="link-form" className="bg-white border-2 border-green-400 rounded-xl p-8 bg-gradient-to-br from-white to-green-50 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🔗 Direct Link ABHA</h2>
          <p className="text-sm text-gray-600 mb-8">Have ABHA credentials? Link directly for <strong className="text-green-700">{selectedPatient.name || selectedPatient.full_name}</strong></p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">ABHA Number * <span className="text-xs text-gray-500 font-normal">(14 digits)</span></label>
              <input
                type="text"
                placeholder="12345678901234"
                value={abhaNumber}
                onChange={(e) => setAbhaNumber(e.target.value.replace(/\D/g, '').slice(0, 14))}
                maxLength={14}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-lg font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">ABHA Address <span className="text-xs text-gray-500 font-normal">(Optional)</span></label>
              <input
                type="text"
                placeholder="yourname@abdm"
                value={abhaAddress}
                onChange={(e) => setAbhaAddress(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-8 pt-6 border-t-2 border-gray-200">
            <button
              onClick={linkAbhaDirectly}
              disabled={linkLoading || !abhaNumber}
              className="flex-1 px-6 py-4 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {linkLoading ? '⏳ Linking...' : '✓ Link ABHA to Patient'}
            </button>
            <button
              onClick={unlinkAbha}
              className="px-6 py-4 text-sm border-2 border-red-400 text-red-600 rounded-lg hover:bg-red-50 font-bold transition"
            >
              🔓 Unlink
            </button>
          </div>
        </div>
      )}

      {/* ===== QR CODE SECTION ===== */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          📱 QR Code Generator
        </h2>
        <p className="text-sm text-gray-600 mb-6">Generate and share QR codes for ABHA addresses or clinic links</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Data to Encode</label>
            <input
              type="text"
              placeholder="Enter ABHA address, clinic link, or any text…"
              value={qrData}
              onChange={(e) => setQrData(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={generateQr} className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-bold">Generate QR</button>
            <a href={qrUrl || '#'} download="abha-qr.png" className={`px-6 py-3 rounded-lg font-bold border border-gray-300 ${!qrUrl ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'}`}>Download</a>
            <button
              onClick={() => { if (!qrUrl) return addToast('Generate a QR first', 'error'); navigator.clipboard.writeText(qrUrl); addToast('QR URL copied!', 'success'); }}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
            >
              Copy Link
            </button>
          </div>

          {qrUrl && (
            <div className="mt-6 p-6 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
              <img src={qrUrl} alt="QR preview" className="w-48 h-48" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
