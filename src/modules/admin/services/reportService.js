// src/modules/admin/services/reportService.js
const Report = require('../models/Report');
const User = require('../../auth/models/User');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class ReportService {
  /**
   * Submit a new report
   */
  async submitReport(reporterId, reportData) {
    try {
      const { reportedId, reportType, reason, description, evidence } = reportData;

      // Check if reporter exists
      const reporter = await User.findById(reporterId);
      if (!reporter) {
        throw new NotFoundError('Reporter not found');
      }

      // Check if reported user exists
      const reportedUser = await User.findById(reportedId);
      if (!reportedUser) {
        throw new NotFoundError('Reported user not found');
      }

      // Prevent self-reporting
      if (reporterId === reportedId) {
        throw new BadRequestError('Cannot report yourself');
      }

      // Check for duplicate reports in last 24 hours
      const existingReport = await Report.findOne({
        reporterId,
        reportedId,
        status: { $in: ['open', 'under_review'] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (existingReport) {
        throw new ConflictError('You have already reported this user recently');
      }

      // Determine priority based on reason
      const priority = this.determinePriority(reason);

      // Create report
      const report = new Report({
        reporterId,
        reportedId,
        reportType,
        reason,
        description,
        evidence,
        priority
      });

      await report.save();

      logger.info('Report submitted', {
        reportId: report._id,
        reporterId,
        reportedId,
        reason
      });

      return report;
    } catch (error) {
      logger.error('Failed to submit report', {
        error: error.message,
        reporterId,
        reportedId: reportData.reportedId
      });
      throw error;
    }
  }

  /**
   * Get user's submitted reports
   */
  async getUserReports(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status } = options;
      const skip = (page - 1) * limit;

      const query = { reporterId: userId };
      if (status) {
        query.status = status;
      }

      const [reports, total] = await Promise.all([
        Report.find(query)
          .populate('reportedId', 'username profile.displayName')
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip),
        Report.countDocuments(query)
      ]);

      return {
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user reports', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Determine report priority based on reason
   */
  determinePriority(reason) {
    const criticalReasons = ['threats', 'hate_speech', 'cheating'];
    const highReasons = ['harassment', 'impersonation'];

    if (criticalReasons.includes(reason)) {
      return 'critical';
    } else if (highReasons.includes(reason)) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  /**
   * Get report by ID (for users to view their own reports)
   */
  async getReportById(reportId, userId) {
    try {
      const report = await Report.findById(reportId).populate(
        'reportedId',
        'username profile.displayName'
      );

      if (!report) {
        throw new NotFoundError('Report not found');
      }

      // Users can only view their own reports
      if (report.reporterId.toString() !== userId) {
        throw new NotFoundError('Report not found');
      }

      return report;
    } catch (error) {
      logger.error('Failed to get report', { error: error.message, reportId, userId });
      throw error;
    }
  }
}

module.exports = new ReportService();
