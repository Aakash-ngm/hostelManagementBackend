const Student = require('../models/Student');
const AttendanceRecord = require('../models/AttendanceRecord');
const Permission = require('../models/Permission');
const NativeLeave = require('../models/NativeLeave');
const Notification = require('../models/Notification');
const EmergencyPermission = require('../models/EmergencyPermission');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getCurrentISTDate } = require('../utils/timeHelpers');

// Helper to calculate meal counts based on overlaps
const getMealCountsForDate = async (targetDate) => {
  const targetDayStart = new Date(targetDate);
  targetDayStart.setHours(0, 0, 0, 0);
  const targetDayEnd = new Date(targetDate);
  targetDayEnd.setHours(23, 59, 59, 999);

  // Excluded leaves: any student with an active/approved native leave on targetDate
  const leavesOnDay = await NativeLeave.find({
    status: { $in: ['Approved', 'Active'] },
    fromDate: { $lte: targetDayEnd },
    toDate: { $gte: targetDayStart }
  });
  const excludedLeaveStudentIds = leavesOnDay.map(l => l.studentId.toString());

  // Excluded permissions: approved staff permissions on targetDate overlapping meal times
  const permissionsOnDay = await Permission.find({
    status: { $in: ['Approved', 'Active'] },
    permissionStartTime: { $gte: targetDayStart, $lte: targetDayEnd }
  });

  const breakfastStart = 7 * 60;     // 07:00
  const breakfastEnd = 8 * 60 + 30;  // 08:30
  const lunchStart = 12 * 60 + 30;   // 12:30
  const lunchEnd = 14 * 60;          // 14:00
  const dinnerStart = 20 * 60;       // 20:00
  const dinnerEnd = 21 * 60;         // 21:00

  const breakfastExcludedPermissions = [];
  const lunchExcludedPermissions = [];
  const dinnerExcludedPermissions = [];

  permissionsOnDay.forEach(p => {
    const startObj = new Date(p.permissionStartTime);
    const endObj = new Date(p.permissionEndTime);
    const startMin = startObj.getHours() * 60 + startObj.getMinutes();
    const endMin = endObj.getHours() * 60 + endObj.getMinutes();

    if (startMin <= breakfastEnd && endMin >= breakfastStart) {
      breakfastExcludedPermissions.push(p.studentId.toString());
    }
    if (startMin <= lunchEnd && endMin >= lunchStart) {
      lunchExcludedPermissions.push(p.studentId.toString());
    }
    if (startMin <= dinnerEnd && endMin >= dinnerStart) {
      dinnerExcludedPermissions.push(p.studentId.toString());
    }
  });

  // Excluded emergencies: active emergency permissions on targetDate
  const emergenciesOnDay = await EmergencyPermission.find({
    wardenDecision: 'Approved',
    outTime: { $gte: targetDayStart, $lte: targetDayEnd }
  });
  const emergencyExcludedStudentIds = emergenciesOnDay.map(e => e.studentId ? e.studentId.toString() : '');

  const allStudents = await Student.find({ isActive: true });

  let breakfastCount = 0;
  let lunchCount = 0;
  let dinnerCount = 0;

  allStudents.forEach(student => {
    const idStr = student._id.toString();
    if (excludedLeaveStudentIds.includes(idStr)) return;
    if (emergencyExcludedStudentIds.includes(idStr)) return;

    if (!breakfastExcludedPermissions.includes(idStr)) breakfastCount++;
    if (!lunchExcludedPermissions.includes(idStr)) lunchCount++;
    if (!dinnerExcludedPermissions.includes(idStr)) dinnerCount++;
  });

  return { breakfastCount, lunchCount, dinnerCount };
};

