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
      enum: ['Pending', 'Approved', 'Rejected', 'Active', 'Returned', 'Cancelled', 'Returned Early'],
      default: 'Pending',
    },
    approvedBy: {
      type: String,
      default: '',
    },
    wardenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warden',
      default: null,
    },
    wardenName: {
      type: String,
      default: '',
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

module.exports = mongoose.model('NativeLeave', nativeLeaveSchema);
