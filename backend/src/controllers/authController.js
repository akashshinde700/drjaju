const { ApiResponse, asyncHandler } = require('../utils');
const AuthService = require('../services/AuthService');

// Verify credentials and return mobile number for OTP (Universal - for all users except admin)
const verifyCredentials = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const payload = await AuthService.verifyCredentials({ email, password });

  // Backward compatibility for multiple frontend variants:
  // - some expect { success, data: {...} }
  // - some expect { success, user, mobile_number, user_id }
  res.json(
    ApiResponse.success(
      {
        data: payload,
        ...payload,
      },
      'Credentials verified'
    )
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await AuthService.login({ email, password });
  res.json(ApiResponse.success(result, 'Login successful'));
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, clinic_id, phone } = req.body;
  const result = await AuthService.register({ name, email, password, role, clinic_id, phone });
  res.status(201).json(ApiResponse.created(result, 'User registered successfully'));
});

const verifyToken = asyncHandler(async (req, res) => {
  const user = await AuthService.verifyToken({ user: req.user });
  res.json(ApiResponse.success({ user }, 'Token verified'));
});

const refreshToken = asyncHandler(async (req, res) => {
  const result = await AuthService.refreshToken({ user: req.user });
  res.json(ApiResponse.success(result, 'Token refreshed'));
});

const logout = asyncHandler(async (req, res) => {
  const result = await AuthService.logout();
  res.json(ApiResponse.success(null, result.message));
});

const getMe = asyncHandler(async (req, res) => {
  const me = await AuthService.getMe({ user: req.user });
  res.json(ApiResponse.success(me, 'User profile retrieved'));
});

module.exports = { login, register, verifyToken, refreshToken, logout, verifyCredentials, getMe };
