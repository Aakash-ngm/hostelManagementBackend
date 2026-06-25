const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['LateReturn', 'PermissionExpiry', 'NotReturned', 'NativeLeave', 'General'],
      required: true,
    },
    registerNumber: {
      type: String,
      uppercase: true,
    },
    studentName: { type: String },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'danger'],
      default: 'info',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
