module.exports = {
    async up(db, client) {
        // Create initial collections if they don't exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        // Create users collection with indexes
        if (!collectionNames.includes('users')) {
            await db.createCollection('users');
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            await db.collection('users').createIndex({ username: 1 }, { unique: true });
        }

        console.log('Initial setup migration completed');
    },

    async down(db, client) {
        // Remove collections created in up migration
        await db.collection('users').drop();
        console.log('Initial setup migration reverted');
    }
};