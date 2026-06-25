const mongoose = require('mongoose');

const nativeLeaveSchema = new mongoose.Schema(
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
    department: { type: String },
    year: { type: String },
    roomNumber: { type: String },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Returned', 'Cancelled'],
      default: 'Active',
    },
    approvedBy: {
      type: String,
      default: 'System',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NativeLeave', nativeLeaveSchema);
