const Student = require('../models/Student');
const Permission = require('../models/Permission');
const AttendanceRecord = require('../models/AttendanceRecord');
const EmergencyPermission = require('../models/EmergencyPermission');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const Warden = require('../models/Warden');
const Notification = require('../models/Notification');
const { getCurrentISTDate } = require('../utils/timeHelpers');

// @route POST /api/permission/grant
exports.grantPermission = async (req, res, next) => {
  try {
    const { registerNumber, permissionUntil, reason } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus !== 'Inside') {
      return sendError(res, 'Student is not Inside. Cannot grant permission.', 400);
    }

    const permissionDate = new Date(permissionUntil);
    const now = new Date();

    const record = await AttendanceRecord.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department,
      year: student.year,
      roomNumber: student.roomNumber,
      outTime: now,
      movementType: 'Permission',
      reason,
      permissionUntil: permissionDate,
      date: getCurrentISTDate(),
      status: 'Out',
    });

    const permission = await Permission.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      reason,
      permissionUntil: permissionDate,
      startTime: now,
      attendanceRecordId: record._id,
    });

    student.currentStatus = 'Permission';
    await student.save();

    return sendSuccess(res, { permission, record, action: 'PERMISSION_GRANTED' },
      `Permission granted for ${student.name} until ${permissionDate.toLocaleTimeString('en-IN')}`, 201);
  } catch (error) {
    next(error);
  }
};

// @route GET /api/permission/active
exports.getActivePermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.find({ status: 'Active' }).sort({ permissionUntil: 1 });
    return sendSuccess(res, { permissions, count: permissions.length }, 'Active permissions fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/permission/all
exports.getAllPermissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const permissions = await Permission.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Permission.countDocuments();
    return sendSuccess(res, { permissions, total, page, totalPages: Math.ceil(total / limit) }, 'Permissions fetched');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/permission/grant-staff
exports.grantStaffPermission = async (req, res, next) => {
  try {
    const { registerNumber, permissionDate, fromTime, toTime, staffName, reason } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus !== 'Inside') {
      return sendError(res, `Student is currently ${student.currentStatus}. Cannot grant permission.`, 400);
    }

    const parseTime = (dateStr, timeStr) => {
      let hours = 0;
      let minutes = 0;
      if (timeStr.toLowerCase().includes('pm') || timeStr.toLowerCase().includes('am')) {
        const [time, modifier] = timeStr.split(' ');
        let [h, m] = time.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
        if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
      } else {
        const [h, m] = timeStr.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
      }
      const d = new Date(dateStr);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const startTime = parseTime(permissionDate, fromTime);
    const permissionUntil = parseTime(permissionDate, toTime);

    if (permissionUntil <= startTime) {
      // If end time is before or equal to start time, it means the permission spans overnight (ends the next day)
      permissionUntil.setDate(permissionUntil.getDate() + 1);
    }

    const permission = await Permission.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      reason,
      permissionUntil,
      startTime,
      status: 'Pending',
      staffName,
      permissionStartTime: startTime,
      permissionEndTime: permissionUntil
    });

    // Notify selected staff/warden
    const warden = await Warden.findOne({ name: new RegExp('^' + staffName + '$', 'i') });
    await Notification.create({
      studentId: student._id,
      wardenId: warden ? warden._id : null,
      registerNumber: student.registerNumber,
      studentName: student.name,
      type: 'NewStaffPermissionRequest',
      message: `👤 New Staff Permission Request (Staff: ${staffName})\n\nStudent:\n${student.name}\n\nDate:\n${permissionDate}\n\nTime:\n${fromTime} - ${toTime}\n\nReason:\n${reason}`,
      status: 'unread',
      severity: 'info'
    });

    return sendSuccess(res, { permission, action: 'STAFF_PERMISSION_REQUESTED' },
      `Staff permission request submitted to ${staffName}`, 201);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/permission/emergency
exports.grantEmergencyPermission = async (req, res, next) => {
  try {
    const { registerNumber, reason, wardenName, wardenDecision } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);

    const now = new Date();
    // Format date as YYYY-MM-DD
    const dateStr = now.toLocaleDateString('en-CA');
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Create EmergencyPermission record
    const emPerm = await EmergencyPermission.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department || '',
      year: student.year || '',
      roomNumber: student.roomNumber || '',
      date: dateStr,
      time: timeStr,
      reason,
      wardenName,
      wardenDecision,
      outTime: wardenDecision === 'Approved' ? now : null,
    });

    if (wardenDecision === 'Approved') {
      // 1. Create AttendanceRecord for OUT entry
      const record = await AttendanceRecord.create({
        studentId: student._id,
        registerNumber: student.registerNumber,
        studentName: student.name,
        department: student.department || '',
        year: student.year || '',
        roomNumber: student.roomNumber || '',
        outTime: now,
        movementType: 'EmergencyPermission',
        reason,
        date: getCurrentISTDate(),
        status: 'Out',
        staffName: wardenName,
      });

      // 2. Set student currentStatus to 'Outside'
      student.currentStatus = 'Outside';
      await student.save();

      return sendSuccess(res, { emPerm, record }, 'Emergency OUT entry recorded successfully');
    }

    return sendSuccess(res, { emPerm }, 'Emergency request recorded (Warden Rejected)');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/permission/emergency/history
