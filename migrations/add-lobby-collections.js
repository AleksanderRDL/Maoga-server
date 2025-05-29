module.exports = {
    async up(db, client) {
        // Create lobbies collection
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (!collectionNames.includes('lobbies')) {
            await db.createCollection('lobbies');
            console.log('Created lobbies collection');

            // Create indexes for lobbies
            const lobbiesCollection = db.collection('lobbies');

            await lobbiesCollection.createIndex(
                { status: 1, gameId: 1 },
                { name: 'status_game_index' }
            );

            await lobbiesCollection.createIndex(
                { 'members.userId': 1, status: 1 },
                { name: 'member_status_index' }
            );

            await lobbiesCollection.createIndex(
                { hostId: 1, status: 1 },
                { name: 'host_status_index' }
            );

            await lobbiesCollection.createIndex(
                { matchHistoryId: 1 },
                { sparse: true, name: 'match_history_index' }
            );

            console.log('Created indexes for lobbies collection');
        }

        if (!collectionNames.includes('chats')) {
            await db.createCollection('chats');
            console.log('Created chats collection');

            // Create indexes for chats
            const chatsCollection = db.collection('chats');

            await chatsCollection.createIndex(
                { chatType: 1, lobbyId: 1 },
                { name: 'type_lobby_index' }
            );

            await chatsCollection.createIndex(
                { participants: 1, chatType: 1 },
                { name: 'participants_type_index' }
            );

            await chatsCollection.createIndex(
                { lastMessageAt: -1 },
                { name: 'last_message_index' }
            );

            console.log('Created indexes for chats collection');
        }
    },

    async down(db, client) {
        // Drop collections
        await db.collection('lobbies').drop();
        console.log('Dropped lobbies collection');

        await db.collection('chats').drop();
        console.log('Dropped chats collection');
    }
};