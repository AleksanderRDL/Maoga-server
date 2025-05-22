const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');

describe('Health Check API', () => {
    describe('GET /health', () => {
        it('should return health status', async () => {
            const res = await request(app)
                .get('/health')
                .expect(200);

            expect(res.body).to.have.property('status', 'success');
            expect(res.body.data).to.have.property('status', 'UP');
            expect(res.body.data).to.have.property('timestamp');
            expect(res.body.data).to.have.property('uptime');
            expect(res.body.data).to.have.property('environment');
            expect(res.body.data).to.have.property('version');
        });

        it('should not be rate limited', async () => {
            // Make multiple requests
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .get('/health')
                    .expect(200);
            }
        });
    });
});