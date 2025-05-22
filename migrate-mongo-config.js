// Load environment variables
require('dotenv').config();

const config = {
    mongodb: {
        url: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        databaseName: 'maoga_dev',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },
    migrationsDir: 'migrations',
    changelogCollectionName: 'changelog',
    migrationFileExtension: '.js',
    useFileHash: false,
    moduleSystem: 'commonjs'
};

module.exports = config;