const logger = require('../utils/logger');
const { AppError, ValidationError } = require('../utils/errors');
const config = require('../config');

// Convert non-operational errors to operational errors
const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400, 'CAST_ERROR');
};

const handleDuplicateFieldsDB = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists`;
    return new AppError(message, 409, 'DUPLICATE_FIELD');
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(el => ({
        field: el.path,
        message: el.message
    }));

    return new ValidationError('Validation failed', 'VALIDATION_ERROR', errors);
};

const handleJWTError = () =>
    new AppError('Invalid token. Please log in again', 401, 'JWT_ERROR');

const handleJWTExpiredError = () =>
    new AppError('Your token has expired. Please log in again', 401, 'JWT_EXPIRED');

// Send error response
const sendErrorDev = (err, req, res) => {
    res.status(err.statusCode).json({
        status: 'error',
        error: {
            code: err.errorCode,
            message: err.message,
            stack: err.stack,
            details: err.details || null,
            ...err
        }
    });
};

const sendErrorProd = (err, req, res) => {
    // Operational, trusted error: send message to client
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
        // Programming or other unknown error: don't leak error details
        logger.error('ERROR 💥', err);

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
    err.statusCode = err.statusCode || 500;
    err.errorCode = err.errorCode || 'UNKNOWN_ERROR';

    // Log error with request context
    const requestId = req.id || 'no-request-id';
    const userId = req.user?.id || 'unauthenticated';

    logger.error({
        msg: 'Request error',
        error: {
            message: err.message,
            code: err.errorCode,
            statusCode: err.statusCode,
            stack: err.stack
        },
        request: {
            id: requestId,
            method: req.method,
            url: req.originalUrl,
            userId: userId,
            ip: req.ip
        }
    });

    if (config.env === 'development') {
        sendErrorDev(err, req, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        // Handle specific MongoDB/Mongoose errors
        if (err.name === 'CastError') error = handleCastErrorDB(err);
        if (err.code === 11000) error = handleDuplicateFieldsDB(err);
        if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
        if (err.name === 'JsonWebTokenError') error = handleJWTError();
        if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, req, res);
    }
};

module.exports = {
    globalErrorHandler
};