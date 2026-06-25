const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['student', 'warden', 'system'],
      default: 'system',
    },
    targetRegisterNumber: {
      type: String,
      uppercase: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
