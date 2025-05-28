module.exports = {
    async up(db, client) {
        // Create matchrequests collection
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (!collectionNames.includes('matchrequests')) {
            await db.createCollection('matchrequests');
            console.log('Created matchrequests collection');

            // Create indexes for matchrequests
            const matchRequestsCollection = db.collection('matchrequests');

            // Status and game queries
            await matchRequestsCollection.createIndex(
                { status: 1, 'criteria.games.gameId': 1 },
                { name: 'status_game_index' }
            );

            // Active requests by status and start time
            await matchRequestsCollection.createIndex(
                { status: 1, searchStartTime: 1 },
                { name: 'status_searchtime_index' }
            );

            // User's active requests
            await matchRequestsCollection.createIndex(
                { userId: 1, status: 1 },
                { name: 'user_status_index' }
            );

            // Scheduled matches
            await matchRequestsCollection.createIndex(
                { 'criteria.scheduledTime': 1 },
                { sparse: true, name: 'scheduled_time_index' }
            );

            console.log('Created indexes for matchrequests collection');
        }

        if (!collectionNames.includes('matchhistories')) {
            await db.createCollection('matchhistories');
            console.log('Created matchhistories collection');

            // Create indexes for matchhistories
            const matchHistoriesCollection = db.collection('matchhistories');

            // Game and time queries
            await matchHistoriesCollection.createIndex(
                { gameId: 1, formedAt: -1 },
                { name: 'game_time_index' }
            );

            // User participation queries
            await matchHistoriesCollection.createIndex(
                { 'participants.userId': 1, formedAt: -1 },
                { name: 'participant_time_index' }
            );

            // Status queries
            await matchHistoriesCollection.createIndex(
                { status: 1, formedAt: -1 },
                { name: 'status_time_index' }
            );

            // Analytics queries
            await matchHistoriesCollection.createIndex(
                { formedAt: -1 },
                { name: 'formed_time_index' }
            );

            console.log('Created indexes for matchhistories collection');
        }
    },

    async down(db, client) {
        // Drop collections
        await db.collection('matchrequests').drop();
        console.log('Dropped matchrequests collection');

        await db.collection('matchhistories').drop();
        console.log('Dropped matchhistories collection');
    }
};