const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const Report = require('../../../src/modules/admin/models/Report');
const authService = require('../../../src/modules/auth/services/authService');
const { testUsers } = require('../../fixtures/users');

describe('Report API (User)', () => {
  let userToken;
  let reporterUser;
  let targetUser;

  beforeEach(async () => {
    // Clean up collections
    await User.deleteMany({});
    await Report.deleteMany({});

    // Create reporter user
    const reporterResult = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password
    });
    userToken = reporterResult.accessToken;
    reporterUser = reporterResult.user;

    // Create target user
    const targetResult = await authService.register({
      email: testUsers[1].email,
      username: testUsers[1].username,
      password: testUsers[1].password
    });
    targetUser = targetResult.user;
  });

  describe('POST /api/reports', () => {
    it('should submit a report successfully', async () => {
      const reportData = {
        reportedId: targetUser.id,
        reportType: 'user_profile',
        reason: 'harassment',
        description:
          'This user has been sending inappropriate messages and harassing other players in lobbies'
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reportData)
        .expect(201);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.report).to.have.property('_id');
      expect(res.body.data.report.reporterId).to.equal(reporterUser.id);
      expect(res.body.data.report.reportedId).to.equal(targetUser.id);
      expect(res.body.data.report.status).to.equal('open');
      expect(res.body.data.report.priority).to.equal('high'); // harassment gets high priority
    });

    it('should include evidence in report', async () => {
      const reportData = {
        reportedId: targetUser.id,
        reportType: 'chat_message',
        reason: 'hate_speech',
        description: 'User posted hateful messages in the lobby chat targeting other players',
        evidence: {
          screenshots: [
            'https://example.com/screenshot1.png',
            'https://example.com/screenshot2.png'
          ],
          matchId: '507f1f77bcf86cd799439011'
        }
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reportData)
        .expect(201);

      expect(res.body.data.report.evidence.screenshots).to.have.lengthOf(2);
      expect(res.body.data.report.evidence.matchId).to.equal('507f1f77bcf86cd799439011');
      expect(res.body.data.report.priority).to.equal('critical'); // hate_speech gets critical priority
    });

    it('should prevent self-reporting', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reportedId: reporterUser.id,
          reportType: 'user_profile',
          reason: 'other',
          description: 'Testing self-report which should not be allowed'
        })
        .expect(400);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('Cannot report yourself');
    });

    it('should prevent duplicate reports within 24 hours', async () => {
      const reportData = {
        reportedId: targetUser.id,
        reportType: 'user_profile',
        reason: 'spam',
        description: 'User is spamming messages in multiple lobbies'
      };

      // First report
      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reportData)
        .expect(201);

      // Duplicate report
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reportData)
        .expect(409);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('You have already reported this user recently');
    });

    it('should validate report data', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reportedId: targetUser.id,
          reportType: 'user_profile',
          reason: 'harassment',
          description: 'Too short' // Less than 20 characters
        })
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({
          reportedId: targetUser.id,
          reportType: 'user_profile',
          reason: 'harassment',
          description: 'This should fail without authentication token'
        })
        .expect(401);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('No token provided');
    });
  });

  describe('GET /api/reports/my-reports', () => {
    beforeEach(async () => {
      // Create some test reports
      await Report.create([
        {
          reporterId: reporterUser.id,
          reportedId: targetUser.id,
          reportType: 'user_profile',
          reason: 'harassment',
          description: 'First test report for harassment',
          status: 'open'
        },
        {
          reporterId: reporterUser.id,
          reportedId: targetUser.id,
          reportType: 'chat_message',
          reason: 'spam',
          description: 'Second test report for spamming',
          status: 'resolved'
        }
      ]);
    });

    it('should get user submitted reports', async () => {
      const res = await request(app)
        .get('/api/reports/my-reports')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.reports).to.have.lengthOf(2);
      expect(res.body.data.reports[0].reporterId).to.equal(reporterUser.id);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/reports/my-reports')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ status: 'open' })
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.reports).to.have.lengthOf(1);
      expect(res.body.data.reports[0].status).to.equal('open');
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/reports/my-reports')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ limit: 1, page: 1 })
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.reports).to.have.lengthOf(1);
      expect(res.body.data.pagination).to.deep.include({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2
      });
    });
  });

  describe('GET /api/reports/:reportId', () => {
    let testReport;

    beforeEach(async () => {
      testReport = await Report.create({
        reporterId: reporterUser.id,
        reportedId: targetUser.id,
        reportType: 'user_profile',
        reason: 'harassment',
        description: 'Test report for viewing',
        status: 'under_review'
      });
    });

    it('should get own report details', async () => {
      const res = await request(app)
        .get(`/api/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.report._id).to.equal(testReport._id.toString());
      expect(res.body.data.report.status).to.equal('under_review');
    });

    it('should not allow viewing other users reports', async () => {
      // Create another user
      const otherUserResult = await authService.register({
        email: 'other@example.com',
        username: 'otheruser',
        password: 'TestPassword123!'
      });

      const res = await request(app)
        .get(`/api/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${otherUserResult.accessToken}`)
        .expect(404);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('Report not found');
    });
  });
});
