const { expect } = require('chai');
const sinon = require('sinon');
const { globalErrorHandler } = require('../../../src/middleware/errorHandler');
const {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError
} = require('../../../src/utils/errors');
const logger = require('../../../src/utils/logger');
const config = require('../../../src/config');

describe('GlobalErrorHandler Middleware', () => {
  let mockReq, mockRes, nextSpy, loggerErrorStub, originalNodeEnv;

  beforeEach(() => {
    mockReq = {
      id: 'test-request-id',
      method: 'GET',
      originalUrl: '/test-url',
      ip: '127.0.0.1',
      user: { id: 'test-user-id' }
    };
    mockRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      headersSent: false
    };
    nextSpy = sinon.spy();
    loggerErrorStub = sinon.stub(logger, 'error');
    originalNodeEnv = config.env;
  });

  afterEach(() => {
    sinon.restore();
    config.env = originalNodeEnv; // Restore original config.env
  });

  it('should send a 500 error for generic Error in production with generic message', () => {
    config.env = 'production'; // Simulate production
    const error = new Error('Sensitive generic test error');
    error.stack = 'Test stack trace';
    globalErrorHandler(error, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true; // Should be called once by the main handler
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.message).to.equal('Sensitive generic test error'); // Logged message is original
    expect(loggedError.isOperational).to.be.false;

    expect(mockRes.status.calledWith(500)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR', // sendErrorProd gives this for non-operational
          message: 'Something went wrong' // Generic message to client
        }
      })
    ).to.be.true;
  });

  it('should send detailed error for generic Error in development/test', () => {
    config.env = 'test'; // Simulate test environment
    const error = new Error('Generic test error for dev');
    error.stack = 'Test stack trace for dev';
    globalErrorHandler(error, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.message).to.equal('Generic test error for dev');
    expect(loggedError.isOperational).to.be.false;

    expect(mockRes.status.calledWith(500)).to.be.true;
    const responseJson = mockRes.json.args[0][0];
    expect(responseJson.status).to.equal('error');
    expect(responseJson.error.code).to.equal('UNKNOWN_ERROR');
    expect(responseJson.error.message).to.equal('Generic test error for dev'); // Original message in dev/test
    expect(responseJson.error.stack).to.equal('Test stack trace for dev');
  });

  it('should handle AppError correctly in production (operational)', () => {
    config.env = 'production';
    const error = new NotFoundError('Resource not found here', 'TEST_NOT_FOUND'); // isOperational defaults to true
    globalErrorHandler(error, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    expect(mockRes.status.calledWith(404)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'TEST_NOT_FOUND',
          message: 'Resource not found here',
          details: null
        }
      })
    ).to.be.true;
  });

  it('should handle AppError correctly in development (includes stack)', () => {
    config.env = 'development';
    const error = new AuthenticationError('Auth failed here', 'TEST_AUTH_ERROR');
    error.stack = 'Custom stack';
    globalErrorHandler(error, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    expect(mockRes.status.calledWith(401)).to.be.true;
    const response = mockRes.json.args[0][0];
    expect(response.status).to.equal('error');
    expect(response.error.code).to.equal('TEST_AUTH_ERROR');
    expect(response.error.message).to.equal('Auth failed here');
    expect(response.error.stack).to.equal('Custom stack');
    expect(response.error.details).to.be.null;
  });

  it('should handle ValidationError correctly with details (operational)', () => {
    config.env = 'production';
    const validationDetails = [{ field: 'email', message: 'Email is required' }];
    const error = new ValidationError('Validation issues', 'VAL_ERROR_01', validationDetails); // isOperational true by default
    globalErrorHandler(error, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    expect(mockRes.status.calledWith(422)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'VAL_ERROR_01',
          message: 'Validation issues',
          details: validationDetails
        }
      })
    ).to.be.true;
  });

  // Tests for Mongoose specific error transformations (handleCastErrorDB, etc.)
  // These ensure that even in production, these common DB errors result in specific operational AppErrors.
  it('should handle Mongoose CastError as operational in production', () => {
    config.env = 'production';
    const mongooseError = new Error('Mongoose CastError');
    mongooseError.name = 'CastError';
    mongooseError.path = 'field_name';
    mongooseError.value = 'bad_value';
    globalErrorHandler(mongooseError, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.isOperational).to.be.true; // Transformed to an operational AppError
    expect(loggedError.statusCode).to.equal(400);

    expect(mockRes.status.calledWith(400)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'CAST_ERROR',
          message: 'Invalid field_name: bad_value',
          details: null
        }
      })
    ).to.be.true;
  });

  it('should handle Mongoose DuplicateFieldsDB error (11000) as operational in production', () => {
    config.env = 'production';
    const mongooseError = new Error('Duplicate field');
    mongooseError.code = 11000;
    mongooseError.keyValue = { email: 'test@example.com' };
    globalErrorHandler(mongooseError, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.isOperational).to.be.true;
    expect(loggedError.statusCode).to.equal(409);

    expect(mockRes.status.calledWith(409)).to.be.true;
    expect(
      mockRes.json.calledWithMatch({
        // Use calledWithMatch if details might be null or an object
        status: 'error',
        error: {
          code: 'DUPLICATE_FIELD',
          message: "email 'test@example.com' already exists"
          // details: null // This can be omitted if details is indeed null
        }
      })
    ).to.be.true;
    expect(mockRes.json.args[0][0].error.details).to.be.null;
  });

  it('should handle Mongoose ValidationError as operational in production', () => {
    config.env = 'production';
    const mongooseError = new Error('Mongoose ValidationError');
    mongooseError.name = 'ValidationError'; // This is Mongoose's own ValidationError
    mongooseError.errors = {
      email: { path: 'email', message: 'Email is invalid' },
      password: { path: 'password', message: 'Password is too short' }
    };
    globalErrorHandler(mongooseError, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.isOperational).to.be.true; // Transformed to our operational ValidationError
    expect(loggedError.statusCode).to.equal(422);

    expect(mockRes.status.calledWith(422)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [
            { field: 'email', message: 'Email is invalid' },
            { field: 'password', message: 'Password is too short' }
          ]
        }
      })
    ).to.be.true;
  });

  it('should handle JsonWebTokenError as operational in production', () => {
    config.env = 'production';
    const jwtError = new Error('jwt malformed');
    jwtError.name = 'JsonWebTokenError';
    globalErrorHandler(jwtError, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.isOperational).to.be.true;
    expect(loggedError.statusCode).to.equal(401);

    expect(mockRes.status.calledWith(401)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'JWT_ERROR',
          message: 'Invalid token. Please log in again',
          details: null
        }
      })
    ).to.be.true;
  });

  it('should handle TokenExpiredError as operational in production', () => {
    config.env = 'production';
    const jwtError = new Error('jwt expired');
    jwtError.name = 'TokenExpiredError';
    globalErrorHandler(jwtError, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.calledOnce).to.be.true;
    const loggedError = loggerErrorStub.firstCall.args[0].error;
    expect(loggedError.isOperational).to.be.true;
    expect(loggedError.statusCode).to.equal(401);

    expect(mockRes.status.calledWith(401)).to.be.true;
    expect(
      mockRes.json.calledWith({
        status: 'error',
        error: {
          code: 'JWT_EXPIRED',
          message: 'Your token has expired. Please log in again',
          details: null
        }
      })
    ).to.be.true;
  });

  it('should call next(err) and not log if headers already sent', () => {
    const error = new Error('Test error after headers sent');
    mockRes.headersSent = true;
    globalErrorHandler(error, mockReq, mockRes, nextSpy);

    expect(loggerErrorStub.called).to.be.false; // Logger should not be called from this handler
    expect(mockRes.status.called).to.be.false;
    expect(mockRes.json.called).to.be.false;
    expect(nextSpy.calledOnceWithExactly(error)).to.be.true;
  });
});
