const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let isConnected = false;

async function connectDatabase() {
    if (isConnected) {
        logger.warn('Database connection already established');
        return;
    }

    try {
        // Set mongoose options
        mongoose.set('strictQuery', false);

        // Event listeners for mongoose connection
        mongoose.connection.on('connected', () => {
            logger.info('Mongoose connected to MongoDB');
            isConnected = true;
        });

        mongoose.connection.on('error', (err) => {
            logger.error('Mongoose connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('Mongoose disconnected from MongoDB');
            isConnected = false;
        });

        // Connect to MongoDB
        await mongoose.connect(config.database.uri, config.database.options);

    } catch (error) {
        logger.error('Failed to connect to MongoDB', { error: error.message });
        throw error;
    }
}

async function disconnectDatabase() {
    if (!isConnected) {
        logger.warn('No database connection to close');
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('Error closing database connection', { error: error.message });
        throw error;
    }
}

module.exports = {
    connectDatabase,
    disconnectDatabase,
    mongoose
};