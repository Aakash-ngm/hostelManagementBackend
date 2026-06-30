const mongoose = require('mongoose');

const emergencyPermissionSchema = new mongoose.Schema(
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
    department: { type: String, required: true },
    year: { type: String, required: true },
    roomNumber: { type: String },
    date: { type: String, required: true }, // e.g. 'YYYY-MM-DD'
    time: { type: String, required: true }, // e.g. 'HH:MM'
    reason: { type: String, required: true },
    wardenName: { type: String, required: true },
    wardenDecision: {
      type: String,
      enum: ['Approved', 'Rejected'],
      required: true,
    },
    outTime: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyPermission', emergencyPermissionSchema);
