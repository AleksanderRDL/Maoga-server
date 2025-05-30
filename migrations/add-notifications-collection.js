module.exports = {
    async up(db, client) {
        // Create notifications collection
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (!collectionNames.includes('notifications')) {
            await db.createCollection('notifications');
            console.log('Created notifications collection');

            // Create indexes
            const notificationsCollection = db.collection('notifications');

            await notificationsCollection.createIndex(
                { userId: 1, status: 1, createdAt: -1 },
                { name: 'user_status_created_index' }
            );

            await notificationsCollection.createIndex(
                { userId: 1, type: 1, createdAt: -1 },
                { name: 'user_type_created_index' }
            );

            await notificationsCollection.createIndex(
                { expiresAt: 1 },
                {
                    name: 'expires_index',
                    expireAfterSeconds: 0
                }
            );

            await notificationsCollection.createIndex(
                { type: 1, status: 1 },
                { name: 'type_status_index' }
            );

            console.log('Created indexes for notifications collection');
        }

        // Update users collection - add notification settings defaults
        const usersCollection = db.collection('users');
        await usersCollection.updateMany(
            { 'notificationSettings.system': { $exists: false } },
            {
                $set: {
                    'notificationSettings.email.system': true,
                    'notificationSettings.email.achievements': false,
                    'notificationSettings.email.reports': true,
                    'notificationSettings.push.system': true,
                    'notificationSettings.push.achievements': true,
                    'notificationSettings.push.reports': true,
                    'notificationSettings.inApp.system': true,
                    'notificationSettings.inApp.achievements': true,
                    'notificationSettings.inApp.reports': true
                }
            }
        );

        console.log('Updated user notification settings');
    },

    async down(db, client) {
        // Drop notifications collection
        await db.collection('notifications').drop();
        console.log('Dropped notifications collection');
    }
};