exports.getEmergencyHistory = async (req, res, next) => {
  try {
    const { filter } = req.query;
    let query = {};

    if (filter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: todayStart };
    } else if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      query.createdAt = { $gte: oneWeekAgo };
    } else if (filter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      query.createdAt = { $gte: oneMonthAgo };
    }

    const history = await EmergencyPermission.find(query).sort({ createdAt: -1 });
    return sendSuccess(res, { history }, 'Emergency history fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/permission/pending-staff
exports.getPendingPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.find({
      status: 'Pending',
      staffName: new RegExp('^' + req.user.name + '$', 'i')
    }).sort({ createdAt: -1 });

    return sendSuccess(res, { permissions, count: permissions.length }, 'Pending permissions fetched');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/permission/approve-staff/:id
exports.approveStaffPermission = async (req, res, next) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return sendError(res, 'Permission not found.', 404);
    permission.status = 'Approved';
    await permission.save();

    await Notification.create({
      studentId: permission.studentId,
      registerNumber: permission.registerNumber,
      studentName: permission.studentName,
      type: 'StaffPermissionApproved',
      message: `🟢 Staff Permission Approved (Staff: ${permission.staffName})\n\nStudent: ${permission.studentName}\nStatus: Approved`,
      status: 'unread',
      severity: 'success'
    });

    return sendSuccess(res, { permission }, 'Staff permission request approved successfully');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/permission/reject-staff/:id
exports.rejectStaffPermission = async (req, res, next) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return sendError(res, 'Permission not found.', 404);
    permission.status = 'Rejected';
    await permission.save();

    await Notification.create({
      studentId: permission.studentId,
      registerNumber: permission.registerNumber,
      studentName: permission.studentName,
      type: 'StaffPermissionRejected',
      message: `🔴 Staff Permission Rejected (Staff: ${permission.staffName})\n\nStudent: ${permission.studentName}\nStatus: Rejected`,
      status: 'unread',
      severity: 'error'
    });

    return sendSuccess(res, { permission }, 'Staff permission request rejected');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/permission/staff-out
exports.recordStaffPermissionOut = async (req, res, next) => {
  try {
    const { registerNumber } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);

    const permission = await Permission.findOne({
      registerNumber: student.registerNumber,
      status: 'Approved',
      staffName: { $ne: '' }
    }).sort({ createdAt: -1 });

    if (!permission) {
      return sendError(res, 'No approved staff permission found for this student.', 400);
    }

    // Create AttendanceRecord
    const record = await AttendanceRecord.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department || '',
      year: student.year || '',
      roomNumber: student.roomNumber || '',
      outTime: new Date(),
      movementType: 'StaffPermission',
      reason: permission.reason,
      permissionUntil: permission.permissionUntil,
      date: getCurrentISTDate(),
      status: 'Out',
      staffName: permission.staffName,
      permissionStartTime: permission.permissionStartTime,
      permissionEndTime: permission.permissionEndTime
    });

    // Update permission details
    permission.status = 'Active';
    permission.attendanceRecordId = record._id;
    permission.startTime = new Date();
    await permission.save();

    // Update student status
    student.currentStatus = 'Permission';
    await student.save();

    return sendSuccess(res, { permission, record, action: 'STAFF_PERMISSION_OUT_RECORDED' },
      `Staff permission OUT entry recorded successfully for ${student.name}`);
  } catch (error) {
    next(error);
  }
};

// @route GET /api/permission/student/my-permissions
exports.getMyPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.find({ registerNumber: req.user.registerNumber }).sort({ createdAt: -1 });
    return sendSuccess(res, { permissions, count: permissions.length }, 'Student permissions fetched successfully');
  } catch (error) {
    next(error);
  }
};
