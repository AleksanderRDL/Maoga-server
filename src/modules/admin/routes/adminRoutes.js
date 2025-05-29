const express = require('express');
const adminController = require('../controllers/adminController');
const { validateQuery, validateRequest, validateParams } = require('../../../middleware/validator');
const { authenticate, authorize } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  getUsersQuerySchema,
  updateUserStatusSchema,
  getReportsQuerySchema,
  updateReportSchema,
  userIdParamSchema,
  reportIdParamSchema
} = require('../validations/adminValidation');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, authorize('admin'));

// User management routes
router.get(
  '/users',
  rateLimiter.standard,
  validateQuery(getUsersQuerySchema),
  adminController.getUsers
);

router.get(
  '/users/:userId',
  rateLimiter.standard,
  validateParams(userIdParamSchema),
  adminController.getUserDetails
);

router.patch(
  '/users/:userId/status',
  rateLimiter.strict,
  validateParams(userIdParamSchema),
  validateRequest(updateUserStatusSchema),
  adminController.updateUserStatus
);

// Report management routes
router.get(
  '/reports',
  rateLimiter.standard,
  validateQuery(getReportsQuerySchema),
  adminController.getReports
);

router.get(
  '/reports/:reportId',
  rateLimiter.standard,
  validateParams(reportIdParamSchema),
  adminController.getReportDetails
);

router.patch(
  '/reports/:reportId',
  rateLimiter.standard,
  validateParams(reportIdParamSchema),
  validateRequest(updateReportSchema),
  adminController.updateReport
);

router.get('/stats/sockets', rateLimiter.relaxed, adminController.getSocketStats);

// Dashboard statistics
router.get('/stats/dashboard', rateLimiter.relaxed, adminController.getDashboardStats);

module.exports = router;
