import React, { useState, useEffect } from 'react';
import { FiMail, FiLock, FiArrowLeft, FiRefreshCw, FiCheck, FiUser, FiShield } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

const UniversalOTPLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [otpData, setOtpData] = useState({
    otpId: '',
    otp: ''
  });
  const [mobileNumber, setMobileNumber] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Timer for OTP expiry
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && step === 2) {
      setCanResend(true);
    }
  }, [timeLeft, step]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validateCredentials = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOTP = () => {
    const newErrors = {};
    
    if (!otpData.otp) {
      newErrors.otp = 'OTP is required';
    } else if (!/^\d{6}$/.test(otpData.otp)) {
      newErrors.otp = 'OTP must be 6 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyCredentials = async (e) => {
    e.preventDefault();
    
    if (!validateCredentials()) return;
    
    setLoading(true);
    setErrors({});
    setSuccess('');
    
    try {
      // Step 1: Verify credentials and get mobile number
      const response = await fetch('/api/auth/verify-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      const payload = data?.data || data;
      
      if (data.success) {
        setUserInfo(payload.user);
        setMobileNumber(payload.mobile_number);
        setSuccess('Credentials verified! Sending OTP...');
        
        // Step 2: Send OTP
        setTimeout(() => sendOTP(payload), 500);
        
      } else {
        setErrors({ general: data.error || data.message || 'Invalid credentials' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (userData) => {
    try {
      const response = await fetch('/api/otp-auth/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          mobile_number: userData.mobile_number,
          user_id: userData.user_id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setOtpData({ ...otpData, otpId: data.data.otpId });
        setStep(2);
        setTimeLeft(Math.floor(data.data.expiresIn / 1000));
        setCanResend(false);
        setSuccess(`OTP sent to ${userData.mobile_number} and ${userData.email}`);
      } else {
        setErrors({ general: data.message || 'Failed to send OTP' });
      }
    } catch (error) {
      setErrors({ general: 'Failed to send OTP. Please try again.' });
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!validateOTP()) return;
    
    setLoading(true);
    setErrors({});
    setSuccess('');
    
    try {
      // Step 1: Verify OTP
      const verifyResponse = await fetch('/api/otp-auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          otp: otpData.otp
        })
      });
      
      const verifyData = await verifyResponse.json();
      
      if (verifyData.success) {
        // Step 2: Complete login with credentials
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });
        
        const loginData = await loginResponse.json();
        const loginPayload = loginData?.data || loginData;
        
        if (loginData.success || (loginPayload && loginPayload.token && loginPayload.user)) {
          // Login successful
          login(loginPayload.token, loginPayload.user);
          
          // Redirect based on role
          const user = loginPayload.user;
          switch(user.role) {
            case 'doctor':
              navigate('/doctor-dashboard');
              break;
            case 'staff':
              navigate('/staff-dashboard');
              break;
            case 'receptionist':
              navigate('/reception-dashboard');
              break;
            default:
              navigate('/queue');
          }
        } else {
          setErrors({ general: loginData.error || loginData.message || 'Login failed' });
        }
      } else {
        setErrors({ general: verifyData.error || verifyData.message || 'Invalid OTP' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setErrors({});
    setSuccess('');
    
    try {
      await sendOTP({
        email: formData.email,
        mobile_number: mobileNumber,
        user_id: userInfo?.id
      });
    } catch (error) {
      setErrors({ general: 'Failed to resend OTP' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setOtpData({ otpId: '', otp: '' });
    setMobileNumber('');
    setUserInfo(null);
    setErrors({});
    setSuccess('');
    setTimeLeft(0);
    setCanResend(false);
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'doctor': return <FiUser className="h-5 w-5" />;
      case 'staff': return <FiShield className="h-5 w-5" />;
      case 'receptionist': return <FiUser className="h-5 w-5" />;
      default: return <FiUser className="h-5 w-5" />;
    }
  };

  const getRoleName = (role) => {
    switch(role) {
      case 'doctor': return 'Doctor';
      case 'staff': return 'Staff';
      case 'receptionist': return 'Receptionist';
      case 'patient': return 'Patient';
      default: return 'User';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Secure Login</h1>
            <div className="bg-white/20 p-3 rounded-full">
              <FiLock className="h-6 w-6" />
            </div>
          </div>
          <p className="text-blue-100">
            {step === 1 ? 'Enter your credentials for secure login' : 'Enter the OTP sent to your devices'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > 1 ? <FiCheck className="h-4 w-4" /> : '1'}
              </div>
              <span className={`ml-2 text-sm ${step >= 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                Credentials
              </span>
            </div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > 2 ? <FiCheck className="h-4 w-4" /> : '2'}
              </div>
              <span className={`ml-2 text-sm ${step >= 2 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                Verify OTP
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-6">
          {loading && <LoadingSpinner text="Processing..." />}
          
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.general}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleVerifyCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiMail className="inline h-4 w-4 mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiLock className="inline h-4 w-4 mr-1" />
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <LoadingSpinner size="sm" text="" />
                ) : (
                  'Verify & Send OTP'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              {userInfo && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getRoleIcon(userInfo.role)}
                      <span className="ml-2 font-medium text-blue-900">
                        {getRoleName(userInfo.role)}
                      </span>
                    </div>
                    <span className="text-sm text-blue-700">{userInfo.name}</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    OTP sent to: <strong>{mobileNumber}</strong> and <strong>{formData.email}</strong>
                  </p>
                  {timeLeft > 0 && (
                    <p className="text-sm text-blue-600 mt-1">
                      Expires in: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiLock className="inline h-4 w-4 mr-1" />
                  Enter 6-digit OTP
                </label>
                <input
                  type="text"
                  value={otpData.otp}
                  onChange={(e) => setOtpData({ ...otpData, otp: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono"
                  placeholder="123456"
                  maxLength={6}
                  disabled={loading}
                />
                {errors.otp && (
                  <p className="mt-1 text-sm text-red-600">{errors.otp}</p>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" text="" />
                  ) : (
                    'Verify & Login'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <FiArrowLeft className="h-4 w-4" />
                </button>
              </div>

              {canResend && (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" text="" />
                  ) : (
                    <>
                      <FiRefreshCw className="h-4 w-4 mr-2" />
                      Resend OTP
                    </>
                  )}
                </button>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="text-center text-sm text-gray-600">
            <p>Secure login with OTP verification</p>
            <p className="mt-1">Available for Doctors, Staff, and Patients</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalOTPLogin;
