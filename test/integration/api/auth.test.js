const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const User = require('../../../src/modules/auth/models/User');
const { testUsers } = require('../../fixtures/users');
const tokenService = require('../../../src/modules/auth/services/tokenService');
const config = require('../../../src/config');
const jwt = require('jsonwebtoken');


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
                hashedPassword: newUser.password // Will be hashed by pre-save
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
                hashedPassword: newUser.password // Will be hashed by pre-save
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

        it('should fail with invalid password (too weak)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    username: 'testuser',
                    password: 'weak' // Password does not meet criteria
                })
                .expect(422); // Validation error

            expect(res.body.status).to.equal('error');
            expect(res.body.error.code).to.equal('VALIDATION_ERROR');
            expect(res.body.error.details).to.be.an('array').that.is.not.empty;
            expect(res.body.error.details[0].field).to.equal('password');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a test user directly for login tests
            const user = new User({
                email: testUsers[0].email,
                username: testUsers[0].username,
                hashedPassword: testUsers[0].password, // Will be hashed by pre-save hook
                status: 'active'
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
        });

        it('should fail with invalid credentials (wrong password)', async () => {
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

        const nonActiveStatuses = ['suspended', 'banned', 'deleted'];
        nonActiveStatuses.forEach(status => {
            it(`should fail to login if user status is "${status}"`, async () => {
                await User.updateOne({ email: testUsers[0].email }, { status: status });
                const res = await request(app)
                    .post('/api/auth/login')
                    .send({
                        credential: testUsers[0].email,
                        password: testUsers[0].password
                    })
                    .expect(401);

                expect(res.body.status).to.equal('error');
                expect(res.body.error.message).to.equal(`Account is ${status}`);
            });
        });
    });

    describe('POST /api/auth/refresh', () => {
        let validRefreshToken;
        let originalAccessToken; // To compare against the new one

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
                originalAccessToken = res.body.data.accessToken;
            } else {
                // Fail fast if registration didn't yield tokens
                throw new Error('Test setup failed: Could not get tokens from registration.');
            }
        });

        it('should refresh tokens successfully', async () => {
            // No need to skip, beforeEach ensures validRefreshToken exists or fails
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: validRefreshToken
                })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data).to.have.property('accessToken');
            expect(res.body.data).to.have.property('refreshToken');
            expect(res.body.data.accessToken).to.not.equal(originalAccessToken);
            expect(res.body.data.refreshToken).to.not.equal(validRefreshToken);
        });

        it('should fail with invalid refresh token (malformed)', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: 'invalid.refresh.token'
                })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Invalid refresh token');
        });

        it('should fail with an expired refresh token', async () => {
            // Create an expired refresh token
            const user = await User.findOne({ email: testUsers[0].email });
            const expiredToken = jwt.sign(
                { id: user._id.toString(), tokenType: 'refresh', jti: 'expiredjti' },
                config.jwt.refreshSecret,
                {
                    expiresIn: '-1s', // Already expired
                    issuer: config.jwt.issuer,
                    audience: config.jwt.audience
                }
            );
            // Even if this token isn't in the DB, verifyRefreshToken will catch expiry first
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: expiredToken })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.equal('Refresh token has expired');
        });


        it('should fail if refresh token is not found in DB (e.g., after logout)', async () => {
            // Simulate logout by removing the token from the user's record
            await User.updateOne(
                { email: testUsers[0].email },
                { $set: { refreshTokens: [] } }
            );

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: validRefreshToken }) // Use the token that was valid before logout
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.equal('Invalid refresh token'); // service throws this when token not found/valid
        });
    });

    describe('POST /api/auth/logout', () => {
        let accessTokenForLogout;
        let refreshTokenForLogout;

        beforeEach(async () => {
            const registerRes = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testUsers[1].email, // Use a different user for logout tests
                    username: testUsers[1].username,
                    password: testUsers[1].password
                });
            if (registerRes.body.data) {
                accessTokenForLogout = registerRes.body.data.accessToken;
                refreshTokenForLogout = registerRes.body.data.refreshToken;
            } else {
                throw new Error('Logout test setup failed: Could not register user.');
            }
        });

        it('should logout successfully', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessTokenForLogout}`)
                .send({
                    refreshToken: refreshTokenForLogout // Providing specific token to remove
                })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.message).to.equal('Logged out successfully');

            // Verify token is removed (optional: try to refresh with it)
            const refreshRes = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: refreshTokenForLogout });
            expect(refreshRes.status).to.be.oneOf([401, 404]); // Should fail
        });

        it('should logout from all sessions if refreshToken is not provided', async () => {
            // Add another refresh token to the user to simulate multiple sessions
            const user = await User.findOne({ email: testUsers[1].email });
            const anotherRefreshToken = tokenService.generateRefreshToken(user);
            user.refreshTokens.push({
                token: anotherRefreshToken,
                expiresAt: new Date(Date.now() + tokenService.getRefreshTokenExpiry())
            });
            await user.save();

            expect(user.refreshTokens.length).to.be.greaterThan(1);

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessTokenForLogout}`)
                .send({}) // No refreshToken sent
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.message).to.equal('Logged out successfully');

            const updatedUser = await User.findById(user._id);
            expect(updatedUser.refreshTokens).to.be.an('array').that.is.empty;
        });


        it('should fail without authentication token', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .send({
                    refreshToken: refreshTokenForLogout || 'dummy-token'
                })
                .expect(401);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.equal('No token provided');
        });
    });

    describe('Password Reset Placeholders', () => {
        it('POST /api/auth/reset-password should return success message (placeholder)', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ email: 'test@example.com' })
                .expect(200);

            expect(res.body.status).to.equal('success');
            expect(res.body.data.message).to.equal('If the email exists, a reset link will be sent');
        });

        it('POST /api/auth/reset-password/confirm should indicate not implemented (placeholder)', async () => {
            // This endpoint currently throws an error in the service layer
            const res = await request(app)
                .post('/api/auth/reset-password/confirm')
                .send({ token: 'anytoken', newPassword: 'NewPassword123!' })
                .expect(500); // Because the service throws a generic Error

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Password reset confirmation not yet implemented');
        });
    });


    describe('Rate Limiting', () => {
        it('should rate limit auth endpoints after too many requests', async () => {
            const loginPayload = {
                credential: 'testratelimit@example.com',
                password: 'wrongpassword'
            };
            // Default strict limit is 5 for auth endpoints as per rateLimiter.js
            const limit = 5;

            for (let i = 0; i < limit; i++) {
                await request(app)
                    .post('/api/auth/login')
                    .set('X-Test-Rate-Limit', 'true') // Header to bypass test skip
                    .send(loginPayload)
                    .expect(401); // Expecting login failure, not rate limit yet
            }

            // The (limit + 1)-th request should be rate limited
            const res = await request(app)
                .post('/api/auth/login')
                .set('X-Test-Rate-Limit', 'true')
                .send(loginPayload)
                .expect(429);

            expect(res.body.status).to.equal('error');
            expect(res.body.error.message).to.include('Too many requests');
        });
    });
});