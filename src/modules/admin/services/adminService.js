const User = require('../../auth/models/User');
const Report = require('../models/Report');
const { NotFoundError, BadRequestError, AuthorizationError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

class AdminService {
  /**
   * Get users list with filtering and pagination
   */
  async getUsers(options) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        role,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const query = {};

      // Build query filters
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.displayName': { $regex: search, $options: 'i' } }
        ];
      }

      if (status) {
        query.status = status;
      }

      if (role) {
        query.role = role;
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-hashedPassword -refreshTokens')
          .sort(sort)
          .limit(limit)
          .skip(skip),
        User.countDocuments(query)
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get users list', { error: error.message });
      throw error;
    }
  }

  /**
   * Get detailed user information (admin view)
   */
  async getUserDetails(userId) {
    try {
      const user = await User.findById(userId)
        .select('+refreshTokens')
        .populate('gameProfiles.gameId', 'name slug');

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Get user statistics
      const stats = await this.getUserStatistics(userId);

      return {
        user,
        stats
      };
    } catch (error) {
      logger.error('Failed to get user details', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update user status with audit logging
   */
  async updateUserStatus(adminId, userId, status, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const previousStatus = user.status;

      // Update user status
      user.status = status;

      // Add suspension details if applicable
      if (status === 'suspended') {
        user.suspensionDetails = {
          reason,
          startDate: new Date(),
          adminId
        };
      } else if (status === 'active') {
        user.suspensionDetails = undefined;
      }

      await user.save();

      // Log admin action
      await this.logAdminAction({
        adminId,
        targetUserId: userId,
        action: 'status_change',
        details: {
          previousStatus,
          newStatus: status,
          reason
        }
      });

      logger.info('User status updated by admin', {
        adminId,
        userId,
        previousStatus,
        newStatus: status
      });

      return user;
    } catch (error) {
      logger.error('Failed to update user status', {
        error: error.message,
        adminId,
        userId,
        status
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId) {
    try {
      // Get report statistics
      const [reportsSubmitted, reportsReceived] = await Promise.all([
        Report.countDocuments({ reporterId: userId }),
        Report.countDocuments({ reportedId: userId })
      ]);

      // TODO: Add more statistics as features are implemented
      // - Total matches played
      // - Average session duration
      // - Friend count
      // - etc.

      return {
        reportsSubmitted,
        reportsReceived,
        accountAge: await this.calculateAccountAge(userId)
      };
    } catch (error) {
      logger.error('Failed to get user statistics', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Calculate account age in days
   */
  async calculateAccountAge(userId) {
    const user = await User.findById(userId).select('createdAt');
    if (!user) {return 0;}

    const now = new Date();
    const created = new Date(user.createdAt);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Get reports list with filtering
   */
  async getReports(options) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        reportType,
        priority,
        assignedTo,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const query = {};

      // Build query filters
      if (status) {
        query.status = status;
      }

      if (reportType) {
        query.reportType = reportType;
      }

      if (priority) {
        query.priority = priority;
      }

      if (assignedTo) {
        query.assignedTo = assignedTo;
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const [reports, total] = await Promise.all([
        Report.find(query)
          .populate('reporterId', 'username email')
          .populate('reportedId', 'username email')
          .populate('assignedTo', 'username')
          .sort(sort)
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
      logger.error('Failed to get reports list', { error: error.message });
      throw error;
    }
  }

  /**
   * Get report details
   */
  async getReportDetails(reportId) {
    try {
      const report = await Report.findById(reportId)
        .populate('reporterId', 'username email profile')
        .populate('reportedId', 'username email profile status')
        .populate('assignedTo', 'username')
        .populate('resolution.resolvedBy', 'username')
        .populate('adminNotes.adminId', 'username');

      if (!report) {
        throw new NotFoundError('Report not found');
      }

      return report;
    } catch (error) {
      logger.error('Failed to get report details', { error: error.message, reportId });
      throw error;
    }
  }

  /**
   * Update report status
   */
  async updateReportStatus(adminId, reportId, updates) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }

      // Update fields
      if (updates.status) {
        report.status = updates.status;
      }

      if (updates.priority) {
        report.priority = updates.priority;
      }

      if (updates.assignedTo !== undefined) {
        report.assignedTo = updates.assignedTo;
      }

      if (updates.adminNote) {
        report.adminNotes.push({
          adminId,
          note: updates.adminNote
        });
      }

      // Handle resolution
      if (updates.resolution) {
        report.resolution = {
          action: updates.resolution.action,
          notes: updates.resolution.notes,
          resolvedBy: adminId,
          resolvedAt: new Date()
        };
        report.status = 'resolved';

        // Apply action if needed
        if (updates.resolution.action !== 'no_action') {
          await this.applyReportAction(
            adminId,
            report.reportedId,
            updates.resolution.action,
            updates.resolution.notes
          );
        }
      }

      await report.save();

      // Log admin action
      await this.logAdminAction({
        adminId,
        targetReportId: reportId,
        action: 'report_update',
        details: updates
      });

      return report;
    } catch (error) {
      logger.error('Failed to update report status', {
        error: error.message,
        adminId,
        reportId
      });
      throw error;
    }
  }

  /**
   * Apply action based on report resolution
   */
  async applyReportAction(adminId, userId, action, reason) {
    switch (action) {
      case 'warning':
        // TODO: Implement warning system
        logger.info('Warning issued to user', { userId, reason });
        break;

      case 'suspension':
        await this.updateUserStatus(adminId, userId, 'suspended', reason);
        break;

      case 'ban':
        await this.updateUserStatus(adminId, userId, 'banned', reason);
        break;

      default:
        logger.warn('Unknown report action', { action });
    }
  }

  /**
   * Log admin action for audit trail
   */
  async logAdminAction(actionData) {
    try {
      // TODO: Implement AdminAction model and logging
      // For now, just log to application logs
      logger.info('Admin action logged', actionData);
    } catch (error) {
      logger.error('Failed to log admin action', { error: error.message });
      // Don't throw - logging failure shouldn't break the operation
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getDashboardStats() {
    try {
      const [totalUsers, activeUsers, suspendedUsers, bannedUsers, openReports, reportsToday] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ status: 'active' }),
          User.countDocuments({ status: 'suspended' }),
          User.countDocuments({ status: 'banned' }),
          Report.countDocuments({ status: 'open' }),
          Report.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          })
        ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          banned: bannedUsers
        },
        reports: {
          open: openReports,
          today: reportsToday
        }
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AdminService();
