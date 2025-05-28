const reportService = require('../services/reportService');
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * Submit a report
 */
const submitReport = asyncHandler(async (req, res) => {
  const reporterId = req.user.id;
  const reportData = req.body;

  const report = await reportService.submitReport(reporterId, reportData);

  res.status(201).json({
    status: 'success',
    data: { report }
  });
});

/**
 * Get user's submitted reports
 */
const getMyReports = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, status } = req.query;

  const result = await reportService.getUserReports(userId, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status
  });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * Get specific report
 */
const getReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;

  const report = await reportService.getReportById(reportId, userId);

  res.status(200).json({
    status: 'success',
    data: { report }
  });
});

module.exports = {
  submitReport,
  getMyReports,
  getReport
};
