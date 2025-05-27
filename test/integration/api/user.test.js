const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const { testUsers } = require('../../fixtures/users');
const authService = require('../../../src/modules/auth/services/authService');

describe('User API', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Clean up users collection
    await User.deleteMany({});

    // Register a test user
    const result = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password,
      displayName: testUsers[0].displayName
    });

    authToken = result.accessToken;
    testUser = result.user;
  });

  describe('GET /api/users/me', () => {
    it('should get current user profile', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.user.email).to.equal(testUser.email);
      expect(res.body.data.user.username).to.equal(testUser.username);
      expect(res.body.data.user).to.not.have.property('hashedPassword');
      expect(res.body.data.user).to.not.have.property('refreshTokens');
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/users/me').expect(401);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('No token provided');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update user profile', async () => {
      const updateData = {
        displayName: 'Updated Display Name',
        bio: 'This is my updated bio'
      };

      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.user.profile.displayName).to.equal(updateData.displayName);
      expect(res.body.data.user.profile.bio).to.equal(updateData.bio);
    });

    it('should validate profile update fields', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          displayName: 'A' // Too short
        })
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should ignore non-allowed fields', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          displayName: 'Valid Name',
          email: 'newemail@example.com', // Should be ignored
          role: 'admin' // Should be ignored
        })
        .expect(200);

      expect(res.body.data.user.profile.displayName).to.equal('Valid Name');
      expect(res.body.data.user.email).to.equal(testUser.email); // Unchanged
      expect(res.body.data.user.role).to.equal('user'); // Unchanged
    });
  });

  describe('PATCH /api/users/me/preferences', () => {
    it('should update gaming preferences', async () => {
      const preferences = {
        competitiveness: 'competitive',
        regions: ['NA', 'EU'],
        languages: ['en', 'es']
      };

      const res = await request(app)
        .patch('/api/users/me/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.user.gamingPreferences.competitiveness).to.equal('competitive');
      expect(res.body.data.user.gamingPreferences.regions).to.deep.equal(['NA', 'EU']);
      expect(res.body.data.user.gamingPreferences.languages).to.deep.equal(['en', 'es']);
    });

    it('should validate competitiveness value', async () => {
      const res = await request(app)
        .patch('/api/users/me/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          competitiveness: 'invalid'
        })
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('Game Profiles', () => {
    const gameProfile = {
      gameId: '507f1f77bcf86cd799439011',
      inGameName: 'ProGamer123',
      rank: 'Diamond',
      skillLevel: 85
    };

    describe('PUT /api/users/me/game-profiles', () => {
      it('should add a new game profile', async () => {
        const res = await request(app)
          .put('/api/users/me/game-profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameProfile)
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.user.gameProfiles).to.have.lengthOf(1);
        expect(res.body.data.user.gameProfiles[0].inGameName).to.equal(gameProfile.inGameName);
      });

      it('should update existing game profile', async () => {
        // First add a game profile
        await request(app)
          .put('/api/users/me/game-profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameProfile);

        // Then update it
        const updatedProfile = {
          ...gameProfile,
          rank: 'Master',
          skillLevel: 95
        };

        const res = await request(app)
          .put('/api/users/me/game-profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updatedProfile)
          .expect(200);

        expect(res.body.data.user.gameProfiles).to.have.lengthOf(1);
        expect(res.body.data.user.gameProfiles[0].rank).to.equal('Master');
        expect(res.body.data.user.gameProfiles[0].skillLevel).to.equal(95);
      });
    });

    describe('DELETE /api/users/me/game-profiles/:gameId', () => {
      it('should remove game profile', async () => {
        // First add a game profile
        await request(app)
          .put('/api/users/me/game-profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameProfile);

        // Then remove it
        const res = await request(app)
          .delete(`/api/users/me/game-profiles/${gameProfile.gameId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res.body.data.user.gameProfiles).to.have.lengthOf(0);
      });

      it('should return 404 for non-existent game profile', async () => {
        const res = await request(app)
          .delete('/api/users/me/game-profiles/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.message).to.equal('Game profile not found');
      });
    });
  });

  describe('Notification Settings', () => {
    it('should update notification settings', async () => {
      const settings = {
        email: {
          friendRequests: false,
          matchFound: true
        },
        push: {
          messages: false
        }
      };

      const res = await request(app)
        .patch('/api/users/me/notifications/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(settings)
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.user.notificationSettings.email.friendRequests).to.be.false;
      expect(res.body.data.user.notificationSettings.email.matchFound).to.be.true;
      expect(res.body.data.user.notificationSettings.push.messages).to.be.false;
    });

    it('should validate notification settings', async () => {
      const res = await request(app)
        .patch('/api/users/me/notifications/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: {
            friendRequests: 'not-a-boolean'
          }
        })
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('Device Tokens', () => {
    const deviceToken = {
      token: 'test-device-token-123',
      platform: 'ios'
    };

    describe('POST /api/users/me/devices', () => {
      it('should add device token', async () => {
        const res = await request(app)
          .post('/api/users/me/devices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deviceToken)
          .expect(200);

        expect(res.body.status).to.equal('success');
        expect(res.body.data.user.deviceTokens).to.have.lengthOf(1);
        expect(res.body.data.user.deviceTokens[0].token).to.equal(deviceToken.token);
        expect(res.body.data.user.deviceTokens[0].platform).to.equal(deviceToken.platform);
      });

      it('should prevent duplicate device tokens', async () => {
        // Add token first time
        await request(app)
          .post('/api/users/me/devices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deviceToken);

        // Try to add same token again
        const res = await request(app)
          .post('/api/users/me/devices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deviceToken)
          .expect(409);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.message).to.equal('Device token already registered');
      });

      it('should validate platform', async () => {
        const res = await request(app)
          .post('/api/users/me/devices')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            token: 'test-token',
            platform: 'invalid-platform'
          })
          .expect(422);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });

    describe('DELETE /api/users/me/devices/:token', () => {
      it('should remove device token', async () => {
        // First add a device token
        await request(app)
          .post('/api/users/me/devices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deviceToken);

        // Then remove it
        const res = await request(app)
          .delete(`/api/users/me/devices/${deviceToken.token}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res.body.data.user.deviceTokens).to.have.lengthOf(0);
      });

      it('should return 404 for non-existent token', async () => {
        const res = await request(app)
          .delete('/api/users/me/devices/non-existent-token')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(res.body.status).to.equal('error');
        expect(res.body.error.message).to.equal('Device token not found');
      });
    });
  });
});
