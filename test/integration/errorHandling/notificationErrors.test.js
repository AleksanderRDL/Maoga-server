const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const notificationService = require('../../../src/modules/notification/services/notificationService');
const pushService = require('../../../src/modules/notification/services/pushService');
const emailService = require('../../../src/modules/notification/services/emailService');
const notificationQueue = require('../../../src/jobs/notificationQueue');
const Notification = require('../../../src/modules/notification/models/Notification');
const User = require('../../../src/modules/auth/models/User');
const logger = require('../../../src/utils/logger');

describe('Notification Error Handling Integration Tests', () => {
    let sandbox;
    let user;
    let notification;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        await User.deleteMany({});
        await Notification.deleteMany({});

        user = await User.create({
            email: 'erroruser@example.com',
            username: 'erroruser',
            hashedPassword: 'password',
            deviceTokens: [{ token: 'valid-push-token', platform: 'ios' }],
            notificationSettings: {
                push: { system: true },
                email: { system: true }
            }
        });

        notification = await Notification.create({
            userId: user._id,
            type: 'system_announcement',
            title: 'Error Test',
            message: 'Testing error handling',
            deliveryChannels: ['push', 'email']
        });

        // Suppress logger output for cleaner test results
        sandbox.stub(logger, 'error');
        sandbox.stub(logger, 'warn');
        sandbox.stub(logger, 'info');
        sandbox.stub(logger, 'debug');
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should correctly update notification status if pushService.sendNotification fails', async () => {
        sandbox.stub(pushService, 'sendNotification').resolves({
            success: false,
            error: 'FCM Error',
            failureCount: 1,
            failedTokens: [{ token: 'valid-push-token', error: 'FCM Error' }]
        });

        await notificationService.processPushNotification(notification._id.toString());

        const updatedNotification = await Notification.findById(notification._id);
        expect(updatedNotification.deliveryStatus.push.delivered).to.be.false;
        expect(updatedNotification.deliveryStatus.push.error).to.equal('FCM Error');
        expect(logger.error.calledWith(sinon.match.string, sinon.match({ notificationId: notification._id.toString() }))).to.be.true;
    });

    it('should correctly update notification status if emailService.sendNotificationEmail fails', async () => {
        sandbox.stub(emailService, 'sendNotificationEmail').resolves({
            success: false,
            error: 'SMTP Error'
        });

        await notificationService.processEmailNotification(notification._id.toString());

        const updatedNotification = await Notification.findById(notification._id);
        expect(updatedNotification.deliveryStatus.email.delivered).to.be.false;
        expect(updatedNotification.deliveryStatus.email.error).to.equal('SMTP Error');
        expect(logger.error.calledWith(sinon.match.string, sinon.match({ notificationId: notification._id.toString() }))).to.be.true;
    });

    it('should retry and eventually fail a job in notificationQueue if processing fails repeatedly', async function() {
        this.timeout(10000); // Increase timeout for retry logic with delays

        const clock = sinon.useFakeTimers();
        const processPushStub = sandbox.stub(notificationService, 'processPushNotification');
        processPushStub.onFirstCall().rejects(new Error('Push attempt 1 failed'));
        processPushStub.onSecondCall().rejects(new Error('Push attempt 2 failed'));
        processPushStub.onThirdCall().rejects(new Error('Push attempt 3 failed')); // Max attempts

        const jobData = { notificationId: notification._id.toString(), userId: user._id.toString() };
        await notificationQueue.addJob('push', jobData);
        expect(notificationQueue.queues.push.length).to.equal(1);

        // Attempt 1
        await notificationQueue.processPushQueue();
        expect(processPushStub.callCount).to.equal(1);
        expect(notificationQueue.queues.push.length).to.equal(1); // Re-queued
        expect(notificationQueue.queues.push[0].attempts).to.equal(1);

        // Attempt 2
        await notificationQueue.processPushQueue();
        expect(processPushStub.callCount).to.equal(2);
        expect(notificationQueue.queues.push.length).to.equal(1); // Re-queued
        expect(notificationQueue.queues.push[0].attempts).to.equal(2);

        // Attempt 3
        await notificationQueue.processPushQueue();
        expect(processPushStub.callCount).to.equal(3);
        expect(notificationQueue.queues.push.length).to.equal(0); // Not re-queued after 3 attempts
        expect(logger.error.calledWith(sinon.match('Push notification job failed after max attempts'), sinon.match.any)).to.be.true;

        clock.restore();
    });

    it('should handle Notification not found in processPushNotification gracefully', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        await notificationService.processPushNotification(nonExistentId);
        // Expect an error log, but the service should not crash.
        expect(logger.error.calledWith(sinon.match.string, sinon.match({ notificationId: nonExistentId }))).to.be.true;
        // Check that a Notification document was not updated to have an error, because it doesn't exist.
        const shouldNotExist = await Notification.findById(nonExistentId);
        expect(shouldNotExist).to.be.null;
    });

    it('should handle Notification not found in processEmailNotification gracefully', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        await notificationService.processEmailNotification(nonExistentId);
        expect(logger.error.calledWith(sinon.match.string, sinon.match({ notificationId: nonExistentId }))).to.be.true;
        const shouldNotExist = await Notification.findById(nonExistentId);
        expect(shouldNotExist).to.be.null;
    });
});