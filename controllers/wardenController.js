const Student = require('../models/Student');
const AttendanceRecord = require('../models/AttendanceRecord');
const Permission = require('../models/Permission');
const NativeLeave = require('../models/NativeLeave');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getCurrentISTDate } = require('../utils/timeHelpers');

// @route GET /api/warden/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = getCurrentISTDate();
    const [totalStudents, inside, outside, permission, nativeLeave, lateToday, todayOut, todayIn, unreadNotifications] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Student.countDocuments({ currentStatus: 'Inside', isActive: true }),
      Student.countDocuments({ currentStatus: 'Outside', isActive: true }),
      Student.countDocuments({ currentStatus: 'Permission', isActive: true }),
      Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true }),
      AttendanceRecord.countDocuments({ date: today, isLate: true }),
      AttendanceRecord.countDocuments({ date: today }),
      AttendanceRecord.countDocuments({ date: today, inTime: { $ne: null } }),
      Notification.countDocuments({ isRead: false }),
    ]);
    return sendSuccess(res, {
      totalStudents, inside, outside, permission, nativeLeave,
      lateToday, todayOut, todayIn, unreadNotifications,
      action: 'DASHBOARD_STATS',
    }, 'Dashboard stats fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/warden/students
exports.getAllStudents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;
    const query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { registerNumber: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { roomNumber: { $regex: search, $options: 'i' } },
      ];
    }
    const students = await Student.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
    const total = await Student.countDocuments(query);
    return sendSuccess(res, { students, total, page, totalPages: Math.ceil(total / limit) }, 'Students fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/warden/students/:id
exports.getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return sendError(res, 'Student not found.', 404);
    return sendSuccess(res, { student }, 'Student fetched');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/warden/students
exports.addStudent = async (req, res, next) => {
  try {
    const { name, registerNumber, email, password, department, year, roomNumber, studentPhone, parentPhone } = req.body;
    const existing = await Student.findOne({ $or: [{ email }, { registerNumber: registerNumber.toUpperCase() }] });
    if (existing) return sendError(res, 'Student with this email or register number already exists.', 400);
    const student = await Student.create({ name, registerNumber, email, password: password || 'Student@123', department, year, roomNumber, studentPhone, parentPhone });
    return sendSuccess(res, { student, action: 'STUDENT_ADDED' }, 'Student added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/warden/students/:id
exports.updateStudent = async (req, res, next) => {
  try {
    const { password, ...updateData } = req.body;
    const student = await Student.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!student) return sendError(res, 'Student not found.', 404);
    return sendSuccess(res, { student, action: 'STUDENT_UPDATED' }, 'Student updated successfully');
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/warden/students/:id
exports.deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!student) return sendError(res, 'Student not found.', 404);
    return sendSuccess(res, { action: 'STUDENT_DELETED' }, 'Student deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/warden/live-status
exports.getLiveStatus = async (req, res, next) => {
  try {
    const students = await Student.find({ isActive: true }).select(
      'name registerNumber department year roomNumber currentStatus studentPhone'
    ).sort({ currentStatus: 1 });
    return sendSuccess(res, { students, count: students.length }, 'Live status fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/warden/late-today
exports.getLateStudents = async (req, res, next) => {
  try {
    const today = getCurrentISTDate();
    const records = await AttendanceRecord.find({ date: today, isLate: true }).sort({ lateByMinutes: -1 });
    return sendSuccess(res, { records, count: records.length }, 'Late students fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/warden/currently-outside
exports.getCurrentlyOutside = async (req, res, next) => {
  try {
    const records = await AttendanceRecord.find({ status: 'Out' })
      .sort({ outTime: 1 })
      .select('registerNumber studentName department year roomNumber outTime movementType permissionUntil');
    return sendSuccess(res, { records, count: records.length }, 'Currently outside students fetched');
  } catch (error) {
    next(error);
  }
};
