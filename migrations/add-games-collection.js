module.exports = {
    async up(db, client) {
        // Create games collection if it doesn't exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (!collectionNames.includes('games')) {
            await db.createCollection('games');
            console.log('Created games collection');
        }

        // Create indexes for games collection
        const gamesCollection = db.collection('games');

        // Unique indexes
        await gamesCollection.createIndex(
            { slug: 1 },
            { unique: true, name: 'slug_unique' }
        );

        await gamesCollection.createIndex(
            { 'externalIds.igdb': 1 },
            { unique: true, sparse: true, name: 'igdb_id_unique' }
        );

        // Search and query indexes
        await gamesCollection.createIndex(
            { name: 'text', description: 'text' },
            { name: 'text_search' }
        );

        await gamesCollection.createIndex(
            { name: 1 },
            { name: 'name_index' }
        );

        await gamesCollection.createIndex(
            { popularity: -1, rating: -1 },
            { name: 'popularity_rating_index' }
        );

        await gamesCollection.createIndex(
            { 'genres.id': 1 },
            { name: 'genre_index' }
        );

        await gamesCollection.createIndex(
            { 'platforms.id': 1 },
            { name: 'platform_index' }
        );

        await gamesCollection.createIndex(
            { 'multiplayer.online': 1 },
            { name: 'multiplayer_index' }
        );

        await gamesCollection.createIndex(
            { lastSyncedAt: 1 },
            { name: 'sync_date_index' }
        );

        await gamesCollection.createIndex(
            { 'maogaData.playerCount': -1 },
            { name: 'player_count_index' }
        );

        await gamesCollection.createIndex(
            { 'maogaData.trending': 1 },
            { name: 'trending_index' }
        );

        console.log('Created indexes for games collection');
    },

    async down(db, client) {
        // Drop the games collection
        await db.collection('games').drop();
        console.log('Dropped games collection');
    }
};