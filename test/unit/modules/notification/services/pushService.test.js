const { expect } = require('chai');
const sinon = require('sinon');
const admin = require('firebase-admin');
const pushService = require('../../../../../src/modules/notification/services/pushService');
const config = require('../../../../../src/config');
const User = require('../../../../../src/modules/auth/models/User');

describe('PushService Unit Tests', () => {
  let sandbox;
  let mockMessaging;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockMessaging = {
      sendMulticast: sandbox.stub(),
      send: sandbox.stub()
    };

    // Stub Firebase Admin SDK initialization
    // Ensure config.firebase.serviceAccount has a minimal structure for the test
    const originalServiceAccount = config.firebase.serviceAccount;
    config.firebase.serviceAccount = { projectId: 'test-project' }; // Minimal valid structure

    // Return a fake Firebase app with a messaging method so that the service
    // does not rely on a globally registered default app during tests
    sandbox.stub(admin, 'initializeApp').returns({ messaging: () => mockMessaging });
    sandbox.stub(admin, 'credential').value({ cert: sandbox.stub().returns({}) });

    pushService.initialize(); // Call initialize to set up the mocked messaging
    config.firebase.serviceAccount = originalServiceAccount; // Restore original config
  });

  afterEach(() => {
    sandbox.restore();
    pushService.initialized = false; // Reset for next test
    pushService.messaging = null;
  });

  describe('sendNotification', () => {
    it('should send push notification successfully', async () => {
      const tokens = ['token1', 'token2'];
      const options = {
        tokens,
        title: 'Test Push',
        body: 'This is a test push notification.',
        data: { type: 'test' }
      };

      mockMessaging.sendMulticast.resolves({
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'id1' },
          { success: true, messageId: 'id2' }
        ]
      });

      const result = await pushService.sendNotification(options);

      expect(result.success).to.be.true;
      expect(result.successCount).to.equal(2);
      expect(mockMessaging.sendMulticast.calledOnce).to.be.true;
      const sentMessage = mockMessaging.sendMulticast.firstCall.args[0];
      expect(sentMessage.tokens).to.deep.equal(tokens);
      expect(sentMessage.notification.title).to.equal(options.title);
      expect(sentMessage.data.type).to.equal('test');
    });

    it('should handle partial success and identify failed tokens', async () => {
      const tokens = ['validToken1', 'invalidToken1', 'validToken2'];
      const options = { tokens, title: 'Test', body: 'Test Body' };

      mockMessaging.sendMulticast.resolves({
        successCount: 2,
        failureCount: 1,
        responses: [
          { success: true, messageId: 'id1' },
          { success: false, error: { code: 'messaging/invalid-registration-token' } },
          { success: true, messageId: 'id2' }
        ]
      });
      sandbox.stub(pushService, 'handleFailedTokens').resolves();

      const result = await pushService.sendNotification(options);

      expect(result.success).to.be.true;
      expect(result.successCount).to.equal(2);
      expect(result.failureCount).to.equal(1);
      expect(result.successfulTokens).to.deep.equal(['validToken1', 'validToken2']);
      expect(result.failedTokens).to.deep.equal([
        { token: 'invalidToken1', error: 'messaging/invalid-registration-token' }
      ]);
      expect(pushService.handleFailedTokens.calledOnce).to.be.true;
    });

    it('should return error if push service is not configured', async () => {
      pushService.messaging = null; // Simulate not configured
      const result = await pushService.sendNotification({
        tokens: ['token1'],
        title: 'T',
        body: 'B'
      });
      expect(result.success).to.be.false;
      expect(result.error).to.equal('Push notifications not configured');
    });
  });

  describe('handleFailedTokens', () => {
    it('should remove invalid tokens from users', async () => {
      const failedTokens = [
        { token: 'invalid1', error: 'messaging/invalid-registration-token' },
        { token: 'validButFailed', error: 'messaging/unavailable' },
        { token: 'invalid2', error: 'messaging/registration-token-not-registered' }
      ];
      const updateManyStub = sandbox.stub(User, 'updateMany').resolves();

      await pushService.handleFailedTokens(failedTokens);

      expect(updateManyStub.calledOnce).to.be.true;
      const query = updateManyStub.firstCall.args[0];
      const update = updateManyStub.firstCall.args[1];
      expect(query['deviceTokens.token'].$in).to.deep.equal(['invalid1', 'invalid2']);
      expect(update.$pull.deviceTokens.token.$in).to.deep.equal(['invalid1', 'invalid2']);
    });

    it('should not call User.updateMany if no invalid tokens based on error code', async () => {
      const failedTokens = [
        { token: 'token1', error: 'messaging/unavailable' },
        { token: 'token2', error: 'messaging/internal-error' }
      ];
      const updateManyStub = sandbox.stub(User, 'updateMany');

      await pushService.handleFailedTokens(failedTokens);
      expect(updateManyStub.called).to.be.false;
    });
  });

  describe('sendToTopic', async () => {
    it('should send a notification to a topic successfully', async () => {
      const topic = 'global-announcements';
      const options = {
        title: 'Global Event',
        body: 'A new global event has started!',
        data: { eventId: 'evt123' }
      };

      mockMessaging.send.resolves('projects/test-project/messages/mock-message-id');

      const result = await pushService.sendToTopic(topic, options);

      expect(result.success).to.be.true;
      expect(result.messageId).to.equal('projects/test-project/messages/mock-message-id');
      expect(mockMessaging.send.calledOnce).to.be.true;
      const sentMessage = mockMessaging.send.firstCall.args[0];
      expect(sentMessage.topic).to.equal(topic);
      expect(sentMessage.notification.title).to.equal(options.title);
      expect(sentMessage.data.eventId).to.equal('evt123');
    });

    it('should handle error when sending to topic', async () => {
      const topic = 'failed-topic';
      const options = { title: 'Fail Test', body: 'This should fail.' };

      mockMessaging.send.rejects(new Error('FCM topic send error'));

      const result = await pushService.sendToTopic(topic, options);

      expect(result.success).to.be.false;
      expect(result.error).to.equal('FCM topic send error');
    });
  });
});
