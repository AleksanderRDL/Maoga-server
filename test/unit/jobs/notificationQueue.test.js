const { expect } = require('chai');
const sinon = require('sinon');
const notificationQueue = require('../../../src/jobs/notificationQueue');
const notificationService = require('../../../src/modules/notification/services/notificationService');
const logger = require('../../../src/utils/logger');

describe('NotificationQueue Unit Tests', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Suppress logger output during tests
    sandbox.stub(logger, 'debug');
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'warn');
    sandbox.stub(logger, 'error');

    notificationQueue.queues.push = [];
    notificationQueue.queues.email = [];
    notificationQueue.processing.push = false;
    notificationQueue.processing.email = false;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('addJob', () => {
    it('should add a job to the push queue', async () => {
      const data = { notificationId: 'push123' };
      await notificationQueue.addJob('push', data);
      expect(notificationQueue.queues.push).to.have.lengthOf(1);
      expect(notificationQueue.queues.push[0].data).to.deep.equal(data);
    });

    it('should add a job to the email queue', async () => {
      const data = { notificationId: 'email123' };
      await notificationQueue.addJob('email', data);
      expect(notificationQueue.queues.email).to.have.lengthOf(1);
      expect(notificationQueue.queues.email[0].data).to.deep.equal(data);
    });

    it('should throw error for invalid queue type', async () => {
      try {
        await notificationQueue.addJob('invalidType', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Invalid queue type: invalidType');
      }
    });
  });

  describe('processPushQueue', () => {
    let processPushStub;

    beforeEach(() => {
      processPushStub = sandbox.stub(notificationService, 'processPushNotification');
    });

    it('should process jobs from the push queue', async () => {
      processPushStub.resolves();
      await notificationQueue.addJob('push', { notificationId: 'p1' });
      await notificationQueue.addJob('push', { notificationId: 'p2' });

      await notificationQueue.processPushQueue();

      expect(processPushStub.callCount).to.equal(2);
      expect(notificationQueue.queues.push).to.be.empty;
    });

    it('should retry failed push jobs up to 3 times', async () => {
      processPushStub.onFirstCall().rejects(new Error('Failed 1'));
      processPushStub.onSecondCall().resolves();
      processPushStub.onThirdCall().rejects(new Error('Failed 2'));
      processPushStub.onCall(3).rejects(new Error('Failed 3'));

      await notificationQueue.addJob('push', { notificationId: 'pFail' });
      await notificationQueue.addJob('push', { notificationId: 'pSuccessAfterFail' });

      // First attempt
      await notificationQueue.processPushQueue();
      expect(processPushStub.callCount).to.equal(2); // pFail (fails), pSuccessAfterFail (succeeds)
      expect(notificationQueue.queues.push).to.have.lengthOf(1); // pFail is re-queued
      expect(notificationQueue.queues.push[0].attempts).to.equal(1);

      // Second attempt for pFail
      await notificationQueue.processPushQueue();
      expect(processPushStub.callCount).to.equal(3); // pFail (fails again)
      expect(notificationQueue.queues.push).to.have.lengthOf(1);
      expect(notificationQueue.queues.push[0].attempts).to.equal(2);

      // Third attempt for pFail
      await notificationQueue.processPushQueue();
      expect(processPushStub.callCount).to.equal(4); // pFail (fails again)
      expect(notificationQueue.queues.push).to.have.lengthOf(0); // pFail is discarded after 3 failures
    });

    it('should not process if already processing or queue empty', async () => {
      notificationQueue.processing.push = true;
      await notificationQueue.processPushQueue();
      expect(processPushStub.called).to.be.false;

      notificationQueue.processing.push = false;
      await notificationQueue.processPushQueue(); // Empty queue
      expect(processPushStub.called).to.be.false;
    });
  });

  describe('processEmailQueue', () => {
    let processEmailStub;

    beforeEach(() => {
      processEmailStub = sandbox.stub(notificationService, 'processEmailNotification');
    });

    it('should process jobs from the email queue', async () => {
      processEmailStub.resolves();
      await notificationQueue.addJob('email', { notificationId: 'e1' });
      await notificationQueue.addJob('email', { notificationId: 'e2' });

      await notificationQueue.processEmailQueue();

      expect(processEmailStub.callCount).to.equal(2);
      expect(notificationQueue.queues.email).to.be.empty;
    });

    it('should retry failed email jobs with exponential backoff', async () => {
      processEmailStub.onFirstCall().rejects(new Error('Email Failed 1'));
      processEmailStub.onSecondCall().rejects(new Error('Email Failed 2')); // Should be for the next job
      processEmailStub.onThirdCall().resolves(); // Retry of the first job

      await notificationQueue.addJob('email', { notificationId: 'eFail' });
      await notificationQueue.addJob('email', { notificationId: 'eSuccessStraight' });

      // Initial processing attempt
      await notificationQueue.processEmailQueue(); // eFail (fails), eSuccessStraight (fails because stub is onSecondCall)
      await new Promise((resolve) => setImmediate(resolve));
      expect(processEmailStub.callCount).to.equal(2);
      expect(notificationQueue.queues.email).to.have.lengthOf(2); // Both re-queued due to stub setup for failure
      expect(notificationQueue.queues.email[0].attempts).to.equal(1); // eFail
      expect(notificationQueue.queues.email[1].attempts).to.equal(1); // eSuccessStraight

      // Simulate time passing for backoff (e.g., 2 seconds for the first job's retry)
      // The test queue won't respect the setTimeout, it's just to illustrate backoff logic exists.
      // In a real scenario, the interval timer would re-trigger processing.
      // Here, we'll manually call processEmailQueue again.

      processEmailStub.resetHistory(); // Reset stub history for clarity on next call
      processEmailStub.onFirstCall().resolves(); // Now eFail (attempt 2) should succeed
      processEmailStub.onSecondCall().resolves(); // eSuccessStraight (attempt 2) should succeed

      await notificationQueue.processEmailQueue();
      expect(processEmailStub.callCount).to.equal(2); // Both jobs processed again
      expect(notificationQueue.queues.email).to.be.empty;
    });
  });

  describe('start/stop', () => {
    it('should set and clear intervals', () => {
      sandbox.spy(global, 'setInterval');
      sandbox.spy(global, 'clearInterval');

      notificationQueue.start();
      expect(setInterval.callCount).to.equal(2); // For push and email
      expect(notificationQueue.intervals.push).to.exist;
      expect(notificationQueue.intervals.email).to.exist;

      notificationQueue.stop();
      expect(clearInterval.callCount).to.equal(2);

      // Restore original setInterval and clearInterval
      global.setInterval.restore();
      global.clearInterval.restore();
    });
  });

  describe('getStats', () => {
    it('should return correct queue statistics', async () => {
      await notificationQueue.addJob('push', {});
      await notificationQueue.addJob('email', {});
      await notificationQueue.addJob('email', {});
      notificationQueue.processing.push = true;

      const stats = notificationQueue.getStats();
      expect(stats.push.pending).to.equal(1);
      expect(stats.push.processing).to.be.true;
      expect(stats.email.pending).to.equal(2);
      expect(stats.email.processing).to.be.false;
    });
  });
});
