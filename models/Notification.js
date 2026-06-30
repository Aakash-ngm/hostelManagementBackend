const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
    wardenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warden',
      default: null,
    },
    type: {
      type: String,
      enum: [
        'LateReturn', 'PermissionExpiry', 'NotReturned', 'NativeLeave', 'General',
        'LateComer', 'StudentNotReturned', 'PermissionExpired', 'ReturnedEarly', 'NewNativeLeaveRequest',
        'NewStaffPermissionRequest', 'StaffPermissionApproved', 'StaffPermissionRejected'
      ],
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
      enum: ['info', 'warning', 'danger', 'success'],
      default: 'info',
    },
    status: {
      type: String,
      enum: ['unread', 'read'],
      default: 'unread',
    },
    readAt: {
      type: Date,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.isRead = this.status === 'read';
  } else if (this.isModified('isRead')) {
    this.status = this.isRead ? 'read' : 'unread';
  }
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
