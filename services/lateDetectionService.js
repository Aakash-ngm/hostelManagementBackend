const AttendanceRecord = require('../models/AttendanceRecord');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const { isLateReturn, getLateByMinutes } = require('../utils/timeHelpers');
const { formatTimeAMPM } = require('../utils/timeFormatters');

const checkAndMarkLate = async (record) => {
  const late = isLateReturn(record.inTime, record.movementType, record.permissionUntil);
  const lateMinutes = getLateByMinutes(record.inTime, record.movementType, record.permissionUntil);

  if (late) {
    record.isLate = true;
    record.lateByMinutes = lateMinutes;
    record.status = 'LateReturn';
    await record.save();

    // Determine expected return time string
    let expectedTime = '';
    if (record.movementType === 'EveningOuting') {
      expectedTime = '06:30 PM';
    } else if (record.movementType === 'DinnerBreak' || record.movementType === 'DinnerOuting') {
      expectedTime = '09:00 PM';
    } else if (record.permissionUntil) {
      expectedTime = formatTimeAMPM(record.permissionUntil);
    }

    const actualTime = formatTimeAMPM(record.inTime);

    // Create Late Comer notification
    await Notification.create({
      studentId: record.studentId,
      registerNumber: record.registerNumber,
      studentName: record.studentName,
      type: 'LateComer',
      message: `🔴 Late Comer\n\nStudent:\n${record.studentName} (${record.registerNumber})\n\nExpected Return:\n${expectedTime}\n\nActual Return:\n${actualTime}\n\nLate By:\n${lateMinutes} Minutes`,
      status: 'unread',
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
