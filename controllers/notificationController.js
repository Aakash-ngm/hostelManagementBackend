const Notification = require('../models/Notification');
const { sendSuccess } = require('../utils/responseHelper');
const { runDynamicChecks } = require('../services/notificationGeneratorService');

// @route GET /api/notification
exports.getNotifications = async (req, res, next) => {
  try {
    // Run dynamic checks to update notifications on request
    await runDynamicChecks();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const filter = req.query.filter || 'all'; // 'today' | 'week' | 'month' | 'all'
    const skip = (page - 1) * limit;

    let query = {
      $or: [
        { wardenId: null },
        { wardenId: { $exists: false } },
        { wardenId: req.user._id }
      ]
    };
    const now = new Date();

    if (filter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: todayStart };
    } else if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      query.createdAt = { $gte: oneWeekAgo };
    } else if (filter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      query.createdAt = { $gte: oneMonthAgo };
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const unreadCount = await Notification.countDocuments({ ...query, status: 'unread' });
    return sendSuccess(res, { notifications, unreadCount, page }, 'Notifications fetched');
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/notification/:id/read
exports.markRead = async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      status: 'read',
      isRead: true,
      readAt: new Date()
    });
    return sendSuccess(res, {}, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/notification/mark-all-read
exports.markAllRead = async (req, res, next) => {
  try {
    const query = {
      status: 'unread',
      $or: [
        { wardenId: null },
        { wardenId: { $exists: false } },
        { wardenId: req.user._id }
      ]
    };
    await Notification.updateMany(query, {
      status: 'read',
      isRead: true,
      readAt: new Date()
    });
    return sendSuccess(res, {}, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/notification/clear
exports.clearAll = async (req, res, next) => {
  try {
    const query = {
      status: 'unread',
      $or: [
        { wardenId: null },
        { wardenId: { $exists: false } },
        { wardenId: req.user._id }
      ]
    };
    await Notification.updateMany(query, {
      status: 'read',
      isRead: true,
      readAt: new Date()
    });
    return sendSuccess(res, {}, 'Notifications cleared (marked as read)');
  } catch (error) {
    next(error);
  }
};
