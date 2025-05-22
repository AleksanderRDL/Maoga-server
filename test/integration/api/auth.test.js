const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const { testUsers } = require('../../fixtures/users');

describe('Auth API', () => {
    beforeEach(async () => {
        // Clean up users collection
        await User.deleteMany({});
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const newUser = testUsers[0];

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: newUser.email,
                    username: newUser.username,
                    password: newUser.password,
                    displayName: newUser.displayName
                })
                .expect(201);

            expect(res.body.status).to.equal('success');
            expect(res.body.data).to.have.property('user');
            expect(res.body.data).to.have.property('accessToken');
            expect(res.body.data).to.have.property('refreshToken');

            const user = res.body.data.user;
            expect(user.email).to.equal(newUser.email);
            expect(user.username).to.equal(newUser.username);
            expect(user.profile.displayName).to.equal(newUser.displayName);
            expect(user).to.not.have.property('hashedPassword');
        });

        it('should fail with duplicate email', async () => {
            const newUser = testUsers[0];

            // Create user first
            await User.create({
                email: newUser.email,
                username: 'differentusername',
                hashedPassword: newUser.password
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: newUser.email,
                    username: newUser.username,
                    password: newUser.password
                })
                .expect(409);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Email already registered');
        });

        it('should fail with duplicate username', async () => {
            const newUser = testUsers[0];

            // Create user first
            await User.create({
                email: 'different@example.com',
                username: newUser.username,
                hashedPassword: newUser.password
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: newUser.email,
                    username: newUser.username,
                    password: newUser.password
                })
                .expect(409);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Username already taken');
        });

        it('should fail with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    username: 'testuser',
                    password: 'weak'
                })
                .expect(422);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.code).to.equal('VALIDATION_ERROR');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a test user
            const user = new User({
                email: testUsers[0].email,
                username: testUsers[0].username,
                hashedPassword: testUsers[0].password
            });
            await user.save();
        });

        it('should login with email successfully', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    credential: testUsers[0].email,
                    password: testUsers[0].password
                })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data).to.have.property('user');
            expect(res.body.data).to.have.property('accessToken');
            expect(res.body.data).to.have.property('refreshToken');
        });

        it('should login with username successfully', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    credential: testUsers[0].username,
                    password: testUsers[0].password
                })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data).to.have.property('user');
            expect(res.body.data).to.have.property('accessToken');
            expect(res.body.data).to.have.property('refreshToken');
        });

        it('should fail with invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    credential: testUsers[0].email,
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.equal('Invalid credentials');
        });

        it('should fail with non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    credential: 'nonexistent@example.com',
                    password: 'somepassword'
                })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.equal('Invalid credentials');
        });
    });

    describe('POST /api/auth/refresh', () => {
        let validRefreshToken;
        let validAccessToken;

        beforeEach(async () => {
            // Register a user and get tokens
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testUsers[0].email,
                    username: testUsers[0].username,
                    password: testUsers[0].password
                });

            if (res.body.data) {
                validRefreshToken = res.body.data.refreshToken;
                validAccessToken = res.body.data.accessToken;
            }
        });

        it('should refresh tokens successfully', async () => {
            if (!validRefreshToken) {
                this.skip();
            }

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: validRefreshToken
                })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data).to.have.property('accessToken');
            expect(res.body.data).to.have.property('refreshToken');
            expect(res.body.data.accessToken).to.not.equal(validAccessToken);
            expect(res.body.data.refreshToken).to.not.equal(validRefreshToken);
        });

        it('should fail with invalid refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: 'invalid.refresh.token'
                })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Invalid refresh token');
        });
    });

    describe('POST /api/auth/logout', () => {
        let validAccessToken;
        let validRefreshToken;

        beforeEach(async () => {
            // Register a user and get tokens
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testUsers[0].email,
                    username: testUsers[0].username,
                    password: testUsers[0].password
                });

            if (res.body.data) {
                validAccessToken = res.body.data.accessToken;
                validRefreshToken = res.body.data.refreshToken;
            }
        });

        it('should logout successfully', async () => {
            if (!validAccessToken) {
                this.skip();
            }

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${validAccessToken}`)
                .send({
                    refreshToken: validRefreshToken
                })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.message).to.equal('Logged out successfully');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .send({
                    refreshToken: validRefreshToken || 'dummy-token'
                })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.equal('No token provided');
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit auth endpoints after too many requests', async () => {
            // Make 5 requests (limit is 5)
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .set('X-Test-Rate-Limit', 'true')
                    .send({
                        credential: 'test@example.com',
                        password: 'wrongpassword'
                    })
                    .expect(401);
            }

            // The 6th request should be rate limited
            const res = await request(app)
                .post('/api/auth/login')
                .set('X-Test-Rate-Limit', 'true')
                .send({
                    credential: 'test@example.com',
                    password: 'wrongpassword'
                })
                .expect(429);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Too many requests');
        });
    });
});