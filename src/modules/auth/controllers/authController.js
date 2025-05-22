const authService = require('../services/authService');
const asyncHandler = require('../../../utils/asyncHandler');

class AuthController {
    /**
     * Register a new user
     * POST /api/auth/register
     */
    register = asyncHandler(async (req, res) => {
        const { user, accessToken, refreshToken } = await authService.register(req.body);

        res.status(201).json({
            status: 'success',
            data: {
                user,
                accessToken,
                refreshToken
            }
        });
    });

    /**
     * Login user
     * POST /api/auth/login
     */
    login = asyncHandler(async (req, res) => {
        const { credential, password } = req.body;
        const { user, accessToken, refreshToken } = await authService.login(credential, password);

        res.status(200).json({
            status: 'success',
            data: {
                user,
                accessToken,
                refreshToken
            }
        });
    });

    /**
     * Refresh access token
     * POST /api/auth/refresh
     */
    refreshToken = asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshToken(refreshToken);

        res.status(200).json({
            status: 'success',
            data: tokens
        });
    });

    /**
     * Logout user
     * POST /api/auth/logout
     */
    logout = asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;
        await authService.logout(req.user.id, refreshToken);

        res.status(200).json({
            status: 'success',
            data: {
                message: 'Logged out successfully'
            }
        });
    });

    /**
     * Request password reset
     * POST /api/auth/reset-password
     */
    resetPasswordRequest = asyncHandler(async (req, res) => {
        const { email } = req.body;
        const result = await authService.resetPasswordRequest(email);

        res.status(200).json({
            status: 'success',
            data: result
        });
    });

    /**
     * Confirm password reset
     * POST /api/auth/reset-password/confirm
     * Note: Placeholder for Sprint 2
     */
    resetPasswordConfirm = asyncHandler(async (req, res) => {
        const { token, newPassword } = req.body;
        await authService.resetPasswordConfirm(token, newPassword);

        res.status(200).json({
            status: 'success',
            data: {
                message: 'Password reset successfully'
            }
        });
    });
}

module.exports = new AuthController();