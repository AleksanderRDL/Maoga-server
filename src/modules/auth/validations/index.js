const {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    resetPasswordRequestSchema,
    resetPasswordConfirmSchema
} = require('./authValidation');

module.exports = {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    resetPasswordRequestSchema,
    resetPasswordConfirmSchema
};