const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const tokenService = require('../../../../../src/modules/auth/services/tokenService');
const config = require('../../../../../src/config');

describe('TokenService', () => {
    describe('generateAccessToken', () => {
        it('should generate a valid access token', () => {
            const user = {
                _id: '123456789',
                email: 'test@example.com',
                username: 'testuser',
                role: 'user'
            };

            const token = tokenService.generateAccessToken(user);
            expect(token).to.be.a('string');
            expect(token.split('.')).to.have.lengthOf(3); // JWT format

            // Verify token
            const decoded = jwt.verify(token, config.jwt.secret);
            expect(decoded.id).to.equal(user._id);
            expect(decoded.email).to.equal(user.email);
            expect(decoded.username).to.equal(user.username);
            expect(decoded.role).to.equal(user.role);
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token', () => {
            const user = {
                _id: '123456789'
            };

            const token = tokenService.generateRefreshToken(user);
            expect(token).to.be.a('string');
            expect(token.split('.')).to.have.lengthOf(3);

            // Verify token
            const decoded = jwt.verify(token, config.jwt.refreshSecret);
            expect(decoded.id).to.equal(user._id);
            expect(decoded.tokenType).to.equal('refresh');
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify a valid access token', () => {
            const user = {
                _id: '123456789',
                email: 'test@example.com',
                username: 'testuser',
                role: 'user'
            };

            const token = tokenService.generateAccessToken(user);
            const decoded = tokenService.verifyAccessToken(token);

            expect(decoded.id).to.equal(user._id);
            expect(decoded.email).to.equal(user.email);
            expect(decoded.username).to.equal(user.username);
            expect(decoded.role).to.equal(user.role);
        });

        it('should throw error for invalid token', () => {
            expect(() => {
                tokenService.verifyAccessToken('invalid.token.here');
            }).to.throw('Invalid access token');
        });

        it('should throw error for expired token', () => {
            const token = jwt.sign(
                { id: '123', email: 'test@example.com' },
                config.jwt.secret,
                { expiresIn: '-1s' } // Already expired
            );

            expect(() => {
                tokenService.verifyAccessToken(token);
            }).to.throw('Access token has expired');
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', () => {
            const user = {
                _id: '123456789'
            };

            const token = tokenService.generateRefreshToken(user);
            const decoded = tokenService.verifyRefreshToken(token);

            expect(decoded.id).to.equal(user._id);
            expect(decoded.tokenType).to.equal('refresh');
        });

        it('should throw error for invalid refresh token', () => {
            expect(() => {
                tokenService.verifyRefreshToken('invalid.token.here');
            }).to.throw('Invalid refresh token');
        });

        it('should throw error for wrong token type', () => {
            const token = jwt.sign(
                { id: '123', tokenType: 'access' },
                config.jwt.refreshSecret
            );

            expect(() => {
                tokenService.verifyRefreshToken(token);
            }).to.throw('Invalid token type');
        });
    });

    describe('getRefreshTokenExpiry', () => {
        it('should correctly parse days', () => {
            const stub = sinon.stub(config.jwt, 'refreshTokenExpiry').value('7d');
            const expiry = tokenService.getRefreshTokenExpiry();
            expect(expiry).to.equal(7 * 24 * 60 * 60 * 1000);
        });

        it('should correctly parse hours', () => {
            const stub = sinon.stub(config.jwt, 'refreshTokenExpiry').value('24h');
            const expiry = tokenService.getRefreshTokenExpiry();
            expect(expiry).to.equal(24 * 60 * 60 * 1000);
        });

        it('should correctly parse minutes', () => {
            const stub = sinon.stub(config.jwt, 'refreshTokenExpiry').value('60m');
            const expiry = tokenService.getRefreshTokenExpiry();
            expect(expiry).to.equal(60 * 60 * 1000);
        });

        it('should correctly parse seconds', () => {
            const stub = sinon.stub(config.jwt, 'refreshTokenExpiry').value('3600s');
            const expiry = tokenService.getRefreshTokenExpiry();
            expect(expiry).to.equal(3600 * 1000);
        });

        it('should default to 7 days for invalid format', () => {
            const stub = sinon.stub(config.jwt, 'refreshTokenExpiry').value('invalid');
            const expiry = tokenService.getRefreshTokenExpiry();
            expect(expiry).to.equal(7 * 24 * 60 * 60 * 1000);
        });
    });
});