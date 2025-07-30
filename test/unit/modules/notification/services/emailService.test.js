const { expect } = require('chai');
const sinon = require('sinon');
const nodemailer = require('nodemailer');
const emailService = require('../../../../../src/modules/notification/services/emailService');
const config = require('../../../../../src/config');
const fs = require('fs').promises;
const path = require('path');

describe('EmailService Unit Tests', () => {
    let sandbox;
    let mockTransporter;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockTransporter = {
            sendMail: sandbox.stub(),
            verify: sandbox.stub().resolves()
        };
        sandbox.stub(nodemailer, 'createTransport').returns(mockTransporter);

        // Stub fs operations for template loading
        sandbox.stub(fs, 'readdir').resolves(['default.hbs', 'friend-request.hbs']);
        sandbox.stub(fs, 'readFile')
            .withArgs(sinon.match(/default\.hbs$/))
            .resolves('Default Template: {{message}} - {{appName}} {{year}}')
            .withArgs(sinon.match(/friend-request\.hbs$/))
            .resolves('Friend Request: {{requesterName}} sent you a request. {{appUrl}}');

        // Reset initialization state for each test
        emailService.initialized = false;
        emailService.transporter = null;
        emailService.templates.clear();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialize', () => {
        it('should initialize transporter and load templates', async () => {
            config.email.smtp = { host: 'smtp.test.com', port: 587, secure: false, user: 'u', pass: 'p' };
            await emailService.initialize();

            expect(nodemailer.createTransport.calledOnce).to.be.true;
            expect(mockTransporter.verify.calledOnce).to.be.true;
            expect(fs.readdir.calledOnce).to.be.true;
            expect(fs.readFile.callCount).to.equal(2); // For default and friend-request
            expect(emailService.templates.has('default')).to.be.true;
            expect(emailService.templates.has('friend-request')).to.be.true;
            expect(emailService.initialized).to.be.true;
        });

        it('should not initialize if SMTP not configured', async () => {
            config.email.smtp = null; // Simulate no SMTP config
            await emailService.initialize();
            expect(nodemailer.createTransport.called).to.be.false;
            expect(emailService.initialized).to.be.true; // Still sets initialized to true
            expect(emailService.transporter).to.be.null;
        });
    });

    describe('sendNotificationEmail', () => {
        beforeEach(async () => {
            config.email.smtp = { host: 'smtp.test.com', port: 587, user: 'u', pass: 'p' };
            await emailService.initialize(); // Ensure initialized and templates loaded
        });

        it('should send an email with correct template and data', async () => {
            mockTransporter.sendMail.resolves({ messageId: 'test-message-id' });
            const options = {
                to: 'recipient@example.com',
                subject: 'Test Subject',
                data: {
                    type: 'friend_request', // Matches 'friend-request.hbs'
                    requesterName: 'Test User',
                    message: 'This should not be in friend_request template'
                }
            };

            const result = await emailService.sendNotificationEmail(options);

            expect(result.success).to.be.true;
            expect(result.messageId).to.equal('test-message-id');
            expect(mockTransporter.sendMail.calledOnce).to.be.true;
            const mailOptions = mockTransporter.sendMail.firstCall.args[0];
            expect(mailOptions.to).to.equal(options.to);
            expect(mailOptions.subject).to.equal(options.subject);
            expect(mailOptions.html).to.include('Friend Request: Test User sent you a request.');
            expect(mailOptions.html).to.include(config.app.url);
            expect(mailOptions.html).to.not.include('This should not be in friend_request template');
        });

        it('should use default template if specific one not found', async () => {
            mockTransporter.sendMail.resolves({ messageId: 'default-id' });
            const options = {
                to: 'recipient@example.com',
                subject: 'Default Subject',
                data: {
                    type: 'unknown_type', // Will use default.hbs
                    message: 'This is a default message.'
                }
            };

            const result = await emailService.sendNotificationEmail(options);
            expect(result.success).to.be.true;
            const mailOptions = mockTransporter.sendMail.firstCall.args[0];
            expect(mailOptions.html).to.include('Default Template: This is a default message.');
            expect(mailOptions.html).to.include(config.app.name);
        });

        it('should return error if email service not configured', async () => {
            emailService.transporter = null; // Simulate not configured after init
            const result = await emailService.sendNotificationEmail({ to: 'r@e.com', subject: 'S', data: {} });
            expect(result.success).to.be.false;
            expect(result.error).to.equal('Email service not configured');
        });

        it('should return error if sendMail fails', async () => {
            mockTransporter.sendMail.rejects(new Error('SMTP Error'));
            const options = { to: 'recipient@example.com', subject: 'Test Subject', data: { type: 'default', message: 'Test' } };
            const result = await emailService.sendNotificationEmail(options);
            expect(result.success).to.be.false;
            expect(result.error).to.equal('SMTP Error');
        });
    });

    describe('sendBulkEmails', () => {
        beforeEach(async () => {
            config.email.smtp = { host: 'smtp.test.com', port: 587, user: 'u', pass: 'p' };
            await emailService.initialize();
        });

        it('should send emails to multiple recipients', async () => {
            const recipients = [
                { email: 'test1@example.com', data: { name: 'User1', type: 'default', message: 'Hi User1' } },
                { email: 'test2@example.com', data: { name: 'User2', type: 'default', message: 'Hi User2' } },
            ];
            mockTransporter.sendMail.resolves({ messageId: 'some-id' });

            const results = await emailService.sendBulkEmails(recipients, 'Bulk Test', 'default', { common: 'info' });

            expect(mockTransporter.sendMail.callCount).to.equal(2);
            expect(results.sent).to.equal(2);
            expect(results.failed).to.equal(0);
        });

        it('should handle partial failures in bulk sending', async () => {
            const recipients = [
                { email: 'success@example.com', data: { type: 'default', message: 'Success' } },
                { email: 'fail@example.com', data: { type: 'default', message: 'Fail' } },
            ];
            mockTransporter.sendMail
                .onFirstCall().resolves({ messageId: 'success-id' })
                .onSecondCall().rejects(new Error('SMTP send failed'));

            const results = await emailService.sendBulkEmails(recipients, 'Bulk Test', 'default');

            expect(results.sent).to.equal(1);
            expect(results.failed).to.equal(1);
            expect(results.errors[0].email).to.equal('fail@example.com');
            expect(results.errors[0].error).to.equal('SMTP send failed');
        });
    });
});