import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { FaShieldAlt, FaCogs, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaMobileAlt, FaArrowLeft } from 'react-icons/fa';

export default function EnhancedLogin() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();
  const api = useApiClient();
  
  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  // OTP states
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');

  // Handle credential submission
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // First, verify credentials and get mobile number
      const res = await api.post('/api/auth/verify-credentials', { email, password });
      
      if (res.data.success) {
        // Check if admin user - skip OTP
        if (res.data.user.role === 'admin') {
          // Direct login for admin
          const loginResponse = await api.post('/api/auth/login', { email, password });
          const loginData = loginResponse.data?.data || loginResponse.data;
          setToken(loginData.token);
          setUser(loginData.user);
          navigate('/queue');
          return;
        }

        // Credentials valid, send OTP for non-admin
        setUserEmail(email);
        setUserPassword(password);
        setMobileNumber(res.data.mobile_number);
        setShowOTP(true);
        
        // Send OTP
        await sendOTP({ email, mobile: res.data.mobile_number, userId: res.data.user_id });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP
  const sendOTP = async ({ email: targetEmail, mobile, userId }) => {
    try {
      setOtpLoading(true);
      await api.post('/api/otp-auth/send', {
        email: targetEmail,
        mobile_number: mobile,
        user_id: userId
      });
      
      // Start resend timer
      setResendTimer(60);
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle OTP submission
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Verify OTP and complete login
      const res = await api.post('/api/otp-auth/verify', {
        email: userEmail,
        otp: otp
      });
      
      if (res.data.success) {
        // OTP verified, now login with original credentials
        const loginRes = await api.post('/api/auth/login', { 
          email: userEmail, 
          password: userPassword 
        });
        
        const loginData = loginRes.data?.data || loginRes.data;
        setToken(loginData.token);
        setUser(loginData.user);
        navigate('/queue');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    try {
      const res = await api.post('/api/auth/verify-credentials', { 
        email: userEmail, 
        password: userPassword 
      });
      
      if (res.data.success) {
        await sendOTP({ email: userEmail, mobile: res.data.mobile_number, userId: res.data.user_id });
      }
    } catch (err) {
      setError('Failed to resend OTP');
    }
  };

  // Go back to credential form
  const handleBackToLogin = () => {
    setShowOTP(false);
    setOtp('');
    setMobileNumber('');
    setUserEmail('');
    setUserPassword('');
    setResendTimer(0);
  };

  return (
    <div className={`min-h-screen flex 'bg-gray-50'`}>
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

        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-4">
            {showOTP ? 'Verify Your Identity' : 'Welcome Back'}
          </h1>
          <p className="text-blue-100 text-lg mb-6">
            {showOTP 
              ? `Enter the OTP sent to ${mobileNumber}`
              : 'Secure login with OTP verification'
            }
          </p>
          
          {!showOTP && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <FaShieldAlt className="text-sm" />
                </div>
                <span className="text-blue-100">Secure OTP Authentication</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <FaMobileAlt className="text-sm" />
                </div>
                <span className="text-blue-100">Mobile Verification Required</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <FaCogs className="text-sm" />
                </div>
                <span className="text-blue-100">Advanced Security Features</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div className="relative z-10">
          <p className="text-blue-200 text-sm">
            Â© 2024 Patient Management System. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <FaShieldAlt className="text-white text-xl" />
              </div>
              <span className="text-xl font-semibold text-gray-800">Medical Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              {showOTP ? 'Verify OTP' : 'Login'}
            </h1>
          </div>

          {/* Back Button for OTP Screen */}
          {showOTP && (
            <button
              onClick={handleBackToLogin}
              className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <FaArrowLeft className="text-sm" />
              <span className="text-sm">Back to Login</span>
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {!showOTP ? (
            /* Credential Form */
            <form onSubmit={handleCredentialSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">Keep me logged in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {loading ? 'Verifying...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            /* OTP Form */
            <form onSubmit={handleOTPSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP
                </label>
                <div className="relative">
                  <FaMobileAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono"
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  OTP sent to {mobileNumber}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendTimer > 0 || otpLoading}
                  className="text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {otpLoading ? 'Sending...' : 
                   resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 
                   'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* Links */}
          <div className="mt-6 text-center space-y-2">
            <Link to="/doctor-otp-login" className="block text-sm text-blue-600 hover:text-blue-700 font-medium">
              ðŸ” Doctor OTP Login â†’
            </Link>
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-700 font-medium">
              â† Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

