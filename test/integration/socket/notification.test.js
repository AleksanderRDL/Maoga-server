const { expect } = require('chai');
const sinon = require('sinon');
const http = require('http');
const { Server } = require('socket.io');
const socketIOClient = require('socket.io-client');
const app = require('../../../src/app'); // Your Express app
const socketManager = require('../../../src/services/socketManager');
const authService = require('../../../src/modules/auth/services/authService');
const notificationService = require('../../../src/modules/notification/services/notificationService');
const User = require('../../../src/modules/auth/models/User');
const Notification = require('../../../src/modules/notification/models/Notification');
const { testUsers } = require('../../fixtures/users');
const TestSocketClient = require('../../utils/socketClient'); // Your helper

describe('Notification Socket.IO Integration Tests', () => {
    let httpServer;
    let serverUrl;
    let clientUser1;
    let user1, userToken1;
    let sandbox;

    before(async () => {
        httpServer = http.createServer(app);
        await new Promise(resolve => {
            httpServer.listen(0, 'localhost', () => {
                const { port } = httpServer.address();
                serverUrl = `http://localhost:${port}`;
                socketManager.initialize(httpServer);
                resolve();
            });
        });
    });

    after(async () => {
        if (socketManager.io) {
            socketManager.io.close();
        }
        if (httpServer && httpServer.listening) {
            await new Promise(resolve => httpServer.close(resolve));
        }
    });

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        await User.deleteMany({});
        await Notification.deleteMany({});

        const user1Data = await authService.register({
            email: testUsers[0].email,
            username: testUsers[0].username,
            password: testUsers[0].password,
            notificationSettings: { // Explicitly set for clarity in tests
                inApp: { system: true, match_found: true },
                push: { system: false },
                email: { system: false }
            }
        });
        user1 = user1Data.user;
        userToken1 = user1Data.accessToken;

        clientUser1 = new TestSocketClient(serverUrl, userToken1);
        await clientUser1.connect();
        // Wait for the 'connected' event which confirms socket.userId is set
        await clientUser1.waitForEvent('connected', 5000);
    });

    afterEach(async () => {
        if (clientUser1 && clientUser1.socket && clientUser1.socket.connected) {
            clientUser1.disconnect();
        }
        sandbox.restore();
        // Clear socket manager state if necessary (depends on your TestSocketClient and socketManager setup)
        socketManager.userSockets.clear();
        socketManager.socketUsers.clear();
        socketManager.rooms.clear();
    });

    it('should receive a "notification:new" event when a new in-app notification is created', async () => {
        const notificationPromise = clientUser1.waitForEvent('notification:new', 5000);

        // Trigger notification creation (ensure user1 has inApp enabled for this type)
        await notificationService.createNotification(user1._id.toString(), {
            type: 'system_announcement', // Assuming system_announcement maps to 'system' preference key
            title: 'System Online',
            message: 'The system is now online.',
            priority: 'medium'
        });

        const receivedNotification = await notificationPromise;

        expect(receivedNotification).to.exist;
        expect(receivedNotification.notification).to.exist;
        expect(receivedNotification.notification.title).to.equal('System Online');
        expect(receivedNotification.notification.userId).to.be.undefined; // Notification payload might not directly include userId
    });

    it('should receive a "notification:count" event when unread count changes', async () => {
        const countPromise = clientUser1.waitForEvent('notification:count', 5000);

        // Create a notification which should trigger sendInAppNotification and thus the count update
        await notificationService.createNotification(user1._id.toString(), {
            type: 'match_found',
            title: 'Match Ready',
            message: 'Your match is ready to join!',
            priority: 'high'
        });

        const receivedCountUpdate = await countPromise;
        expect(receivedCountUpdate).to.exist;
        expect(receivedCountUpdate.unread).to.be.greaterThanOrEqual(1); // Should be 1 if DB was empty

        // Simulate marking as read via service which also triggers count update
        const newCountPromise = clientUser1.waitForEvent('notification:count', 5000);
        const createdNotification = await Notification.findOne({ userId: user1._id, title: 'Match Ready' });
        await notificationService.markAsRead(user1._id.toString(), [createdNotification._id.toString()]);

        const updatedCount = await newCountPromise;
        expect(updatedCount).to.exist;
        expect(updatedCount.unread).to.equal(0);
    });

    it('should not receive "notification:new" if inApp is disabled for that type', async () => {
        // Update user1's settings to disable inApp for 'friend_request'
        user1.notificationSettings.inApp.friend_request = false;
        await user1.save();

        let received = false;
        clientUser1.on('notification:new', () => {
            received = true;
        });

        await notificationService.createNotification(user1._id.toString(), {
            type: 'friend_request',
            title: 'New Friend',
            message: 'You have a new friend request.',
        });

        await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit to see if event arrives

        expect(received, 'Should not have received notification:new when inApp disabled for type').to.be.false;
    });
});