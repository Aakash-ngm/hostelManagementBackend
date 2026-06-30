const AttendanceRecord = require('../models/AttendanceRecord');
const Permission = require('../models/Permission');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const { formatTimeAMPM, formatDateDDMMMYYYY } = require('../utils/timeFormatters');

const runDynamicChecks = async () => {
  try {
    const now = new Date();

    // 1. Check for expired permissions (Permission Expired Alert)
    const expiredPermissions = await Permission.find({
      status: 'Active',
      permissionUntil: { $lt: now }
    });

    for (const perm of expiredPermissions) {
      perm.status = 'Expired';
      await perm.save();

      // Check if student is still outside/on permission
      const student = await Student.findOne({ registerNumber: perm.registerNumber });
      if (student && (student.currentStatus === 'Permission' || student.currentStatus === 'Outside')) {
        // Create Notification if it doesn't exist
        const exists = await Notification.findOne({
          type: 'PermissionExpired',
          registerNumber: perm.registerNumber,
          createdAt: { $gte: perm.startTime }
        });

        if (!exists) {
          const expectedStr = formatTimeAMPM(perm.permissionUntil);
          await Notification.create({
            studentId: student._id,
            registerNumber: perm.registerNumber,
            studentName: perm.studentName,
            type: 'PermissionExpired',
            message: `🔵 Permission Expired\n\nStudent:\n${perm.studentName} (${perm.registerNumber})\n\nPermission End:\n${expectedStr}\n\nStudent has not returned.`,
            status: 'unread',
            severity: 'danger'
          });
        }
      }
    }

    // 2. Check for outings where return is overdue (Student Not Returned Alert)
    const overdueOutings = await AttendanceRecord.find({
      status: 'Out',
      movementType: { $in: ['EveningOuting', 'DinnerBreak', 'DinnerOuting'] }
    });

    for (const record of overdueOutings) {
      const outDate = new Date(record.outTime);
      const curfewTime = new Date(outDate);

      if (record.movementType === 'EveningOuting') {
        curfewTime.setHours(18, 30, 0, 0); // 6:30 PM
      } else {
        curfewTime.setHours(21, 0, 0, 0); // 9:00 PM
      }

      if (now > curfewTime) {
        // Overdue! Create StudentNotReturned notification if it doesn't exist for this specific outing
        const exists = await Notification.findOne({
          type: 'StudentNotReturned',
          registerNumber: record.registerNumber,
          createdAt: { $gte: record.outTime }
        });

        if (!exists) {
          const outTimeStr = formatTimeAMPM(record.outTime);
          const student = await Student.findOne({ registerNumber: record.registerNumber });
          await Notification.create({
            studentId: student ? student._id : null,
            registerNumber: record.registerNumber,
            studentName: record.studentName,
            type: 'StudentNotReturned',
            message: `🟡 Student Not Returned\n\nStudent:\n${record.studentName} (${record.registerNumber})\n\nOUT Time:\n${outTimeStr}\n\nStatus:\nStill Outside`,
            status: 'unread',
            severity: 'warning'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error running dynamic checks:', error);
  }
};

module.exports = { runDynamicChecks };
