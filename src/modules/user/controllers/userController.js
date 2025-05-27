const userService = require('../services/userService');
const asyncHandler = require('../../../utils/asyncHandler');

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user.id);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const updateGamingPreferences = asyncHandler(async (req, res) => {
  const user = await userService.updateGamingPreferences(req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const upsertGameProfile = asyncHandler(async (req, res) => {
  const user = await userService.upsertGameProfile(req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const removeGameProfile = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const user = await userService.removeGameProfile(req.user.id, gameId);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const updateNotificationSettings = asyncHandler(async (req, res) => {
  const user = await userService.updateNotificationSettings(req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const addDeviceToken = asyncHandler(async (req, res) => {
  const user = await userService.addDeviceToken(req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

const removeDeviceToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const user = await userService.removeDeviceToken(req.user.id, token);
  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

module.exports = {
  getMe,
  updateProfile,
  updateGamingPreferences,
  upsertGameProfile,
  removeGameProfile,
  updateNotificationSettings,
  addDeviceToken,
  removeDeviceToken
};
