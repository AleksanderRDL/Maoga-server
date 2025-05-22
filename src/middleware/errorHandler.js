const logger = require('../utils/logger');
const { AppError, ValidationError } = require('../utils/errors');
const config = require('../config');

// Convert non-operational errors to operational errors
const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400, 'CAST_ERROR', true); // Mark as operational
};

const handleDuplicateFieldsDB = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists`;
    return new AppError(message, 409, 'DUPLICATE_FIELD', true); // Mark as operational
};

const handleValidationErrorDB = (mongooseError) => {
    const errors = Object.values(mongooseError.errors).map(el => ({
        field: el.path,
        message: el.message
    }));
    // Use your existing ValidationError which should extend AppError and be operational
    return new ValidationError('Validation failed', 'VALIDATION_ERROR', errors);
};

const handleJWTError = () =>
    new AppError('Invalid token. Please log in again', 401, 'JWT_ERROR', true); // Mark as operational

const handleJWTExpiredError = () =>
    new AppError('Your token has expired. Please log in again', 401, 'JWT_EXPIRED', true); // Mark as operational

// Send error response
const sendErrorDev = (err, req, res) => {
    res.status(err.statusCode).json({
        status: 'error',
        error: {
            code: err.errorCode || (err.isOperational ? 'UNKNOWN_OPERATIONAL_ERROR' : 'UNKNOWN_ERROR'),
            message: err.message,
            stack: err.stack,
            details: err.details || null,
            // For non-operational errors in dev, it's useful to see the original error object if it was wrapped
            ...( !err.isOperational && err.originalError && { originalError: err.originalError })
        }
    });
};

const sendErrorProd = (err, req, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: 'error',
            error: {
                code: err.errorCode,
                message: err.message,
                details: err.details || null
            }
        });
    } else {
        // Non-operational errors: send generic message
        // The detailed error (including stack) is already logged by the main globalErrorHandler
        res.status(500).json({
            status: 'error',
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Something went wrong'
            }
        });
    }
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err); // Delegate to default Express error handler
    }

    let operationalError = err;

    // Ensure statusCode and errorCode are set, and manage isOperational
    if (!(err instanceof AppError)) {
        // For generic errors or specific non-AppErrors we want to convert
        if (config.env === 'production') { // Only transform these specific errors in prod for prod response
            if (err.name === 'CastError') operationalError = handleCastErrorDB(err);
            else if (err.code === 11000) operationalError = handleDuplicateFieldsDB(err);
            else if (err.name === 'ValidationError') operationalError = handleValidationErrorDB(err); // Mongoose's own validation error
            else if (err.name === 'JsonWebTokenError') operationalError = handleJWTError();
            else if (err.name === 'TokenExpiredError') operationalError = handleJWTExpiredError();
            else { // Generic non-AppError
                operationalError = new AppError(err.message, 500, 'UNKNOWN_ERROR', false);
                operationalError.stack = err.stack; // Preserve original stack
                operationalError.originalError = err; // Keep a reference if needed
            }
        } else { // For dev/test, wrap generic errors but keep message/stack for easier debugging
            operationalError = new AppError(err.message, err.statusCode || 500, err.errorCode || 'UNKNOWN_ERROR', false);
            operationalError.stack = err.stack;
            operationalError.originalError = err;
        }
    }
    // At this point, operationalError is guaranteed to be an AppError (or derived)

    logger.error({
        msg: 'Request error',
        error: {
            message: operationalError.message,
            code: operationalError.errorCode,
            statusCode: operationalError.statusCode,
            stack: operationalError.stack,
            isOperational: operationalError.isOperational,
            details: operationalError.details
        },
        request: {
            id: req.id || 'no-request-id',
            method: req.method,
            url: req.originalUrl,
            userId: req.user?.id || 'unauthenticated',
            ip: req.ip
        }
    });

    if (config.env === 'development' || config.env === 'test') {
        sendErrorDev(operationalError, req, res);
    } else { // 'production'
        sendErrorProd(operationalError, req, res);
    }
};

module.exports = {
    globalErrorHandler
};