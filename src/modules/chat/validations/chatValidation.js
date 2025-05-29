const Joi = require('joi');

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 1000 characters',
    'any.required': 'Message content is required'
  }),
  contentType: Joi.string().valid('text', 'emoji').default('text')
});

const getChatHistoryQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  before: Joi.date().iso().optional()
});

module.exports = {
  sendMessageSchema,
  getChatHistoryQuerySchema
};
