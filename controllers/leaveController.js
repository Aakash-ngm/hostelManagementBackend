const Student = require('../models/Student');
const NativeLeave = require('../models/NativeLeave');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @route POST /api/leave/apply
exports.applyNativeLeave = async (req, res, next) => {
  try {
    const { registerNumber, fromDate, toDate, reason } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus === 'NativeLeave') {
      return sendError(res, 'Student is already on Native Leave.', 400);
    }

    const leave = await NativeLeave.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department,
      year: student.year,
      roomNumber: student.roomNumber,
      reason,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
    });

    student.currentStatus = 'NativeLeave';
    await student.save();

    return sendSuccess(res, { leave, action: 'LEAVE_APPLIED' },
      `Native leave recorded for ${student.name} from ${fromDate} to ${toDate}`, 201);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/leave/return
exports.returnFromLeave = async (req, res, next) => {
  try {
    const { registerNumber } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus !== 'NativeLeave') {
      return sendError(res, 'Student is not on Native Leave.', 400);
    }

    const leave = await NativeLeave.findOne({
      registerNumber: student.registerNumber,
      status: 'Active',
    }).sort({ createdAt: -1 });

    if (leave) {
      leave.status = 'Returned';
      await leave.save();
    }

    student.currentStatus = 'Inside';
    await student.save();

    return sendSuccess(res, { action: 'LEAVE_RETURNED' }, `${student.name} has returned from native leave`);
  } catch (error) {
    next(error);
  }
};

// @route GET /api/leave/active
exports.getActiveLeaves = async (req, res, next) => {
  try {
    const leaves = await NativeLeave.find({ status: 'Active' }).sort({ toDate: 1 });
    return sendSuccess(res, { leaves, count: leaves.length }, 'Active leaves fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/leave/all
exports.getAllLeaves = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const leaves = await NativeLeave.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await NativeLeave.countDocuments();
    return sendSuccess(res, { leaves, total, page, totalPages: Math.ceil(total / limit) }, 'Leaves fetched');
  } catch (error) {
    next(error);
  }
};
