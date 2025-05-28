const express = require('express');
const reportController = require('../controllers/reportController');
const { validateRequest, validateParams, validateQuery } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  submitReportSchema,
  reportIdParamSchema,
  getMyReportsQuerySchema
} = require('../validations/adminValidation');

const router = express.Router();

// All report routes require authentication
router.use(authenticate);

// Submit a report
router.post(
  '/',
  rateLimiter.strict, // Limit report submissions
  validateRequest(submitReportSchema),
  reportController.submitReport
);

// Get user's submitted reports
router.get(
  '/my-reports',
  rateLimiter.standard,
  validateQuery(getMyReportsQuerySchema),
  reportController.getMyReports
);

// Get specific report (only if user submitted it)
router.get(
  '/:reportId',
  rateLimiter.standard,
  validateParams(reportIdParamSchema),
  reportController.getReport
);

module.exports = router;
