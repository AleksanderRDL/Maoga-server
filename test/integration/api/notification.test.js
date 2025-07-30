const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const Notification = require('../../../src/modules/notification/models/Notification');
const authService = require('../../../src/modules/auth/services/authService');
const { testUsers } = require('../../fixtures/users');
const mongoose = require('mongoose');
const socketManager = require('../../../src/services/socketManager');

describe('Notification API Integration Tests', () => {
    let userToken1, userToken2;
    let user1, user2;
    let sandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        await User.deleteMany({});
        await Notification.deleteMany({});

        const user1Result = await authService.register({
            email: testUsers[0].email,
            username: testUsers[0].username,
            password: testUsers[0].password
        });
        userToken1 = user1Result.accessToken;
        user1 = user1Result.user;

        const user2Result = await authService.register({
            email: testUsers[1].email,
            username: testUsers[1].username,
            password: testUsers[1].password
        });
        userToken2 = user2Result.accessToken;
        user2 = user2Result.user;

        // Stub socketManager to prevent actual socket emissions during API tests
        sandbox.stub(socketManager, 'emitToUser').returns(true);
        sandbox.stub(socketManager, 'emitToRoom').returns(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('GET /api/notifications', () => {
        beforeEach(async () => {
            // Create some notifications for user1
            await Notification.create([
                { userId: user1._id, type: 'friend_request', title: 'FR1', message: 'Msg1', status: 'unread' },
                { userId: user1._id, type: 'match_found', title: 'MF1', message: 'Msg2', status: 'unread' },
                { userId: user1._id, type: 'lobby_invite', title: 'LI1', message: 'Msg3', status: 'read' },
                { userId: user2._id, type: 'friend_request', title: 'FR2 User2', message: 'Msg4', status: 'unread' }
            ]);
        });

        it('should get unread notifications for the authenticated user', async () => {
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${userToken1}`)
                .query({ status: 'unread' })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.notifications).to.have.lengthOf(2);
            res.body.data.notifications.forEach(n => {
                expect(n.userId).to.equal(user1._id.toString());
                expect(n.status).to.equal('unread');
            });
        });

        it('should get all notifications for the authenticated user with pagination', async () => {
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${userToken1}`)
                .query({ limit: 2, page: 1 })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.notifications).to.have.lengthOf(2);
            expect(res.body.data.pagination.total).to.equal(3);
            expect(res.body.data.pagination.pages).to.equal(2);
        });

        it('should filter notifications by type', async () => {
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${userToken1}`)
                .query({ type: 'match_found' })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.notifications).to.have.lengthOf(1);
            expect(res.body.data.notifications[0].type).to.equal('match_found');
        });

        it('should return 401 if not authenticated', async () => {
            await request(app)
                .get('/api/notifications')
                .expect(401);
        });
    });

    describe('GET /api/notifications/count', () => {
        it('should get unread notification count', async () => {
            await Notification.create({ userId: user1._id, type: 'test', title: 'T', message: 'M', status: 'unread' });
            await Notification.create({ userId: user1._id, type: 'test2', title: 'T2', message: 'M2', status: 'unread' });
            await Notification.create({ userId: user1._id, type: 'test3', title: 'T3', message: 'M3', status: 'read' });

            const res = await request(app)
                .get('/api/notifications/count')
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.unread).to.equal(2);
        });
    });

    describe('PATCH /api/notifications/:notificationId/read', () => {
        let notificationToRead;
        beforeEach(async () => {
            notificationToRead = await Notification.create({ userId: user1._id, type: 'test', title: 'T', message: 'M', status: 'unread' });
        });

        it('should mark a specific notification as read', async () => {
            const res = await request(app)
                .patch(`/api/notifications/${notificationToRead._id}/read`)
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.message).to.equal('Notification marked as read');

            const updatedNotification = await Notification.findById(notificationToRead._id);
            expect(updatedNotification.status).to.equal('read');
            expect(socketManager.emitToUser.calledWith(user1._id.toString(), 'notification:count', { unread: 0 })).to.be.true;
        });

        it('should return 404 if notification not found or does not belong to user', async () => {
            const otherUserNotificationId = new mongoose.Types.ObjectId();
            await request(app)
                .patch(`/api/notifications/${otherUserNotificationId}/read`)
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(404); // Assuming markAsRead in service would throw NotFoundError or similar if update count is 0

            const notificationForUser2 = await Notification.create({ userId: user2._id, type: 'test', title: 'T', message: 'M', status: 'unread' });
            await request(app)
                .patch(`/api/notifications/${notificationForUser2._id}/read`)
                .set('Authorization', `Bearer ${userToken1}`) // User1 trying to read User2's notification
                .expect(404); // Or 403 depending on how your service handles this
        });
    });

    describe('POST /api/notifications/mark-read', () => {
        let unreadNotifications;
        beforeEach(async () => {
            unreadNotifications = await Notification.create([
                { userId: user1._id, type: 'test1', title: 'T1', message: 'M1', status: 'unread' },
                { userId: user1._id, type: 'test2', title: 'T2', message: 'M2', status: 'unread' }
            ]);
        });

        it('should mark multiple notifications as read', async () => {
            const notificationIds = unreadNotifications.map(n => n._id.toString());
            const res = await request(app)
                .post('/api/notifications/mark-read')
                .set('Authorization', `Bearer ${userToken1}`)
                .send({ notificationIds })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.modifiedCount).to.equal(2);

            const notifications = await Notification.find({ _id: { $in: notificationIds } });
            notifications.forEach(n => expect(n.status).to.equal('read'));
            expect(socketManager.emitToUser.calledWith(user1._id.toString(), 'notification:count', { unread: 0 })).to.be.true;
        });
    });

    describe('POST /api/notifications/mark-all-read', () => {
        beforeEach(async () => {
            await Notification.create([
                { userId: user1._id, type: 'test1', title: 'T1', message: 'M1', status: 'unread' },
                { userId: user1._id, type: 'test2', title: 'T2', message: 'M2', status: 'unread' },
                { userId: user2._id, type: 'test3', title: 'T3', message: 'M3', status: 'unread' } // For another user
            ]);
        });

        it('should mark all unread notifications for the user as read', async () => {
            const res = await request(app)
                .post('/api/notifications/mark-all-read')
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.modifiedCount).to.equal(2);

            const user1Notifications = await Notification.find({ userId: user1._id });
            user1Notifications.forEach(n => expect(n.status).to.equal('read'));

            const user2Notification = await Notification.findOne({ userId: user2._id });
            expect(user2Notification.status).to.equal('unread'); // Should not affect other users

            expect(socketManager.emitToUser.calledWith(user1._id.toString(), 'notification:count', { unread: 0 })).to.be.true;
        });
    });

    describe('DELETE /api/notifications/:notificationId', () => {
        let notificationToDelete;
        beforeEach(async () => {
            notificationToDelete = await Notification.create({ userId: user1._id, type: 'test_del', title: 'TD', message: 'MD' });
        });

        it('should delete a specific notification for the user', async () => {
            const res = await request(app)
                .delete(`/api/notifications/${notificationToDelete._id}`)
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.message).to.equal('Notification deleted');

            const deleted = await Notification.findById(notificationToDelete._id);
            expect(deleted).to.be.null;
        });

        it('should return 404 if notification to delete not found or not owned by user', async () => {
            await request(app)
                .delete(`/api/notifications/${new mongoose.Types.ObjectId()}`)
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(404);

            const notificationForUser2 = await Notification.create({ userId: user2._id, type: 'test_del', title: 'TD2', message: 'MD2' });
            await request(app)
                .delete(`/api/notifications/${notificationForUser2._id}`)
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(404);
        });
    });

    describe('PUT /api/notifications/settings', () => {
        it('should update user notification settings', async () => {
            const newSettings = {
                email: { friendRequests: false, matchFound: true },
                push: { messages: false }
            };
            const res = await request(app)
                .put('/api/notifications/settings')
                .set('Authorization', `Bearer ${userToken1}`)
                .send(newSettings)
                .expect(200);

            expect(res.body.status).to.equal('success');
            const updatedUserSettings = res.body.data.notificationSettings;
            expect(updatedUserSettings.email.friendRequests).to.be.false;
            expect(updatedUserSettings.email.matchFound).to.be.true;
            expect(updatedUserSettings.push.messages).to.be.false;

            const dbUser = await User.findById(user1._id);
            expect(dbUser.notificationSettings.email.friendRequests).to.be.false;
        });

        it('should return 422 for invalid settings data', async () => {
            await request(app)
                .put('/api/notifications/settings')
                .set('Authorization', `Bearer ${userToken1}`)
                .send({ email: { invalidKey: true } }) // 'invalidKey' is not in schema
                .expect(422); // Or 200 if your service ignores invalid keys and only updates valid ones
        });
    });

    describe('GET /api/notifications/settings', () => {
        it('should retrieve current user notification settings', async () => {
            // Optionally, set some specific settings first to ensure they are fetched
            const testSettings = {
                email: { system: false },
                push: { matchFound: true }
            };
            await User.findByIdAndUpdate(user1._id, { $set: { notificationSettings: testSettings } });

            const res = await request(app)
                .get('/api/notifications/settings')
                .set('Authorization', `Bearer ${userToken1}`)
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.notificationSettings).to.exist;
            // Check against the specific settings if you set them, or default structure
            expect(res.body.data.notificationSettings.email.system).to.be.false;
            expect(res.body.data.notificationSettings.push.matchFound).to.be.true;
        });
    });
});