const Joi = require('joi');

// Password requirements
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required'
  });

// Registration validation schema
const registerSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),

  username: Joi.string().alphanum().min(3).max(30).required().trim().messages({
    'string.alphanum': 'Username can only contain letters and numbers',
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username cannot exceed 30 characters',
    'any.required': 'Username is required'
  }),

  password: passwordSchema,

  displayName: Joi.string().min(2).max(50).trim().optional()
});

// Login validation schema
const loginSchema = Joi.object({
  credential: Joi.string().required().trim().messages({
    'any.required': 'Email or username is required'
  }),

  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

// Refresh token validation schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

// Password reset request schema
const resetPasswordRequestSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

// Password reset confirmation schema
const resetPasswordConfirmSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),

  newPassword: passwordSchema
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema
};
