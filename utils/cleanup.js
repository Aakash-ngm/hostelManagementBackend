require('dotenv').config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const Permission = require('../models/Permission');
const NativeLeave = require('../models/NativeLeave');
const Notification = require('../models/Notification');
const Student = require('../models/Student');

const cleanup = async () => {
  try {
    await connectDB();

    console.log('🧹 Starting cleanup of transaction records (attendance, permissions, leaves, notifications)...');

    // 1. Delete Attendance records
    const attendanceRes = await AttendanceRecord.deleteMany({});
    console.log(`❌ Deleted ${attendanceRes.deletedCount} AttendanceRecord entries.`);

    // 2. Delete Permission approvals
    const permissionRes = await Permission.deleteMany({});
    console.log(`❌ Deleted ${permissionRes.deletedCount} Permission entries.`);

    // 3. Delete Native Leave requests
    const leaveRes = await NativeLeave.deleteMany({});
    console.log(`❌ Deleted ${leaveRes.deletedCount} NativeLeave entries.`);

    // 4. Delete Notifications
    const notificationRes = await Notification.deleteMany({});
    console.log(`❌ Deleted ${notificationRes.deletedCount} Notification entries.`);

    // 5. Reset all student statuses to 'Inside'
    const studentRes = await Student.updateMany({}, { $set: { currentStatus: 'Inside' } });
    console.log(`✅ Reset status to 'Inside' for ${studentRes.modifiedCount} students.`);

    console.log('🎉 Cleanup successfully completed! Students and Wardens database profiles remain untouched.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
};

cleanup();
