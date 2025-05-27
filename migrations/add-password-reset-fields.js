module.exports = {
    async up(db, client) {
        // Add indexes for password reset functionality
        await db.collection('users').createIndex(
            { passwordResetToken: 1, passwordResetExpires: 1 },
            {
                sparse: true,
                name: 'password_reset_token_index'
            }
        );

        console.log('Added password reset token index');
    },

    async down(db, client) {
        // Remove the index
        await db.collection('users').dropIndex('password_reset_token_index');

        console.log('Removed password reset token index');
    }
};