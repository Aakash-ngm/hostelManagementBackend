const Student = require('../models/Student');
const NativeLeave = require('../models/NativeLeave');
const AttendanceRecord = require('../models/AttendanceRecord');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getCurrentISTDate } = require('../utils/timeHelpers');
const { formatDateDDMMMYYYY } = require('../utils/timeFormatters');

// @route POST /api/leave/apply
exports.applyNativeLeave = async (req, res, next) => {
  try {
    const { registerNumber, fromDate, toDate, reason, wardenId } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus === 'NativeLeave') {
      return sendError(res, 'Student is already on Native Leave.', 400);
    }

    // Check if there is already a Pending or Approved leave request
    const existingRequest = await NativeLeave.findOne({
      registerNumber: student.registerNumber,
      status: { $in: ['Pending', 'Approved'] }
    });
    if (existingRequest) {
      return sendError(res, `You already have a ${existingRequest.status.toLowerCase()} native leave request.`, 400);
    }

    const Warden = require('../models/Warden');
    const warden = await Warden.findById(wardenId);
    if (!warden) return sendError(res, 'Selected warden not found.', 404);

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
      wardenId: warden._id,
      wardenName: warden.name,
      status: 'Pending',
    });

    // Create notification
    const fromStr = formatDateDDMMMYYYY(new Date(fromDate));
    const toStr = formatDateDDMMMYYYY(new Date(toDate));
    await Notification.create({
      studentId: student._id,
      wardenId: warden._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      type: 'NewNativeLeaveRequest',
      message: `🟣 New Native Leave Request (Warden: ${warden.name})\n\nStudent:\n${student.name}\n\nFrom:\n${fromStr}\n\nTo:\n${toStr}`,
      status: 'unread',
      severity: 'info'
    });

    return sendSuccess(res, { leave, action: 'LEAVE_APPLIED' },
      `Native leave requested successfully for ${student.name} from ${fromStr} to ${toStr}. Waiting for Warden approval.`, 201);
  } catch (error) {
    next(error);
  }
};

// @route GET /api/leave/pending
exports.getPendingLeaves = async (req, res, next) => {
  try {
    const leaves = await NativeLeave.find({ 
      status: 'Pending',
      wardenId: req.user._id
    }).sort({ createdAt: -1 });
    return sendSuccess(res, { leaves, count: leaves.length }, 'Pending leaves fetched');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/leave/approve/:id
exports.approveNativeLeave = async (req, res, next) => {
  try {
    const leave = await NativeLeave.findById(req.params.id);
    if (!leave) return sendError(res, 'Leave request not found.', 404);
    if (leave.status !== 'Pending') {
      return sendError(res, `Leave request is already ${leave.status}.`, 400);
    }

    leave.status = 'Approved';
    leave.approvedBy = req.user.name; // warden name
    await leave.save();

    // Create notification for student
    await Notification.create({
      studentId: leave.studentId,
      registerNumber: leave.registerNumber,
      studentName: leave.studentName,
      type: 'General',
      message: `🟢 Native Leave Approved\n\nYour native leave request from ${formatDateDDMMMYYYY(leave.fromDate)} to ${formatDateDDMMMYYYY(leave.toDate)} has been approved by Warden ${req.user.name}.`,
      status: 'unread',
      severity: 'info'
    });

    return sendSuccess(res, { leave, action: 'LEAVE_APPROVED' }, `Leave request for ${leave.studentName} has been approved.`);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/leave/reject/:id
exports.rejectNativeLeave = async (req, res, next) => {
  try {
    const leave = await NativeLeave.findById(req.params.id);
    if (!leave) return sendError(res, 'Leave request not found.', 404);
    if (leave.status !== 'Pending') {
      return sendError(res, `Leave request is already ${leave.status}.`, 400);
    }

    leave.status = 'Rejected';
    leave.approvedBy = req.user.name; // warden name
    await leave.save();

    // Create notification for student
    await Notification.create({
      studentId: leave.studentId,
      registerNumber: leave.registerNumber,
      studentName: leave.studentName,
      type: 'General',
      message: `🔴 Native Leave Rejected\n\nYour native leave request from ${formatDateDDMMMYYYY(leave.fromDate)} to ${formatDateDDMMMYYYY(leave.toDate)} has been rejected by Warden ${req.user.name}.`,
      status: 'unread',
      severity: 'danger'
    });

    return sendSuccess(res, { leave, action: 'LEAVE_REJECTED' }, `Leave request for ${leave.studentName} has been rejected.`);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/leave/out
exports.recordLeaveOut = async (req, res, next) => {
  try {
    const { registerNumber } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus !== 'Inside') {
      return sendError(res, `Student is already ${student.currentStatus}. Cannot record OUT.`, 400);
    }

    // Find the Approved Native Leave request
    const leave = await NativeLeave.findOne({
      registerNumber: student.registerNumber,
      status: 'Approved'
    }).sort({ createdAt: -1 });

    if (!leave) {
      return sendError(res, 'No approved Native Leave request found. Please request approval from your warden first.', 400);
    }

    // Activate the leave request
    leave.status = 'Active';
    await leave.save();

    // Create corresponding AttendanceRecord OUT entry
    const record = await AttendanceRecord.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department,
      year: student.year,
      roomNumber: student.roomNumber,
      outTime: new Date(), // Actual exit time
      movementType: 'NativeLeave',
      reason: leave.reason,
      plannedReturnDate: leave.toDate,
      date: getCurrentISTDate(),
      status: 'Out',
    });

    student.currentStatus = 'NativeLeave';
    await student.save();

    // Create notification
    await Notification.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      type: 'NativeLeave',
      message: `🏠 Student Left for Native Leave\n\nStudent:\n${student.name}\n\nApproved by:\n${leave.approvedBy}`,
      status: 'unread',
      severity: 'info'
    });

    return sendSuccess(res, { leave, record, action: 'LEAVE_OUT_RECORDED' },
      `${student.name} has recorded OUT entry for Native Leave.`, 200);
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

// @route GET /api/leave/student/my-leaves
exports.getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await NativeLeave.find({ registerNumber: req.user.registerNumber }).sort({ createdAt: -1 });
    return sendSuccess(res, { leaves, count: leaves.length }, 'Student leaves fetched successfully');
  } catch (error) {
    next(error);
  }
};
