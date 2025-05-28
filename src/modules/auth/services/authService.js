const User = require('../models/User');
const tokenService = require('./tokenService');
const {
  ConflictError,
  AuthenticationError,
  NotFoundError,
  BadRequestError
} = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const crypto = require('crypto');

class AuthService {
  /**
   * Register a new user
   */
  async register(userData) {
    const { email, username, password, displayName, role } = userData;

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username: username }]
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          throw new ConflictError('Email already registered');
        }
        if (existingUser.username === username) {
          throw new ConflictError('Username already taken');
        }
      }

      // Create new user
      const user = new User({
        email: email.toLowerCase(),
        username,
        hashedPassword: password, // Will be hashed by pre-save hook
        profile: {
          displayName: displayName || username
        },
        role: role || 'user'
      });

      await user.save();

      // Generate tokens
      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = tokenService.generateRefreshToken(user);

      // Store refresh token
      user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + tokenService.getRefreshTokenExpiry())
      });
      await user.save();

      logger.info('User registered successfully', { userId: user.id, username: user.username });

      return {
        user: user.toJSON(),
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Registration failed', { error: error.message, email, username });
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(credential, password) {
    try {
      // Find user by email or username
      const user = await User.findByCredential(credential);

      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new AuthenticationError(`Account is ${user.status}`);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Update last active
      user.lastActive = new Date();

      // Clean expired tokens
      user.cleanExpiredTokens();

      // Generate new tokens
      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = tokenService.generateRefreshToken(user);

      // Store refresh token
      user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + tokenService.getRefreshTokenExpiry())
      });

      await user.save();

      logger.info('User logged in successfully', { userId: user.id, username: user.username });

      return {
        user: user.toJSON(),
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Login failed', { error: error.message, credential });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = tokenService.verifyRefreshToken(refreshToken);

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new AuthenticationError(`Account is ${user.status}`);
      }

      // Check if refresh token exists and is valid
      const tokenIndex = user.refreshTokens.findIndex(
        (tokenObj) => tokenObj.token === refreshToken && tokenObj.expiresAt > new Date()
      );

      if (tokenIndex === -1) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Remove old refresh token
      user.refreshTokens.splice(tokenIndex, 1);

      // Clean expired tokens
      user.cleanExpiredTokens();

      // Generate new tokens
      const newAccessToken = tokenService.generateAccessToken(user);
      const newRefreshToken = tokenService.generateRefreshToken(user);

      // Store new refresh token
      user.refreshTokens.push({
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + tokenService.getRefreshTokenExpiry())
      });

      await user.save();

      logger.info('Token refreshed successfully', { userId: user.id });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId, refreshToken) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Remove the refresh token
      if (refreshToken) {
        user.refreshTokens = user.refreshTokens.filter(
          (tokenObj) => tokenObj.token !== refreshToken
        );
      } else {
        // Remove all refresh tokens (logout from all devices)
        user.refreshTokens = [];
      }

      await user.save();

      logger.info('User logged out successfully', { userId: user.id });
    } catch (error) {
      logger.error('Logout failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async resetPasswordRequest(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        '+passwordResetToken +passwordResetExpires'
      );

      if (!user) {
        // Don't reveal if user exists or not
        logger.info('Password reset requested for non-existent email', { email });
        return { message: 'If the email exists, a reset link will be sent' };
      }

      // Check if user is active
      if (user.status !== 'active') {
        logger.warn('Password reset requested for inactive account', {
          email,
          status: user.status
        });
        return { message: 'If the email exists, a reset link will be sent' };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash token before storing
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Save hashed token and expiry (1 hour)
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // TODO: Send email with reset link containing resetToken
      // For now, log the token (remove in production)
      logger.info('Password reset token generated', {
        userId: user.id,
        email,
        tokenForTesting: resetToken // REMOVE IN PRODUCTION
      });

      return {
        message: 'If the email exists, a reset link will be sent',
        // Return token only in development/test
        ...(process.env.NODE_ENV !== 'production' && { resetToken })
      };
    } catch (error) {
      logger.error('Password reset request failed', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Confirm password reset
   */
  async resetPasswordConfirm(token, newPassword) {
    try {
      // Hash the provided token
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid token
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      }).select('+passwordResetToken +passwordResetExpires +hashedPassword');

      if (!user) {
        throw new BadRequestError('Invalid or expired reset token');
      }

      // Update password
      user.hashedPassword = newPassword; // Will be hashed by pre-save hook
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      // Invalidate all refresh tokens (security measure)
      user.refreshTokens = [];

      await user.save();

      logger.info('Password reset completed', { userId: user.id });

      return { message: 'Password reset successfully' };
    } catch (error) {
      logger.error('Password reset confirmation failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AuthService();
