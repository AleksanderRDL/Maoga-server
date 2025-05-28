module.exports = {
    async up(db, client) {
        // Create reports collection
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (!collectionNames.includes('reports')) {
            await db.createCollection('reports');
            console.log('Created reports collection');

            // Create indexes for reports
            const reportsCollection = db.collection('reports');
            await reportsCollection.createIndex({ reporterId: 1, createdAt: -1 });
            await reportsCollection.createIndex({ reportedId: 1, status: 1 });
            await reportsCollection.createIndex({ status: 1, createdAt: -1 });
            await reportsCollection.createIndex({ assignedTo: 1, status: 1 });
            console.log('Created indexes for reports collection');
        }

        if (!collectionNames.includes('friendships')) {
            await db.createCollection('friendships');
            console.log('Created friendships collection');

            // Create indexes for friendships
            const friendshipsCollection = db.collection('friendships');
            await friendshipsCollection.createIndex(
                { user1Id: 1, user2Id: 1 },
                { unique: true }
            );
            await friendshipsCollection.createIndex({ user1Id: 1, status: 1 });
            await friendshipsCollection.createIndex({ user2Id: 1, status: 1 });
            console.log('Created indexes for friendships collection');
        }

        // Add index for game profiles in users collection
        const usersCollection = db.collection('users');
        await usersCollection.createIndex({ 'gameProfiles.gameId': 1 });
        console.log('Added game profiles index to users collection');
    },

    async down(db, client) {
        // Drop collections
        await db.collection('reports').drop();
        console.log('Dropped reports collection');

        await db.collection('friendships').drop();
        console.log('Dropped friendships collection');

        // Drop index
        await db.collection('users').dropIndex('gameProfiles.gameId_1');
        console.log('Dropped game profiles index from users collection');
    }
};