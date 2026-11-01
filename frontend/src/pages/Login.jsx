import { useState, useEffect } from 'react';
import { useNavigate as _useNavigate, Link } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { FaShieldAlt, FaCogs, FaEye, FaEyeSlash, FaMobileAlt, FaLock } from 'react-icons/fa';

export default function Login() {
  // const navigate = useNavigate(); // Currently handled via setToken in useAuth
  const { setToken, setUser } = useAuth();
  const api = useApiClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  
  // OTP states
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');
  const [_otpId, _setOtpId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Timer for OTP expiry
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && showOTP) {
      setCanResend(true);
    }
  }, [timeLeft, showOTP]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Step 1: Verify credentials and get mobile number
      const response = await api.post('/api/auth/verify-credentials', { email, password });
      const payload = response.data?.data || response.data;

      if (response.data?.success) {
        setUserInfo(payload.user);
        setMobileNumber(payload.mobile_number);

        // Check if admin user - skip OTP
        if (payload.user.role === 'admin') {
          // Direct login for admin
          const loginResponse = await api.post('/api/auth/login', { email, password });
          const loginData = loginResponse.data?.data || loginResponse.data;
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          setToken(loginData.token);
          setUser(loginData.user);
          window.location.replace('/queue');
          return;
        }

        // Step 2: Send OTP for non-admin users
        const otpResponse = await api.post('/api/otp-auth/send', {
          email: payload.email,
          mobile_number: payload.mobile_number,
          user_id: payload.user_id
        });

        const otpPayload = otpResponse.data?.data || otpResponse.data;

        if (otpResponse.data?.success) {
          _setOtpId(otpPayload.otpId);
          setShowOTP(true);
          setTimeLeft(Math.floor(otpPayload.expiresIn / 1000));
          setCanResend(false);
          setError('');
        } else {
          setError(otpResponse.data?.error || otpResponse.data?.message || 'Failed to send OTP');
        }
      } else {
        setError(response.data?.error || response.data?.message || 'Invalid credentials');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Step 1: Verify OTP
      const verifyResponse = await api.post('/api/otp-auth/verify', { email, otp });
      if (verifyResponse.data?.success) {
        // Step 2: Complete login
        const res = await api.post('/api/auth/login', { email, password });
        const loginData = res.data?.data || res.data;
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('user', JSON.stringify(loginData.user));
        setToken(loginData.token);
        setUser(loginData.user);
        window.location.replace('/queue');
      } else {
        setError(verifyResponse.data?.error || verifyResponse.data?.message || 'Invalid OTP');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/api/otp-auth/send', {
        email,
        mobile_number: mobileNumber,
        user_id: userInfo?.id
      });

      const payload = response.data?.data || response.data;

      if (response.data?.success) {
        _setOtpId(payload.otpId);
        setTimeLeft(Math.floor(payload.expiresIn / 1000));
        setCanResend(false);
        setOtp('');
        setError('');
      } else {
        setError(response.data?.error || response.data?.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setShowOTP(false);
    setOtp('');
    _setOtpId('');
    setMobileNumber('');
    setUserInfo('');
    setTimeLeft(0);
    setCanResend(false);
    setError('');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Panel - Blue Gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/5 rounded-full"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-white/5 rounded-full"></div>
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white/5 rounded-full"></div>

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <FaShieldAlt className="text-white text-xl" />
          </div>
          <span className="text-xl font-semibold">Medical Portal</span>
        </div>

        {/* Main Content */}
        <div className="relative z-10">
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Welcome Back,<br />Doctor.
          </h1>
          <p className="text-blue-100 text-lg max-w-md leading-relaxed">
            Access the patient management portal to provide world-class care. Your dedicated space for medical excellence and streamlined workflows.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="flex gap-4 relative z-10">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex-1 border border-white/20">
            <FaShieldAlt className="text-xl mb-2" />
            <h3 className="font-semibold text-sm">Secure Portal</h3>
            <p className="text-xs text-blue-200 mt-1">End-to-end encrypted medical records access.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex-1 border border-white/20">
            <FaCogs className="text-xl mb-2" />
            <h3 className="font-semibold text-sm">Optimized Workflow</h3>
            <p className="text-xs text-blue-200 mt-1">Manage your clinic schedule efficiently.</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-sm text-blue-200 relative z-10">
          &copy; 2025 Medical Systems
        </p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <FaShieldAlt className="text-white text-xl" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Medical Portal</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="mt-2 text-gray-600">
              Enter your credentials to access the medical dashboard.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {!showOTP ? (
            <form onSubmit={handleCredentialSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium mb-2 text-gray-700">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinic.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                  } outline-none transition`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className={`w-full pl-4 pr-12 py-3 rounded-xl border ${
                      'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                    } outline-none transition`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="keepLoggedIn"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="keepLoggedIn" className="ml-2 text-sm text-gray-600">
                  Keep me logged in
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying credentials...
                  </>
                ) : (
                  <>
                    Sign In to Portal
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOTPSubmit} className="space-y-5">
              {/* User Info Display */}
              {userInfo && (
                <div className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
                        <span className="text-sm font-medium text-blue-600">
                          {userInfo.role.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">{userInfo.name}</p>
                        <p className="text-sm text-gray-600">{userInfo.role}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-blue-700">
                    OTP sent to: <strong>{mobileNumber}</strong>
                  </p>
                  {timeLeft > 0 && (
                    <p className="text-sm text-blue-600 mt-1">
                      Expires in: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Enter 6-digit OTP
                </label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    maxLength={6}
                    required
                    disabled={loading}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-center text-lg font-mono ${
                      'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                    } outline-none transition`}
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying OTP...
                    </>
                  ) : (
                    <>
                      Verify & Login
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  disabled={loading}
                  className={`px-4 py-3 rounded-xl border transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center ${
                    'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              </div>

              {canResend && (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl border transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Resend OTP
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          <p className="text-center text-xs mt-6 text-gray-400">
            AUTHORIZED PERSONNEL ONLY
          </p>

          {/* Dead "Switch to Dark Mode" button removed (no-op onClick, no theme
              system wired). "Forgot Password?" removed likewise — no reset flow
              exists on the backend; a button that does nothing erodes trust. */}

          {/* Back to Home */}
          <div className="mt-6 text-center space-y-2">
            <Link to="/doctor-otp-login" className="block text-sm text-blue-600 hover:text-blue-700 font-medium">
              <FaMobileAlt className="inline mr-1" /> Doctor OTP Login &rarr;
            </Link>
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-700 font-medium">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


