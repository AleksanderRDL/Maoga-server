const { ValidationError } = require('../utils/errors');

/**
 * Validate request data against Joi schema
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    // Validate request body
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      // Format validation errors
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      throw new ValidationError('Validation failed', 'VALIDATION_ERROR', details);
    }

    // Replace request body with validated value
    req.body = value;
    next();
  };
};

/**
 * Validate query parameters against Joi schema
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      throw new ValidationError('Query validation failed', 'VALIDATION_ERROR', details);
    }

    req.query = value;
    next();
  };
};

/**
 * Validate route parameters against Joi schema
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      throw new ValidationError('Parameter validation failed', 'VALIDATION_ERROR', details);
    }

    req.params = value;
    next();
  };
};

module.exports = {
  validateRequest,
  validateQuery,
  validateParams
};