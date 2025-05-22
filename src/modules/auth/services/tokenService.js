const jwt = require('jsonwebtoken');
const config = require('../../../config');
const { AuthenticationError } = require('../../../utils/errors');

class TokenService {
    /**
     * Generate access token
     */
    generateAccessToken(user) {
        const payload = {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            role: user.role
        };

        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.accessTokenExpiry,
            issuer: config.jwt.issuer,
            audience: config.jwt.audience
        });
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(user) {
        const payload = {
            id: user._id.toString(),
            tokenType: 'refresh'
        };

        return jwt.sign(payload, config.jwt.refreshSecret, {
            expiresIn: config.jwt.refreshTokenExpiry,
            issuer: config.jwt.issuer,
            audience: config.jwt.audience
        });
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, config.jwt.secret, {
                issuer: config.jwt.issuer,
                audience: config.jwt.audience
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new AuthenticationError('Access token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new AuthenticationError('Invalid access token');
            }
            throw error;
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, config.jwt.refreshSecret, {
                issuer: config.jwt.issuer,
                audience: config.jwt.audience
            });

            if (decoded.tokenType !== 'refresh') {
                throw new AuthenticationError('Invalid token type');
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new AuthenticationError('Refresh token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new AuthenticationError('Invalid refresh token');
            }
            throw error;
        }
    }

    /**
     * Get refresh token expiry in milliseconds
     */
    getRefreshTokenExpiry() {
        // Parse the expiry string (e.g., '7d') to milliseconds
        const expiry = config.jwt.refreshTokenExpiry;
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1));

        switch (unit) {
            case 'd':
                return value * 24 * 60 * 60 * 1000;
            case 'h':
                return value * 60 * 60 * 1000;
            case 'm':
                return value * 60 * 1000;
            case 's':
                return value * 1000;
            default:
                return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
        }
    }
}

module.exports = new TokenService();