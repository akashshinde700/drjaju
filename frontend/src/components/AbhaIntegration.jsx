import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import Modal from './Modal';

export default function AbhaIntegration({ patientId, onAbhaLinked }) {
  const api = useApiClient();
  const [abhaStatus, setAbhaStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Registration flow states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerStep, setRegisterStep] = useState('init'); // 'init' | 'otp'
  const [registerData, setRegisterData] = useState({
    aadhaar_number: '',
    mobile_number: ''
  });
  const [registerSession, setRegisterSession] = useState(null);
  const [registerOtp, setRegisterOtp] = useState('');

  // Login flow states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginStep, setLoginStep] = useState('init'); // 'init' | 'otp'
  const [loginData, setLoginData] = useState({
    abha_address: ''
  });
  const [loginSession, setLoginSession] = useState(null);
  const [loginOtp, setLoginOtp] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  // Fetch ABHA status helper (memoized)
  const fetchAbhaStatus = useCallback(async () => {
    try {
      const res = await api.get(`/api/abha/status/${patientId}`);
      setAbhaStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch ABHA status:', error);
    }
  }, [api, patientId]);

  // Fetch ABHA status on mount / when patientId changes
  useEffect(() => {
    if (patientId) {
      fetchAbhaStatus();
    }
  }, [patientId, fetchAbhaStatus]);

  // ========== REGISTRATION FLOW ==========

  const handleInitiateRegistration = () => {
    // Open official ABDM registration page
    window.open('https://abha.abdm.gov.in/abha/v3/register/aadhaar', '_blank');
    setShowRegisterModal(false);
    alert('Please complete registration on the ABDM website, then return here to link the account.');
  };

  const handleVerifyRegistrationOtp = async () => {
    if (!registerOtp || registerOtp.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.post('/api/abha/register/verify-otp', {
        session_id: registerSession.session_id,
        otp: registerOtp,
        txn_id: registerSession.txn_id
      });

      if (res.data.success) {
        alert(`ABHA Registration Successful!\nABHA Number: ${res.data.abha_number}\nABHA Address: ${res.data.abha_address}`);
        setShowRegisterModal(false);
        resetRegistrationFlow();
        fetchAbhaStatus();
        if (onAbhaLinked) onAbhaLinked();
      }
    } catch (error) {
      console.error('ABHA OTP verification error:', error);
      setErrorMessage(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Invalid OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetRegistrationFlow = () => {
    setRegisterStep('init');
    setRegisterData({ aadhaar_number: '', mobile_number: '' });
    setRegisterSession(null);
    setRegisterOtp('');
    setErrorMessage('');
  };

  // ========== LOGIN FLOW ==========

  const handleInitiateLogin = () => {
    // Open official ABDM login page
    window.open('https://abha.abdm.gov.in/abha/v3/login', '_blank');
    setShowLoginModal(false);
    alert('Please log in on the ABDM website, then return here to link the account.');
  };

  const handleVerifyLoginOtp = async () => {
    if (!loginOtp || loginOtp.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.post('/api/abha/login/verify-otp', {
        session_id: loginSession.session_id,
        otp: loginOtp,
        txn_id: loginSession.txn_id
      });

      if (res.data.success) {
        alert('ABHA Login Successful!');
        setShowLoginModal(false);
        resetLoginFlow();
        fetchAbhaStatus();
        if (onAbhaLinked) onAbhaLinked();
      }
    } catch (error) {
      console.error('ABHA login OTP verification error:', error);
      setErrorMessage(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Invalid OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetLoginFlow = () => {
    setLoginStep('init');
    setLoginData({ abha_address: '' });
    setLoginSession(null);
    setLoginOtp('');
    setErrorMessage('');
  };

  // ========== UNLINK ABHA ==========

  const handleUnlinkAbha = async () => {
    if (!confirm('Are you sure you want to unlink this ABHA account?')) {
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/abha/unlink', { patient_id: patientId });
      alert('ABHA account unlinked successfully');
      fetchAbhaStatus();
      if (onAbhaLinked) onAbhaLinked();
    } catch (error) {
      console.error('ABHA unlink error:', error);
      alert('Failed to unlink ABHA account');
    } finally {
      setLoading(false);
    }
  };

  // ========== RENDER ==========

  if (!abhaStatus) {
    return (
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="text-center text-slate-500">Loading ABHA status...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
          ABHA (Ayushman Bharat Health Account)
        </h3>
      </div>

      {abhaStatus.has_abha ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
              ABHA Linked
            </span>
            {abhaStatus.kyc_verified && (
              <span className="inline-flex px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                KYC Verified
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">ABHA Number</p>
              <p className="font-semibold">{abhaStatus.abha_number}</p>
            </div>
            {abhaStatus.abha_address && (
              <div>
                <p className="text-xs text-slate-500">ABHA Address</p>
                <p className="font-semibold">{abhaStatus.abha_address}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="font-semibold capitalize">{abhaStatus.status}</p>
            </div>
            {abhaStatus.registered_at && (
              <div>
                <p className="text-xs text-slate-500">Registered On</p>
                <p className="font-semibold">
                  {new Date(abhaStatus.registered_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleUnlinkAbha}
              disabled={loading}
              className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Unlink ABHA
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Link this patient's ABHA account to enable seamless health data exchange across healthcare providers.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => window.open('https://abha.abdm.gov.in/abha/v3/register/aadhaar', '_blank')}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Register New ABHA
            </button>
            <button
              onClick={() => window.open('https://abha.abdm.gov.in/abha/v3/login', '_blank')}
              className="px-4 py-2 border rounded hover:bg-slate-50"
            >
              Link Existing ABHA
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            You will be redirected to the official ABDM website to register or link your ABHA account.
          </p>
        </div>
      )}

      {/* Registration Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          resetRegistrationFlow();
        }}
        title="Register New ABHA"
        size="md"
      >
        <div className="space-y-4">
          {registerStep === 'init' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Aadhaar Number *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter 12-digit Aadhaar number"
                  maxLength="12"
                  value={registerData.aadhaar_number}
                  onChange={(e) => setRegisterData({ ...registerData, aadhaar_number: e.target.value.replace(/\D/g, '') })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  OTP will be sent to Aadhaar registered mobile number
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mobile Number (Optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter mobile number"
                  maxLength="10"
                  value={registerData.mobile_number}
                  onChange={(e) => setRegisterData({ ...registerData, mobile_number: e.target.value.replace(/\D/g, '') })}
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    resetRegistrationFlow();
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiateRegistration}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  OTP has been sent to your Aadhaar registered mobile number.
                  Session expires in {Math.floor((registerSession?.expires_in || 900) / 60)} minutes.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enter OTP *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength="6"
                  value={registerOtp}
                  onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRegisterStep('init')}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyRegistrationOtp}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Login Modal */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          resetLoginFlow();
        }}
        title="Link Existing ABHA"
        size="md"
      >
        <div className="space-y-4">
          {loginStep === 'init' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">ABHA Address *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., username@abdm"
                  value={loginData.abha_address}
                  onChange={(e) => setLoginData({ ...loginData, abha_address: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  OTP will be sent to registered mobile number
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    resetLoginFlow();
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiateLogin}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  OTP has been sent to your registered mobile number.
                  Session expires in {Math.floor((loginSession?.expires_in || 900) / 60)} minutes.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enter OTP *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength="6"
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setLoginStep('init')}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyLoginOtp}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
