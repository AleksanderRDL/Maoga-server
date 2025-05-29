const { expect } = require('chai');
const sinon = require('sinon');
const { authorize } = require('../../../src/middleware/auth');
const { AuthenticationError, AuthorizationError } = require('../../../src/utils/errors');

describe('Auth Middleware - authorize', () => {
  let mockReq, mockRes, nextSpy;

  beforeEach(() => {
    mockReq = { user: null };
    mockRes = {};
    nextSpy = sinon.spy();
  });

  it('should call next() if user has an allowed role', () => {
    mockReq.user = { id: 'user1', role: 'admin' };
    const authMiddleware = authorize('admin', 'editor');
    authMiddleware(mockReq, mockRes, nextSpy);
    expect(nextSpy.calledOnce).to.be.true;
    expect(nextSpy.calledWithExactly()).to.be.true;
  });

  it('should call next() if user has one of multiple allowed roles', () => {
    mockReq.user = { id: 'user2', role: 'editor' };
    const authMiddleware = authorize('admin', 'editor', 'viewer');
    authMiddleware(mockReq, mockRes, nextSpy);
    expect(nextSpy.calledOnce).to.be.true;
    expect(nextSpy.calledWithExactly()).to.be.true;
  });

  it('should throw AuthorizationError if user role is not in allowedRoles', () => {
    mockReq.user = { id: 'user3', role: 'user' };
    const authMiddleware = authorize('admin', 'editor');
    // Expect the middleware to throw the error directly
    expect(() => authMiddleware(mockReq, mockRes, nextSpy)).to.throw(
      AuthorizationError,
      'Insufficient permissions'
    );
    expect(nextSpy.called).to.be.false; // next() should not be called if error is thrown
  });

  it('should throw AuthenticationError if req.user is not defined', () => {
    mockReq.user = undefined;
    const authMiddleware = authorize('admin');
    expect(() => authMiddleware(mockReq, mockRes, nextSpy)).to.throw(
      AuthenticationError,
      'User not authenticated'
    );
    expect(nextSpy.called).to.be.false;
  });

  it('should throw AuthorizationError if req.user.role is not defined', () => {
    mockReq.user = { id: 'user4' }; // Role is missing
    const authMiddleware = authorize('admin');
    // This will be caught as AuthorizationError because undefined role won't match 'admin'
    expect(() => authMiddleware(mockReq, mockRes, nextSpy)).to.throw(
      AuthorizationError,
      'Insufficient permissions'
    );
    expect(nextSpy.called).to.be.false;
  });

  it('should handle empty allowedRoles (no roles allowed - effectively denying all)', () => {
    mockReq.user = { id: 'user5', role: 'user' };
    const authMiddleware = authorize(); // No roles passed
    expect(() => authMiddleware(mockReq, mockRes, nextSpy)).to.throw(
      AuthorizationError,
      'Insufficient permissions'
    );
    expect(nextSpy.called).to.be.false;
  });
});
