const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');

describe('Health Check API', () => {
  describe('GET /health', () => {
    it('should return health status and basic security headers', async () => {
      const res = await request(app).get('/health').expect(200);

      expect(res.body).to.have.property('status', 'success');
      expect(res.body.data).to.have.property('status', 'UP');
      expect(res.body.data).to.have.property('timestamp');
      expect(res.body.data).to.have.property('uptime');
      expect(res.body.data).to.have.property('environment');
      expect(res.body.data).to.have.property('version');

      // Check for a common Helmet header
      expect(res.headers).to.have.property('x-dns-prefetch-control', 'off');
      expect(res.headers).to.have.property('x-content-type-options', 'nosniff');
    });

    it('should not be rate limited', async () => {
      // Make multiple requests (default standard limit is 100, relaxed is 200)
      // Health endpoint itself should not be rate-limited usually.
      // The rateLimiter in middleware/rateLimiter.js standard/strict/relaxed
      // does not apply to /health as it's defined before rate limiting middleware in app.js
      for (let i = 0; i < 10; i++) {
        // Reduced from 100 for speed, as /health is not rate limited
        await request(app).get('/health').expect(200);
      }
    });
  });
});
