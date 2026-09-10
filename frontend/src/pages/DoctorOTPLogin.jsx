import React, { useState, useEffect } from 'react';
import { FiMail, FiSmartphone, FiLock, FiArrowLeft, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

const DoctorOTPLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [step, setStep] = useState(1); // 1: Request OTP, 2: Verify OTP
  const [formData, setFormData] = useState({
    email: ''
  });
  const [otpData, setOtpData] = useState({
    otpId: '',
    otp: ''
  });
  const [mobileNumber, setMobileNumber] = useState('');
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

  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    
    if (!otpData.otp) {
      newErrors.otp = 'OTP is required';
    } else if (!/^\d{6}$/.test(otpData.otp)) {
      newErrors.otp = 'OTP must be 6 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    
    if (!validateStep1()) return;
    
    setLoading(true);
    setErrors({});
    setSuccess('');
    
    try {
      const response = await fetch('/api/otp-auth/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setOtpData({ ...otpData, otpId: data.data.otpId });
        setMobileNumber(data.data.mobileNumber || formData.email);
        setStep(2);
        setTimeLeft(Math.floor(data.data.expiresIn / 1000));
        setCanResend(false);
        setSuccess(`OTP sent to ${data.data.mobileNumber || formData.email}`);
      } else {
        setErrors({ general: data.message || 'Failed to send OTP' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!validateStep2()) return;
    
    setLoading(true);
    setErrors({});
    setSuccess('');
    
    try {
      const response = await fetch('/api/otp-auth/verify-doctor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otpData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Login successful
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        login(data.data.token, data.data.user);
        window.location.replace('/doctor-dashboard');
      } else {
        setErrors({ general: data.message || 'Invalid OTP' });
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
      const response = await fetch('/api/otp-auth/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setOtpData({ ...otpData, otpId: data.data.otpId, otp: '' });
        setTimeLeft(Math.floor(data.data.expiresIn / 1000));
        setCanResend(false);
        setSuccess('OTP resent successfully');
      } else {
        setErrors({ general: data.message || 'Failed to resend OTP' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setOtpData({ otpId: '', otp: '' });
    setMobileNumber('');
    setErrors({});
    setSuccess('');
    setTimeLeft(0);
    setCanResend(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Doctor Login</h1>
            <div className="bg-white/20 p-3 rounded-full">
              <FiLock className="h-6 w-6" />
            </div>
          </div>
          <p className="text-blue-100">
            {step === 1 ? 'Enter your credentials to receive OTP' : 'Enter the OTP sent to your email'}
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
                Enter Details
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
            <form onSubmit={handleRequestOTP} className="space-y-4">
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
                  placeholder="doctor@hospital.com"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
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
                  'Send OTP'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-700">
                  OTP sent to: <strong>{mobileNumber}</strong>
                </p>
                {timeLeft > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                    Expires in: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiLock className="inline h-4 w-4 mr-1" />
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otpData.otp}
                  onChange={(e) => setOtpData({ ...otpData, otp: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono"
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                />
                {errors.otp && (
                  <p className="mt-1 text-sm text-red-600">{errors.otp}</p>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
                >
                  <FiArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </button>
                
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
              </div>

              {canResend && (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" text="" />
                  ) : (
                    <>
                      <FiRefreshCw className="h-4 w-4 mr-1" />
                      Resend OTP
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* Regular Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Or use{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                regular login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorOTPLogin;
