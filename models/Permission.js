const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    registerNumber: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    studentName: { type: String },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
    },
    permissionUntil: {
      type: Date,
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Returned'],
      default: 'Active',
    },
    attendanceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Permission', permissionSchema);
