const express = require('express');
const authController = require('../controllers/authController');
const { validateRequest } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema
} = require('../validations/authValidation');

const router = express.Router();

// Public routes
router.post('/auth/register',
  rateLimiter.strict,
  validateRequest(registerSchema),
  authController.register
);

router.post('/auth/login',
  rateLimiter.strict,
  validateRequest(loginSchema),
  authController.login
);

router.post('/auth/refresh',
  rateLimiter.standard,
  validateRequest(refreshTokenSchema),
  authController.refreshToken
);

router.post('/auth/reset-password',
  rateLimiter.strict,
  validateRequest(resetPasswordRequestSchema),
  authController.resetPasswordRequest
);

router.post('/auth/reset-password/confirm',
  rateLimiter.strict,
  validateRequest(resetPasswordConfirmSchema),
  authController.resetPasswordConfirm
);

// Protected routes
router.post('/auth/logout',
  authenticate,
  rateLimiter.standard,
  authController.logout
);

module.exports = router;