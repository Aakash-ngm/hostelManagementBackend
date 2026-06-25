/**
 * =====================================================
 *  HostelFlow — MongoDB Atlas Connection & DB Test
 * =====================================================
 *  Run this file with:  node utils/testDB.js
 *
 *  What it tests:
 *    ✅ 1. MongoDB Atlas connection
 *    ✅ 2. Student CRUD (Create, Read, Update, Delete)
 *    ✅ 3. Warden CRUD
 *    ✅ 4. Permission document creation
 *    ✅ 5. NativeLeave document creation
 *    ✅ 6. Notification document creation
 *    ✅ 7. AuditLog document creation
 *    ✅ 8. AttendanceRecord document creation
 *    ✅ 9. Cleanup of all test data
 * =====================================================
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ─── Models ──────────────────────────────────────────
const Student          = require('../models/Student');
const Warden           = require('../models/Warden');
const Permission       = require('../models/Permission');
const NativeLeave      = require('../models/NativeLeave');
const Notification     = require('../models/Notification');
const AuditLog         = require('../models/AuditLog');
const AttendanceRecord = require('../models/AttendanceRecord');

// ─── Helpers ─────────────────────────────────────────
const PASS  = '✅ PASS';
const FAIL  = '❌ FAIL';
const INFO  = '📋 INFO';
const LINE  = '─'.repeat(55);

let passed = 0;
let failed = 0;

function log(icon, label, detail = '') {
  console.log(`${icon}  ${label}${detail ? '  →  ' + detail : ''}`);
}

function assert(condition, label, detail = '') {
  if (condition) {
    log(PASS, label, detail);
    passed++;
  } else {
    log(FAIL, label, detail);
    failed++;
  }
}

// ─── Test IDs (used for cleanup) ─────────────────────
let studentId, wardenId, permissionId, leaveId,
    notifId, auditId, attendanceId;

// =====================================================
//  TEST 1: MongoDB Atlas Connection
// =====================================================
async function testConnection() {
  console.log(`\n${LINE}`);
  console.log('  TEST 1 — MongoDB Atlas Connection');
  console.log(LINE);

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    const host = conn.connection.host;
    const dbName = conn.connection.name;

    assert(mongoose.connection.readyState === 1, 'Connection established', host);
    assert(dbName === 'hostelflow', 'Database name is correct', dbName);
    log(INFO, 'Mongoose version', mongoose.version);
  } catch (err) {
    log(FAIL, 'Connection failed', err.message);
    failed++;
    process.exit(1);
  }
}

// =====================================================
//  TEST 2: Student CRUD
// =====================================================
async function testStudentCRUD() {
  console.log(`\n${LINE}`);
  console.log('  TEST 2 — Student CRUD');
  console.log(LINE);

  // CREATE
  const testStudent = new Student({
    name:           'Test Student',
    registerNumber: 'TEST001',
    email:          'test.student@hostelflow.test',
    password:       'testpass123',
    department:     'Computer Science',
    year:           '1st Year',
    roomNumber:     'T01',
    studentPhone:   '9876543210',
    parentPhone:    '9876543211',
  });

  await testStudent.save();
  studentId = testStudent._id;
  assert(!!studentId, 'Student created', `ID: ${studentId}`);

  // READ
  const found = await Student.findById(studentId);
  assert(found?.registerNumber === 'TEST001', 'Student read', found?.registerNumber);
  assert(found?.role === 'student', 'Student default role', found?.role);
  assert(found?.currentStatus === 'Inside', 'Student default status', found?.currentStatus);

  // UPDATE
  await Student.findByIdAndUpdate(studentId, { currentStatus: 'Outside' });
  const updated = await Student.findById(studentId);
  assert(updated?.currentStatus === 'Outside', 'Student updated (status)', updated?.currentStatus);

  // PASSWORD HASHING
  const withPw = await Student.findById(studentId).select('+password');
  assert(withPw?.password !== 'testpass123', 'Password is hashed in DB');
}

// =====================================================
//  TEST 3: Warden CRUD
// =====================================================
async function testWardenCRUD() {
  console.log(`\n${LINE}`);
  console.log('  TEST 3 — Warden CRUD');
  console.log(LINE);

  // CREATE
  const testWarden = new Warden({
    name:     'Test Warden',
    email:    'test.warden@hostelflow.test',
    password: 'wardenpass123',
  });

  await testWarden.save();
  wardenId = testWarden._id;
  assert(!!wardenId, 'Warden created', `ID: ${wardenId}`);

  // READ
  const found = await Warden.findById(wardenId);
  assert(found?.role === 'warden', 'Warden default role', found?.role);
  assert(found?.isActive === true, 'Warden isActive default', String(found?.isActive));

  // UPDATE
  await Warden.findByIdAndUpdate(wardenId, { isActive: false });
  const updated = await Warden.findById(wardenId);
  assert(updated?.isActive === false, 'Warden updated (isActive)', String(updated?.isActive));
}

// =====================================================
//  TEST 4: Permission Document
// =====================================================
async function testPermission() {
  console.log(`\n${LINE}`);
  console.log('  TEST 4 — Permission Document');
  console.log(LINE);

  try {
    const perm = new Permission({
      studentId:       studentId,
      registerNumber:  'TEST001',
      studentName:     'Test Student',
      reason:          'Medical appointment',
      permissionUntil: new Date(Date.now() + 3 * 60 * 60 * 1000), // +3hrs
      startTime:       new Date(),
    });
    await perm.save();
    permissionId = perm._id;
    assert(!!permissionId, 'Permission created', `ID: ${permissionId}`);

    const found = await Permission.findById(permissionId).populate('studentId', 'name');
    assert(found?.reason === 'Medical appointment', 'Permission reason saved', found?.reason);
    log(INFO, 'Populated student name', found?.studentId?.name || 'N/A');
  } catch (err) {
    log(FAIL, 'Permission test failed', err.message);
    failed++;
  }
}

// =====================================================
//  TEST 5: NativeLeave Document
// =====================================================
async function testNativeLeave() {
  console.log(`\n${LINE}`);
  console.log('  TEST 5 — NativeLeave Document');
  console.log(LINE);

  try {
    const leave = new NativeLeave({
      studentId:      studentId,
      registerNumber: 'TEST001',
      studentName:    'Test Student',
      department:     'Computer Science',
      year:           '1st Year',
      roomNumber:     'T01',
      reason:         'Family function',
      fromDate:       new Date(),
      toDate:         new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2 days
    });
    await leave.save();
    leaveId = leave._id;
    assert(!!leaveId, 'NativeLeave created', `ID: ${leaveId}`);

    const found = await NativeLeave.findById(leaveId);
    assert(found?.reason === 'Family function', 'NativeLeave reason saved', found?.reason);
  } catch (err) {
    log(FAIL, 'NativeLeave test failed', err.message);
    failed++;
  }
}

// =====================================================
//  TEST 6: Notification Document
// =====================================================
async function testNotification() {
  console.log(`\n${LINE}`);
  console.log('  TEST 6 — Notification Document');
  console.log(LINE);

  try {
    const notif = new Notification({
      type:           'General',
      registerNumber: 'TEST001',
      studentName:    'Test Student',
      message:        'Your permission request has been approved.',
      severity:       'info',
    });
    await notif.save();
    notifId = notif._id;
    assert(!!notifId, 'Notification created', `ID: ${notifId}`);

    const found = await Notification.findById(notifId);
    assert(found?.message?.includes('approved'), 'Notification message saved');
  } catch (err) {
    log(FAIL, 'Notification test failed', err.message);
    failed++;
  }
}

// =====================================================
//  TEST 7: AuditLog Document
// =====================================================
async function testAuditLog() {
  console.log(`\n${LINE}`);
  console.log('  TEST 7 — AuditLog Document');
  console.log(LINE);

  try {
    const audit = new AuditLog({
      action:               'PERMISSION_APPROVED',
      performedBy:          'Test Warden',
      role:                 'warden',
      targetRegisterNumber: 'TEST001',
    });
    await audit.save();
    auditId = audit._id;
    assert(!!auditId, 'AuditLog created', `ID: ${auditId}`);

    const found = await AuditLog.findById(auditId);
    assert(found?.action === 'PERMISSION_APPROVED', 'AuditLog action saved', found?.action);
  } catch (err) {
    log(FAIL, 'AuditLog test failed', err.message);
    failed++;
  }
}

// =====================================================
//  TEST 8: AttendanceRecord Document
// =====================================================
async function testAttendanceRecord() {
  console.log(`\n${LINE}`);
  console.log('  TEST 8 — AttendanceRecord Document');
  console.log(LINE);

  try {
    const record = new AttendanceRecord({
      studentId:      studentId,
      registerNumber: 'TEST001',
      studentName:    'Test Student',
      department:     'Computer Science',
      year:           '1st Year',
      roomNumber:     'T01',
      outTime:        new Date(),
      movementType:   'Permission',
      status:         'Out',
      date:           new Date().toISOString().split('T')[0], // YYYY-MM-DD
    });
    await record.save();
    attendanceId = record._id;
    assert(!!attendanceId, 'AttendanceRecord created', `ID: ${attendanceId}`);

    const found = await AttendanceRecord.findById(attendanceId).populate('studentId', 'name registerNumber');
    assert(found?.status === 'Out', 'AttendanceRecord status saved', found?.status);
    log(INFO, 'Populated register no.', found?.studentId?.registerNumber || 'N/A');
  } catch (err) {
    log(FAIL, 'AttendanceRecord test failed', err.message);
    failed++;
  }
}

// =====================================================
//  CLEANUP — Delete all test documents
// =====================================================
async function cleanup() {
  console.log(`\n${LINE}`);
  console.log('  CLEANUP — Deleting test documents');
  console.log(LINE);

  const deletes = [
    studentId      && Student.findByIdAndDelete(studentId),
    wardenId       && Warden.findByIdAndDelete(wardenId),
    permissionId   && Permission.findByIdAndDelete(permissionId),
    leaveId        && NativeLeave.findByIdAndDelete(leaveId),
    notifId        && Notification.findByIdAndDelete(notifId),
    auditId        && AuditLog.findByIdAndDelete(auditId),
    attendanceId   && AttendanceRecord.findByIdAndDelete(attendanceId),
  ].filter(Boolean);

  await Promise.all(deletes);
  log(PASS, 'All test documents removed from Atlas');
}

// =====================================================
//  SUMMARY
// =====================================================
function printSummary() {
  const total = passed + failed;
  console.log(`\n${'═'.repeat(55)}`);
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(55));
  console.log(`  Total   : ${total}`);
  console.log(`  ✅ Passed : ${passed}`);
  console.log(`  ❌ Failed : ${failed}`);
  console.log('═'.repeat(55));

  if (failed === 0) {
    console.log('\n  🎉 All tests passed! MongoDB Atlas is working perfectly.\n');
  } else {
    console.log('\n  ⚠️  Some tests failed. Check the errors above.\n');
  }
}

// =====================================================
//  MAIN — Run all tests
// =====================================================
(async () => {
  console.log('\n🚀 HostelFlow — MongoDB Atlas Test Suite');
  console.log(`🕒 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

  try {
    await testConnection();
    await testStudentCRUD();
    await testWardenCRUD();
    await testPermission();
    await testNativeLeave();
    await testNotification();
    await testAuditLog();
    await testAttendanceRecord();
    await cleanup();
  } catch (err) {
    console.error('\n💥 Unexpected error during tests:', err.message);
    failed++;
  } finally {
    printSummary();
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed.\n');
    process.exit(failed > 0 ? 1 : 0);
  }
})();