// @route GET /api/warden/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = getCurrentISTDate();

    // Get start of week (last 7 days)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Get start of month (last 30 days)
    const startOfMonth = new Date();
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    const [
      totalStudents, inside, outside, permission, nativeLeave,
      lateToday, lateThisWeek, lateThisMonth,
      todayOut, todayIn, unreadNotifications, notReturned,
      emergencyPermission
    ] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Student.countDocuments({ currentStatus: 'Inside', isActive: true }),
      Student.countDocuments({ currentStatus: 'Outside', isActive: true }),
      Student.countDocuments({ currentStatus: 'Permission', isActive: true }),
      Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true }),
      AttendanceRecord.countDocuments({ date: today, isLate: true }),
      AttendanceRecord.countDocuments({ date: { $gte: startOfWeekStr }, isLate: true }),
      AttendanceRecord.countDocuments({ date: { $gte: startOfMonthStr }, isLate: true }),
      AttendanceRecord.countDocuments({ date: today }),
      AttendanceRecord.countDocuments({ date: today, inTime: { $ne: null } }),
      Notification.countDocuments({ status: 'unread' }),
      AttendanceRecord.countDocuments({ status: 'Out' }), // Students Not Returned
      EmergencyPermission.countDocuments({ wardenDecision: 'Approved', outTime: { $ne: null }, inTime: null })
    ]);

    const todayMealStats = await getMealCountsForDate(new Date());
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowMealStats = await getMealCountsForDate(tomorrowObj);

    return sendSuccess(res, {
      totalStudents,
      inside,
      outside,
      permission,
      nativeLeave,
      emergencyPermission,
      lateToday,
      lateThisWeek,
      lateThisMonth,
      todayOut,
      todayIn,
      unreadNotifications,
      notReturned,
      breakfastCount: todayMealStats.breakfastCount,
      lunchCount: todayMealStats.lunchCount,
      dinnerCount: todayMealStats.dinnerCount,
      tomorrowBreakfast: tomorrowMealStats.breakfastCount,
      tomorrowLunch: tomorrowMealStats.lunchCount,
      tomorrowDinner: tomorrowMealStats.dinnerCount,
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

    const currentStudent = await Student.findById(req.params.id);
    if (!currentStudent) return sendError(res, 'Student not found.', 404);

    // Validate Register Number uniqueness if changed
    if (updateData.registerNumber && updateData.registerNumber.toUpperCase() !== currentStudent.registerNumber) {
      const newReg = updateData.registerNumber.toUpperCase();
      const existing = await Student.findOne({ registerNumber: newReg, _id: { $ne: req.params.id } });
      if (existing) {
        return sendError(res, 'Student with this register number already exists.', 400);
      }
      updateData.registerNumber = newReg;
    }

    // Validate Email uniqueness if changed
    if (updateData.email && updateData.email.toLowerCase() !== currentStudent.email) {
      const newEmail = updateData.email.toLowerCase();
      const existingEmail = await Student.findOne({ email: newEmail, _id: { $ne: req.params.id } });
      if (existingEmail) {
        return sendError(res, 'Student with this email already exists.', 400);
      }
      updateData.email = newEmail;
    }

    // Update Student
    const student = await Student.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    // Propagate changes to other collections
    const attendanceUpdates = {};
    const permissionUpdates = {};
    const leaveUpdates = {};
    const notificationUpdates = {};

    if (updateData.registerNumber && updateData.registerNumber !== currentStudent.registerNumber) {
      attendanceUpdates.registerNumber = updateData.registerNumber;
      permissionUpdates.registerNumber = updateData.registerNumber;
      leaveUpdates.registerNumber = updateData.registerNumber;
      notificationUpdates.registerNumber = updateData.registerNumber;
    }

    if (updateData.name && updateData.name !== currentStudent.name) {
      attendanceUpdates.studentName = updateData.name;
      permissionUpdates.studentName = updateData.name;
      leaveUpdates.studentName = updateData.name;
      notificationUpdates.studentName = updateData.name;
    }

    if (updateData.department && updateData.department !== currentStudent.department) {
      attendanceUpdates.department = updateData.department;
      leaveUpdates.department = updateData.department;
    }

    if (updateData.year && updateData.year !== currentStudent.year) {
      attendanceUpdates.year = updateData.year;
      leaveUpdates.year = updateData.year;
    }

    if (updateData.roomNumber && updateData.roomNumber !== currentStudent.roomNumber) {
      attendanceUpdates.roomNumber = updateData.roomNumber;
      leaveUpdates.roomNumber = updateData.roomNumber;
    }

    // Perform updates if there is any changed field
    const updatePromises = [];
    if (Object.keys(attendanceUpdates).length > 0) {
      updatePromises.push(AttendanceRecord.updateMany({ studentId: student._id }, { $set: attendanceUpdates }));
    }
    if (Object.keys(permissionUpdates).length > 0) {
      updatePromises.push(Permission.updateMany({ studentId: student._id }, { $set: permissionUpdates }));
    }
    if (Object.keys(leaveUpdates).length > 0) {
      updatePromises.push(NativeLeave.updateMany({ studentId: student._id }, { $set: leaveUpdates }));
    }
    if (Object.keys(notificationUpdates).length > 0) {
      updatePromises.push(Notification.updateMany({ studentId: student._id }, { $set: notificationUpdates }));
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    return sendSuccess(res, { student, action: 'STUDENT_UPDATED' }, 'Student updated successfully and related records synchronized');
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
