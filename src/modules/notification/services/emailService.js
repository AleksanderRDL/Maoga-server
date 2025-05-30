const nodemailer = require('nodemailer');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
    this.initialized = false;
  }

  /**
   * Initialize email transporter
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Create transporter based on config
      if (config.email.smtp) {
        this.transporter = nodemailer.createTransport({
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure,
          auth: {
            user: config.email.smtp.user,
            pass: config.email.smtp.pass
          }
        });

        // Verify connection
        await this.transporter.verify();
        logger.info('Email transporter initialized');
      } else {
        logger.warn('Email SMTP not configured');
      }

      // Load email templates
      await this.loadTemplates();

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error.message
      });
    }
  }

  /**
   * Load email templates
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates');
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = path.basename(file, '.hbs');
          const templateContent = await fs.readFile(path.join(templatesDir, file), 'utf8');
          this.templates.set(templateName, handlebars.compile(templateContent));
        }
      }

      logger.info('Email templates loaded', {
        count: this.templates.size
      });
    } catch (error) {
      logger.error('Failed to load email templates', {
        error: error.message
      });
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(options) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    try {
      const { to, subject, data } = options;

      // Get appropriate template based on notification type
      const templateName = this.getTemplateName(data.type);
      const template = this.templates.get(templateName) || this.templates.get('default');

      if (!template) {
        throw new Error('Email template not found');
      }

      // Generate HTML content
      const html = template({
        ...data,
        appName: config.app.name,
        appUrl: config.app.url,
        year: new Date().getFullYear()
      });

      // Send email
      const info = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html,
        text: this.htmlToText(html) // Simple text version
      });

      logger.info('Notification email sent', {
        to,
        subject,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error('Failed to send notification email', {
        error: error.message,
        to: options.to
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get template name based on notification type
   */
  getTemplateName(notificationType) {
    const templateMap = {
      friend_request: 'friend-request',
      friend_accepted: 'friend-accepted',
      match_found: 'match-found',
      lobby_invite: 'lobby-invite',
      system_announcement: 'system-announcement',
      achievement_earned: 'achievement'
    };

    return templateMap[notificationType] || 'default';
  }

  /**
   * Convert HTML to plain text
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(recipients, subject, templateName, commonData = {}) {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Process in batches to avoid overwhelming the SMTP server
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const promises = batch.map(async (recipient) => {
        try {
          await this.sendNotificationEmail({
            to: recipient.email,
            subject,
            data: {
              ...commonData,
              ...recipient.data,
              type: templateName
            }
          });
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            email: recipient.email,
            error: error.message
          });
        }
      });

      await Promise.allSettled(promises);

      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info('Bulk emails processed', {
      total: recipients.length,
      sent: results.sent,
      failed: results.failed
    });

    return results;
  }
}

module.exports = new EmailService();
