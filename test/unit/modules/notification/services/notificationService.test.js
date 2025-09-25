const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const notificationService = require('../../../../../src/modules/notification/services/notificationService');
const Notification = require('../../../../../src/modules/notification/models/Notification');
const User = require('../../../../../src/modules/auth/models/User');
const socketManager = require('../../../../../src/services/socketManager');
const notificationQueue = require('../../../../../src/jobs/notificationQueue');
const { NotFoundError } = require('../../../../../src/utils/errors');

describe('NotificationService Unit Tests', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createNotification', () => {
    let mockUser;
    let mockNotificationSave;
    let dispatchNotificationStub;

    beforeEach(() => {
      mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        deviceTokens: [{ token: 'test-token', platform: 'ios' }],
        notificationSettings: {
          email: { friend_request: true, match_found: true, system: true },
          push: { friend_request: true, match_found: false, system: true },
          inApp: { friend_request: true, match_found: true, system: true }
        }
      };
      sandbox.stub(User, 'findById').resolves(mockUser);
      mockNotificationSave = sandbox.stub(Notification.prototype, 'save').resolvesThis();
      dispatchNotificationStub = sandbox
        .stub(notificationService, 'dispatchNotification')
        .resolves();
    });

    it('should create a notification with friend_request type and determine correct channels', async () => {
      const notificationData = {
        type: 'friend_request',
        title: 'New Friend Request',
        message: 'User X sent you a friend request.',
        data: { entityId: new mongoose.Types.ObjectId() }
      };

      const notification = await notificationService.createNotification(
        mockUser._id.toString(),
        notificationData
      );

      expect(notification).to.exist;
      expect(notification.type).to.equal('friend_request');
      expect(notification.deliveryChannels).to.include.members(['inApp', 'push', 'email']);
      expect(mockNotificationSave.calledOnce).to.be.true;
      expect(dispatchNotificationStub.calledOnceWith(notification, mockUser)).to.be.true;
    });

    it('should create a notification with match_found type and determine correct channels (push disabled)', async () => {
      const notificationData = {
        type: 'match_found',
        title: 'Match Found!',
        message: 'Your match is ready.',
        data: { entityId: new mongoose.Types.ObjectId() }
      };

      const notification = await notificationService.createNotification(
        mockUser._id.toString(),
        notificationData
      );

      expect(notification.deliveryChannels).to.include.members(['inApp', 'email']);
      expect(notification.deliveryChannels).to.not.include('push');
    });

    it('should force all channels for urgent priority', async () => {
      mockUser.notificationSettings.push.system = false; // Disable push for system by default
      const notificationData = {
        type: 'system_announcement',
        title: 'Urgent Maintenance',
        message: 'System will be down soon.',
        priority: 'urgent'
      };

      const notification = await notificationService.createNotification(
        mockUser._id.toString(),
        notificationData
      );

      expect(notification.deliveryChannels).to.include.members(['inApp', 'push', 'email']);
    });

    it('should throw NotFoundError if user not found', async () => {
      User.findById.resolves(null);
      try {
        await notificationService.createNotification(new mongoose.Types.ObjectId().toString(), {});
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('User not found');
      }
    });
  });

  describe('dispatchNotification', () => {
    let mockNotification;
    let mockUser;
    let sendInAppStub, addJobStub;

    beforeEach(() => {
      mockNotification = {
        _id: new mongoose.Types.ObjectId(),
        type: 'test_event',
        deliveryChannels: [],
        save: sandbox.stub().resolves()
      };
      mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        deviceTokens: [{ token: 'test_token' }]
      };
      sendInAppStub = sandbox.stub(notificationService, 'sendInAppNotification').resolves();
      addJobStub = sandbox.stub(notificationQueue, 'addJob').resolves();
    });

    it('should dispatch to inApp if in deliveryChannels', async () => {
      mockNotification.deliveryChannels = ['inApp'];
      await notificationService.dispatchNotification(mockNotification, mockUser);
      expect(sendInAppStub.calledOnceWith(mockNotification, mockUser)).to.be.true;
      expect(addJobStub.called).to.be.false;
    });

    it('should add job to push queue if in deliveryChannels', async () => {
      mockNotification.deliveryChannels = ['push'];
      await notificationService.dispatchNotification(mockNotification, mockUser);
      expect(
        addJobStub.calledOnceWith('push', {
          notificationId: mockNotification._id.toString(),
          userId: mockUser._id.toString()
        })
      ).to.be.true;
    });

    it('should add job to email queue if in deliveryChannels', async () => {
      mockNotification.deliveryChannels = ['email'];
      await notificationService.dispatchNotification(mockNotification, mockUser);
      expect(
        addJobStub.calledOnceWith('email', {
          notificationId: mockNotification._id.toString(),
          userId: mockUser._id.toString()
        })
      ).to.be.true;
    });

    it('should dispatch to multiple channels', async () => {
      mockNotification.deliveryChannels = ['inApp', 'push', 'email'];
      await notificationService.dispatchNotification(mockNotification, mockUser);
      expect(sendInAppStub.calledOnce).to.be.true;
      expect(addJobStub.calledTwice).to.be.true; // Once for push, once for email
      expect(addJobStub.calledWith('push', sinon.match.any)).to.be.true;
      expect(addJobStub.calledWith('email', sinon.match.any)).to.be.true;
    });
  });

  describe('markAsRead, markManyAsRead, markAllAsRead', () => {
    let userId;
    let emitToUserStub;

    beforeEach(() => {
      userId = new mongoose.Types.ObjectId().toString();
      emitToUserStub = sandbox.stub(socketManager, 'emitToUser');
      sandbox.stub(Notification, 'getUnreadCount').resolves(5); // Mock initial unread count
    });

    it('markAsRead should update one notification and emit count', async () => {
      const notificationId = new mongoose.Types.ObjectId().toString();
      sandbox.stub(Notification, 'markManyAsRead').resolves({ modifiedCount: 1 });

      await notificationService.markAsRead(userId, [notificationId]);

      expect(Notification.markManyAsRead.calledOnceWith(userId, [notificationId])).to.be.true;
      expect(emitToUserStub.calledOnceWith(userId, 'notification:count', { unread: 5 })).to.be.true;
    });

    it('markManyAsRead should update multiple notifications and emit count', async () => {
      const notificationIds = [
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString()
      ];
      sandbox.stub(Notification, 'markManyAsRead').resolves({ modifiedCount: 2 });

      await notificationService.markAsRead(userId, notificationIds); // Uses the same underlying function for marking

      expect(Notification.markManyAsRead.calledOnceWith(userId, notificationIds)).to.be.true;
      expect(emitToUserStub.calledOnceWith(userId, 'notification:count', { unread: 5 })).to.be.true;
    });

    it('markAllAsRead should update all unread notifications and emit count 0', async () => {
      sandbox.stub(Notification, 'updateMany').resolves({ modifiedCount: 10 });
      // Simulate that after marking all, the count becomes 0
      Notification.getUnreadCount.resolves(0);

      await notificationService.markAllAsRead(userId);

      expect(
        Notification.updateMany.calledOnceWith({ userId, status: 'unread' }, sinon.match.object)
      ).to.be.true;
      expect(emitToUserStub.calledOnceWith(userId, 'notification:count', { unread: 0 })).to.be.true;
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete archived or old read notifications', async () => {
      const deleteManyStub = sandbox.stub(Notification, 'deleteMany').resolves({ deletedCount: 5 });
      const daysToKeep = 30;
      const fakeNow = new Date('2024-01-01T00:00:00.000Z');
      sandbox.useFakeTimers(fakeNow.getTime());
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await notificationService.cleanupOldNotifications(daysToKeep);

      expect(deleteManyStub.calledOnce).to.be.true;
      const queryArg = deleteManyStub.firstCall.args[0];

      expect(queryArg.$or).to.be.an('array').with.lengthOf(2);
      expect(queryArg.$or[0]).to.deep.equal({ status: 'archived' });
      expect(queryArg.$or[1]).to.deep.equal({ createdAt: { $lt: cutoffDate }, status: 'read' });
    });
  });
});

