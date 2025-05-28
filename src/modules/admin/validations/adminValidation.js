const Joi = require('joi');

// User management schemas
const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).optional(),
  status: Joi.string().valid('active', 'suspended', 'banned', 'deleted').optional(),
  role: Joi.string().valid('user', 'admin').optional(),
  sortBy: Joi.string()
    .valid('createdAt', 'username', 'email', 'lastActive', 'karmaPoints')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'suspended', 'banned').required().messages({
    'any.required': 'Status is required',
    'any.only': 'Invalid status value'
  }),
  reason: Joi.string().trim().min(10).max(500).required().messages({
    'string.min': 'Reason must be at least 10 characters',
    'string.max': 'Reason cannot exceed 500 characters',
    'any.required': 'Reason is required'
  })
});

// Report management schemas
const getReportsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('open', 'under_review', 'resolved', 'dismissed').optional(),
  reportType: Joi.string()
    .valid('user_profile', 'chat_message', 'lobby_behavior', 'cheating', 'other')
    .optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  assignedTo: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  sortBy: Joi.string().valid('createdAt', 'priority', 'status', 'reportType').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const updateReportSchema = Joi.object({
  status: Joi.string().valid('open', 'under_review', 'resolved', 'dismissed').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  assignedTo: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .optional(),
  adminNote: Joi.string().trim().max(1000).optional(),
  resolution: Joi.object({
    action: Joi.string().valid('no_action', 'warning', 'suspension', 'ban', 'other').required(),
    notes: Joi.string().trim().max(1000).required()
  }).optional()
}).min(1);

// User report schemas (non-admin)
const submitReportSchema = Joi.object({
  reportedId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'Reported user ID is required'
    }),
  reportType: Joi.string()
    .valid('user_profile', 'chat_message', 'lobby_behavior', 'cheating', 'other')
    .required()
    .messages({
      'any.required': 'Report type is required'
    }),
  reason: Joi.string()
    .valid(
      'inappropriate_content',
      'harassment',
      'spam',
      'cheating',
      'impersonation',
      'hate_speech',
      'threats',
      'other'
    )
    .required()
    .messages({
      'any.required': 'Reason is required'
    }),
  description: Joi.string().trim().min(20).max(1000).required().messages({
    'string.min': 'Description must be at least 20 characters',
    'string.max': 'Description cannot exceed 1000 characters',
    'any.required': 'Description is required'
  }),
  evidence: Joi.object({
    screenshots: Joi.array().items(Joi.string().uri()).max(5).optional(),
    chatLogIds: Joi.array()
      .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
      .max(10)
      .optional(),
    matchId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
  }).optional()
});

const getMyReportsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('open', 'under_review', 'resolved', 'dismissed').optional()
});

// Parameter validation schemas
const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format'
    })
});

const reportIdParamSchema = Joi.object({
  reportId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid report ID format'
    })
});

module.exports = {
  getUsersQuerySchema,
  updateUserStatusSchema,
  getReportsQuerySchema,
  updateReportSchema,
  submitReportSchema,
  getMyReportsQuerySchema,
  userIdParamSchema,
  reportIdParamSchema
};
