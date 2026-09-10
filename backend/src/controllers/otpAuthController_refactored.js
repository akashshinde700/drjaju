const OtpAuthService = require('../services/OtpAuthService');
const ApiResponse = require('../middleware/apiResponse');
const { asyncHandler } = require('../utils');

exports.requestOtp = asyncHandler(async (req, res) => {
  try {
    const { email, mobileNumber } = req.body;

    if (!email) {
      return ApiResponse.validationError(res, null, 'Email is required');
    }

    const result = await OtpAuthService.requestOtp({ email, mobileNumber });

    if (!result.ok) {
      if (result.code === 'not_found') return ApiResponse.notFound(res, result.message);
      if (result.code === 'validation') return ApiResponse.validationError(res, null, result.message);
      return ApiResponse.error(res, result.message || 'Failed to request OTP', 500);
    }

    return ApiResponse.success(res, result.data, 'OTP sent successfully', 200);
  } catch (error) {
    console.error('OTP request error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.sendOtp = asyncHandler(async (req, res) => {
  try {
    const { email, mobile_number, user_id } = req.body;

    if (!email || !mobile_number || !user_id) {
      return ApiResponse.validationError(res, null, 'Email, mobile number, and user ID are required');
    }

    const result = await OtpAuthService.sendOtp({ email, mobile_number, user_id });

    if (!result.ok) {
      return ApiResponse.error(res, result.message || 'Failed to send OTP', 500);
    }

    return ApiResponse.success(res, result.data, 'OTP sent to your email and mobile', 200);
  } catch (error) {
    console.error('OTP send error:', error);
    return ApiResponse.serverError(res, 'Failed to send OTP');
  }
});

exports.verifyDoctor = asyncHandler(async (req, res) => {
  try {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return ApiResponse.validationError(res, null, 'OTP ID and OTP are required');
    }

    const result = await OtpAuthService.verifyDoctorOtp({ otpId, otp, ip: req.ip });

    if (!result.ok) {
      if (result.code === 'not_found') return ApiResponse.notFound(res, result.message);
      return ApiResponse.error(res, result.message, 400);
    }

    return ApiResponse.success(res, result.data, 'Login successful', 200);
  } catch (error) {
    console.error('OTP verification error:', error);
    return ApiResponse.serverError(res, 'Failed to verify OTP');
  }
});

exports.verify = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return ApiResponse.validationError(res, null, 'Email and OTP are required');
    }

    const result = await OtpAuthService.verifyOtp({ email, otp });

    if (!result.ok) {
      return ApiResponse.error(res, result.message, 400);
    }

    return ApiResponse.success(res, result.data, 'OTP verification successful', 200);
  } catch (error) {
    console.error('OTP verification error:', error);
    return ApiResponse.serverError(res, 'Failed to verify OTP');
  }
});

exports.status = asyncHandler(async (req, res) => {
  try {
    const { otpId } = req.params;
    const result = OtpAuthService.getOtpStatus({ otpId });
    return ApiResponse.success(res, result.data, 'OTP status retrieved', 200);
  } catch (error) {
    console.error('OTP status error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});

exports.resend = asyncHandler(async (req, res) => {
  try {
    const { email, mobileNumber } = req.body;

    if (!email || !mobileNumber) {
      return ApiResponse.validationError(res, null, 'Email and mobile number are required');
    }

    const result = await OtpAuthService.resendOtp({ email, mobileNumber });

    if (!result.ok) {
      return ApiResponse.notFound(res, result.message);
    }

    return ApiResponse.success(res, result.data, 'OTP resent successfully', 200);
  } catch (error) {
    console.error('OTP resend error:', error);
    return ApiResponse.serverError(res, error.message);
  }
});
