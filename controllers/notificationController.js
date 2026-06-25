const Notification = require('../models/Notification');
const { sendSuccess } = require('../utils/responseHelper');

// @route GET /api/notification
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;
    const notifications = await Notification.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const unreadCount = await Notification.countDocuments({ isRead: false });
    return sendSuccess(res, { notifications, unreadCount, page }, 'Notifications fetched');
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/notification/:id/read
exports.markRead = async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    return sendSuccess(res, {}, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/notification/mark-all-read
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });
    return sendSuccess(res, {}, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/notification/clear
exports.clearAll = async (req, res, next) => {
  try {
    await Notification.deleteMany({ isRead: true });
    return sendSuccess(res, {}, 'Read notifications cleared');
  } catch (error) {
    next(error);
  }
};
