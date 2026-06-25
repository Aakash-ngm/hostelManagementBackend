const AttendanceRecord = require('../models/AttendanceRecord');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const { isLateReturn, getLateByMinutes } = require('../utils/timeHelpers');

const checkAndMarkLate = async (record) => {
  const late = isLateReturn(record.inTime, record.movementType, record.permissionUntil);
  const lateMinutes = getLateByMinutes(record.inTime, record.movementType, record.permissionUntil);

  if (late) {
    record.isLate = true;
    record.lateByMinutes = lateMinutes;
    record.status = 'LateReturn';
    await record.save();

    // Create notification
    await Notification.create({
      type: 'LateReturn',
      registerNumber: record.registerNumber,
      studentName: record.studentName,
      message: `${record.studentName} (${record.registerNumber}) returned ${lateMinutes} minutes late.`,
      severity: lateMinutes > 30 ? 'danger' : 'warning',
    });
  }

  return { isLate: late, lateByMinutes: lateMinutes };
};

const checkPermissionExpiries = async () => {
  const Permission = require('../models/Permission');
  const now = new Date();

  const expiredPermissions = await Permission.find({
    status: 'Active',
    permissionUntil: { $lt: now },
  });

  for (const perm of expiredPermissions) {
    perm.status = 'Expired';
    await perm.save();

    // Check if student is still outside
    const student = await Student.findOne({ registerNumber: perm.registerNumber });
    if (student && student.currentStatus === 'Permission') {
      await Notification.create({
        type: 'PermissionExpiry',
        registerNumber: perm.registerNumber,
        studentName: perm.studentName,
        message: `Permission expired for ${perm.studentName} (${perm.registerNumber}). Student has not returned.`,
        severity: 'danger',
      });
    }
  }
};

module.exports = { checkAndMarkLate, checkPermissionExpiries };
