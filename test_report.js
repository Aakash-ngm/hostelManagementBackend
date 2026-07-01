require('dotenv').config();
const mongoose = require('mongoose');

const Student = require('./models/Student');
const Permission = require('./models/Permission');
const NativeLeave = require('./models/NativeLeave');
const EmergencyPermission = require('./models/EmergencyPermission');
const AttendanceRecord = require('./models/AttendanceRecord');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Testing daily report logic...');

    const date = '2026-07-02';
    const targetDayStart = new Date(date);
    targetDayStart.setHours(0, 0, 0, 0);
    const targetDayEnd = new Date(date);
    targetDayEnd.setHours(23, 59, 59, 999);

    const leavesOnDay = await NativeLeave.find({
      status: { $in: ['Approved', 'Active'] },
      fromDate: { $lte: targetDayEnd },
      toDate: { $gte: targetDayStart }
    });
    console.log(`Found ${leavesOnDay.length} leaves.`);
    const excludedLeaveStudentIds = leavesOnDay.map(l => l.studentId ? l.studentId.toString() : '');

    const permissionsOnDay = await Permission.find({
      status: { $in: ['Approved', 'Active'] },
      permissionStartTime: { $gte: targetDayStart, $lte: targetDayEnd }
    });
    console.log(`Found ${permissionsOnDay.length} permissions.`);

    const breakfastStart = 7 * 60;
    const breakfastEnd = 8 * 60 + 30;
    const lunchStart = 12 * 60 + 30;
    const lunchEnd = 14 * 60;
    const dinnerStart = 20 * 60;
    const dinnerEnd = 21 * 60;

    const breakfastExcludedPermissions = [];
    const lunchExcludedPermissions = [];
    const dinnerExcludedPermissions = [];

    permissionsOnDay.forEach(p => {
      const startObj = new Date(p.permissionStartTime);
      const endObj = new Date(p.permissionEndTime);
      const startMin = startObj.getHours() * 60 + startObj.getMinutes();
      const endMin = endObj.getHours() * 60 + endObj.getMinutes();

      if (startMin <= breakfastEnd && endMin >= breakfastStart) {
        breakfastExcludedPermissions.push(p.studentId ? p.studentId.toString() : '');
      }
      if (startMin <= lunchEnd && endMin >= lunchStart) {
        lunchExcludedPermissions.push(p.studentId ? p.studentId.toString() : '');
      }
      if (startMin <= dinnerEnd && endMin >= dinnerStart) {
        dinnerExcludedPermissions.push(p.studentId ? p.studentId.toString() : '');
      }
    });

    const emergenciesOnDay = await EmergencyPermission.find({
      wardenDecision: 'Approved',
      outTime: { $gte: targetDayStart, $lte: targetDayEnd }
    });
    console.log(`Found ${emergenciesOnDay.length} emergencies.`);
    const emergencyExcludedStudentIds = emergenciesOnDay.map(e => e.studentId ? e.studentId.toString() : '');

    const allStudents = await Student.find({ isActive: true }).sort({ name: 1 });
    console.log(`Found ${allStudents.length} active students in DB.`);

    const records = allStudents.map(student => {
      const idStr = student._id.toString();
      const isOnLeave = excludedLeaveStudentIds.includes(idStr);
      const isEmergencyOut = emergencyExcludedStudentIds.includes(idStr);

      const isBreakfastEx = isOnLeave || isEmergencyOut || breakfastExcludedPermissions.includes(idStr);
      const isLunchEx = isOnLeave || isEmergencyOut || lunchExcludedPermissions.includes(idStr);
      const isDinnerEx = isOnLeave || isEmergencyOut || dinnerExcludedPermissions.includes(idStr);

      return {
        _id: student._id,
        registerNumber: student.registerNumber,
        studentName: student.name,
        roomNumber: student.roomNumber,
        status: student.currentStatus,
        breakfast: isBreakfastEx ? 'Excluded' : 'Included',
        lunch: isLunchEx ? 'Excluded' : 'Included',
        dinner: isDinnerEx ? 'Excluded' : 'Included'
      };
    });

    console.log(`Generated records length: ${records.length}`);
    console.log('Sample record:', records[0]);

  } catch (err) {
    console.error('❌ Error caught:', err);
  } finally {
    mongoose.disconnect();
  }
}

run();
