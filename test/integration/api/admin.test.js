const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const Report = require('../../../src/modules/admin/models/Report');
const authService = require('../../../src/modules/auth/services/authService');
const { testUsers } = require('../../fixtures/users');

describe('Admin API', () => {
  let adminToken;
  let regularUserToken;
  let testUser;
  let testAdmin;

  beforeEach(async () => {
    // Clean up collections
    await User.deleteMany({});
    await Report.deleteMany({});

    // Create admin user
    const adminResult = await authService.register({
      email: testUsers[2].email,
      username: testUsers[2].username,
      password: testUsers[2].password,
      role: 'admin'
    });
    adminToken = adminResult.accessToken;
    testAdmin = adminResult.user;

    // Create regular user
    const userResult = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password,
      role: 'user'
    });
    regularUserToken = userResult.accessToken;
    testUser = userResult.user;
  });

  describe('User Management', () => {
    describe('GET /api/admin/users', () => {
      beforeEach(async () => {
        // Create additional test users
        await User.create([
          {
            email: 'suspended@example.com',
            username: 'suspendeduser',
            hashedPassword: 'password123',
            status: 'suspended'
          },
          {
            email: 'banned@example.com',
            username: 'banneduser',
            hashedPassword: 'password123',
            status: 'banned'
          }
        ]);
      });

      it('should list users with pagination (admin only)', async () => {
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ limit: 2, page: 1 })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.users).to.have.lengthOf(2);
        expect(res.body.data.pagination).to.deep.include({
          page: 1,
          limit: 2,
          total: 4
        });
      });

      it('should filter users by status', async () => {
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ status: 'suspended' })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.users).to.have.lengthOf(1);
        expect(res.body.data.users[0].status).to.equal('suspended');
      });

      it('should search users by username or email', async () => {
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ search: 'banned' })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.users).to.have.lengthOf(1);
        expect(res.body.data.users[0].username).to.equal('banneduser');
      });

      it('should require admin role', async () => {
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.message).to.equal('Insufficient permissions');
      });
    });

    describe('GET /api/admin/users/:userId', () => {
      it('should get detailed user information', async () => {
        const res = await request(app)
          .get(`/api/admin/users/${testUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.user.email).to.equal(testUser.email);
        expect(res.body.data.stats).to.have.property('reportsSubmitted');
        expect(res.body.data.stats).to.have.property('reportsReceived');
        expect(res.body.data.stats).to.have.property('accountAge');
      });

      it('should return 404 for non-existent user', async () => {
        const res = await request(app)
          .get('/api/admin/users/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.message).to.equal('User not found');
      });
    });

    describe('PATCH /api/admin/users/:userId/status', () => {
      it('should update user status', async () => {
        const res = await request(app)
          .patch(`/api/admin/users/${testUser.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'suspended',
            reason: 'Violation of community guidelines - repeated harassment'
          })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.user.status).to.equal('suspended');

        // Verify in database
        const updatedUser = await User.findById(testUser.id);
        expect(updatedUser.status).to.equal('suspended');
        expect(updatedUser.suspensionDetails.reason).to.equal(
          'Violation of community guidelines - repeated harassment'
        );
        expect(updatedUser.suspensionDetails.adminId.toString()).to.equal(testAdmin.id);
      });

      it('should validate reason length', async () => {
        const res = await request(app)
          .patch(`/api/admin/users/${testUser.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'suspended',
            reason: 'Too short'
          })
          .expect(422);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });
  });

  describe('Report Management', () => {
    let testReport;

    beforeEach(async () => {
      // Create a test report
      testReport = await Report.create({
        reporterId: testUser.id,
        reportedId: testAdmin.id,
        reportType: 'user_profile',
        reason: 'harassment',
        description: 'This user has been sending inappropriate messages repeatedly'
      });
    });

    describe('GET /api/admin/reports', () => {
      it('should list reports with filters', async () => {
        const res = await request(app)
          .get('/api/admin/reports')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ status: 'open' })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.reports).to.have.lengthOf(1);
        expect(res.body.data.reports[0].status).to.equal('open');
      });

      it('should populate user information', async () => {
        const res = await request(app)
          .get('/api/admin/reports')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const report = res.body.data.reports[0];
        expect(report.reporterId).to.have.property('username');
        expect(report.reportedId).to.have.property('username');
      });
    });

    describe('PATCH /api/admin/reports/:reportId', () => {
      it('should update report status and add admin note', async () => {
        const res = await request(app)
          .patch(`/api/admin/reports/${testReport._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'under_review',
            priority: 'high',
            adminNote: 'Reviewing chat logs for evidence'
          })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.report.status).to.equal('under_review');
        expect(res.body.data.report.priority).to.equal('high');
        expect(res.body.data.report.adminNotes).to.have.lengthOf(1);
      });

      it('should resolve report with action', async () => {
        const res = await request(app)
          .patch(`/api/admin/reports/${testReport._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            resolution: {
              action: 'warning',
              notes: 'User has been warned about appropriate behavior'
            }
          })
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.report.status).to.equal('resolved');
        expect(res.body.data.report.resolution.action).to.equal('warning');
      });
    });
  });

  describe('Dashboard Statistics', () => {
    it('should return dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/admin/stats/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.stats).to.have.property('users');
      expect(res.body.data.stats.users).to.have.all.keys('total', 'active', 'suspended', 'banned');
      expect(res.body.data.stats).to.have.property('reports');
      expect(res.body.data.stats.reports).to.have.all.keys('open', 'today');
    });
  });
});
