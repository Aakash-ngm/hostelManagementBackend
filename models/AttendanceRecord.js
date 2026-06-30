const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
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
    studentName: { type: String, required: true },
    department: { type: String },
    year: { type: String },
    roomNumber: { type: String },
    outTime: {
      type: Date,
      required: true,
    },
    inTime: {
      type: Date,
      default: null,
    },
    movementType: {
      type: String,
      enum: ['RegularOuting', 'Permission', 'NativeLeave', 'DinnerBreak', 'EveningOuting', 'StaffPermission'],
      required: true,
    },
    reason: {
      type: String,
      default: '',
    },
    permissionUntil: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    lateByMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Out', 'Returned', 'LateReturn', 'Pending', 'Returned Early'],
      default: 'Out',
    },
    date: {
      type: String, // YYYY-MM-DD for easy daily queries
      index: true,
    },
    // Staff Permission fields
    staffName: {
      type: String,
      default: '',
    },
    permissionStartTime: {
      type: Date,
      default: null,
    },
    permissionEndTime: {
      type: Date,
      default: null,
    },
    // Early Return fields
    returnedEarly: {
      type: Boolean,
      default: false,
    },
    plannedReturnDate: {
      type: Date,
      default: null,
    },
    actualReturnDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
