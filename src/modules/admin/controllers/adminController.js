const adminService = require('../services/adminService');
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * Get users list
 */
const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    role,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const result = await adminService.getUsers({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    search,
    status,
    role,
    sortBy,
    sortOrder
  });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get user details
 */
const getUserDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const result = await adminService.getUserDetails(userId);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Update user status
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status, reason } = req.body;
  const adminId = req.user.id;

  const user = await adminService.updateUserStatus(adminId, userId, status, reason);

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

/**
 * Get reports list
 */
const getReports = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    reportType,
    priority,
    assignedTo,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const result = await adminService.getReports({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status,
    reportType,
    priority,
    assignedTo,
    sortBy,
    sortOrder
  });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get report details
 */
const getReportDetails = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await adminService.getReportDetails(reportId);

  res.status(200).json({
    status: 'success',
    data: { report }
  });
});

/**
 * Update report
 */
const updateReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { status, priority, assignedTo, adminNote, resolution } = req.body;
  const adminId = req.user.id;

  const report = await adminService.updateReportStatus(adminId, reportId, {
    status,
    priority,
    assignedTo,
    adminNote,
    resolution
  });

  res.status(200).json({
    status: 'success',
    data: { report }
  });
});

/**
 * Get dashboard statistics
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();

  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});

module.exports = {
  getUsers,
  getUserDetails,
  updateUserStatus,
  getReports,
  getReportDetails,
  updateReport,
  getDashboardStats
};
