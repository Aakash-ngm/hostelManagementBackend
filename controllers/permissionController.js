const Student = require('../models/Student');
const Permission = require('../models/Permission');
const AttendanceRecord = require('../models/AttendanceRecord');
const { sendSuccess, sendError } = require('../utils/responseHelper');
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
