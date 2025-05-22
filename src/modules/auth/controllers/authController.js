// src/modules/auth/controllers/authController.js
const authService = require('../services/authService');
const asyncHandler = require('../../../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.status(201).json({
    status: 'success',
    data: { user, accessToken, refreshToken }
  });
});

const login = asyncHandler(async (req, res) => {
  const { credential, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(credential, password);
  res.status(200).json({
    status: 'success',
    data: { user, accessToken, refreshToken }
  });
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: tokenFromBody } = req.body; // Ensure no naming conflict if 'refreshToken' is already a var
  const tokens = await authService.refreshToken(tokenFromBody);
  res.status(200).json({
    status: 'success',
    data: tokens
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken: tokenFromBody } = req.body;
  await authService.logout(req.user.id, tokenFromBody);
  res.status(200).json({
    status: 'success',
    data: { message: 'Logged out successfully' }
  });
});

const resetPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.resetPasswordRequest(email);
  res.status(200).json({
    status: 'success',
    data: result
  });
});

const resetPasswordConfirm = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  await authService.resetPasswordConfirm(token, newPassword);
  res.status(200).json({
    status: 'success',
    data: { message: 'Password reset successfully' }
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  resetPasswordRequest,
  resetPasswordConfirm
};
