const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const Student = require('../models/Student');
const Warden = require('../models/Warden');
const AttendanceRecord = require('../models/AttendanceRecord');
const EmergencyPermission = require('../models/EmergencyPermission');
const NativeLeave = require('../models/NativeLeave');
const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

async function runBackup() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI env variable is missing.');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected. Exporting collections...');

    // Fetch all collection counts and data
    const [
      students,
      wardens,
      attendanceRecords,
      emergencyPermissions,
      nativeLeaves,
      permissions,
      auditLogs,
      notifications
    ] = await Promise.all([
      Student.find({}),
      Warden.find({}),
      AttendanceRecord.find({}),
      EmergencyPermission.find({}),
      NativeLeave.find({}),
      Permission.find({}),
      AuditLog.find({}),
      Notification.find({})
    ]);

    const backupPayload = {
      timestamp: new Date().toISOString(),
      database: mongoose.connection.name,
      counts: {
        students: students.length,
        wardens: wardens.length,
        attendanceRecords: attendanceRecords.length,
        emergencyPermissions: emergencyPermissions.length,
        nativeLeaves: nativeLeaves.length,
        permissions: permissions.length,
        auditLogs: auditLogs.length,
        notifications: notifications.length
      },
      collections: {
        students,
        wardens,
        attendanceRecords,
        emergencyPermissions,
        nativeLeaves,
        permissions,
        auditLogs,
        notifications
      }
    };

    // Ensure backups directory exists
    const backupsDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Generate filename using date-time string
    const now = new Date();
    const formattedDate = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const filename = `hostelflow_backup_${formattedDate}.json`;
    const destPath = path.join(backupsDir, filename);

    fs.writeFileSync(destPath, JSON.stringify(backupPayload, null, 2), 'utf-8');

    console.log(`\n🎉 Backup completed successfully!`);
    console.log(`📂 Location: ${destPath}`);
    console.log(`📊 Backup Summary:`);
    Object.entries(backupPayload.counts).forEach(([collection, count]) => {
      console.log(`   - ${collection}: ${count} records`);
    });

  } catch (error) {
    console.error('❌ Backup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

// Enable running directly
if (require.main === module) {
  runBackup();
}

module.exports = runBackup;
