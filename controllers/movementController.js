const Student = require('../models/Student');
const AttendanceRecord = require('../models/AttendanceRecord');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getMovementTypeByTime, getCurrentISTDate, isLateReturn, getLateByMinutes } = require('../utils/timeHelpers');
const { checkAndMarkLate } = require('../services/lateDetectionService');

// @route GET /api/movement/lookup/:registerNumber
exports.lookupStudent = async (req, res, next) => {
  try {
    const student = await Student.findOne({ registerNumber: req.params.registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found. Check register number.', 404);
    return sendSuccess(res, {
      id: student._id,
      name: student.name,
      registerNumber: student.registerNumber,
      department: student.department,
      year: student.year,
      roomNumber: student.roomNumber,
      studentPhone: student.studentPhone,
      parentPhone: student.parentPhone,
      currentStatus: student.currentStatus,
    }, 'Student found');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/movement/out
exports.recordOut = async (req, res, next) => {
  try {
    const { registerNumber, movementType, reason, permissionUntil } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus !== 'Inside') {
      return sendError(res, `Student is already ${student.currentStatus}. Cannot record OUT.`, 400);
    }

    let detectedType = movementType || getMovementTypeByTime();
    if (!detectedType) {
      return sendError(res, 'Please select movement type (Regular Outing, Permission, or Native Leave).', 400);
    }

    const now = new Date();
    const record = await AttendanceRecord.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department,
      year: student.year,
      roomNumber: student.roomNumber,
      outTime: now,
      movementType: detectedType,
      reason: reason || '',
      permissionUntil: permissionUntil ? new Date(permissionUntil) : null,
      date: getCurrentISTDate(),
      status: 'Out',
    });

    student.currentStatus = detectedType === 'Permission' ? 'Permission' : detectedType === 'NativeLeave' ? 'NativeLeave' : 'Outside';
    await student.save();

    const alerts = [];
    if (detectedType === 'EveningOuting') alerts.push('Must return by 6:30 PM');
    if (detectedType === 'DinnerBreak') alerts.push('Must return by 9:00 PM');

    return sendSuccess(res, { record, action: 'OUT_RECORDED' }, `OUT entry recorded for ${student.name}`, 201, alerts);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/movement/in
exports.recordIn = async (req, res, next) => {
  try {
    const { registerNumber } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus === 'Inside') {
      return sendError(res, 'Student is already Inside. No OUT record found.', 400);
    }
    if (student.currentStatus === 'NativeLeave') {
      return sendError(res, 'Student is on Native Leave. Use leave return endpoint.', 400);
    }

    const record = await AttendanceRecord.findOne({
      registerNumber: student.registerNumber,
      status: 'Out',
    }).sort({ outTime: -1 });

    if (!record) return sendError(res, 'No active OUT record found.', 404);

    const now = new Date();
    record.inTime = now;
    record.durationMinutes = Math.floor((now - record.outTime) / 60000);

    const lateResult = await checkAndMarkLate(record);
    if (!lateResult.isLate) {
      record.status = 'Returned';
      await record.save();
    }

    student.currentStatus = 'Inside';
    await student.save();

    return sendSuccess(res, {
      action: 'IN_RECORDED',
      durationMinutes: record.durationMinutes,
      isLate: lateResult.isLate,
      lateByMinutes: lateResult.lateByMinutes,
      record,
    }, `IN entry recorded for ${student.name}. Duration: ${record.durationMinutes} mins.`, 200,
      lateResult.isLate ? [`Student is ${lateResult.lateByMinutes} minutes late!`] : []);
  } catch (error) {
    next(error);
  }
};

// @route GET /api/movement/history
exports.getMyHistory = async (req, res, next) => {
  try {
    const registerNumber = req.user.registerNumber;
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await AttendanceRecord.find({
      registerNumber,
      outTime: { $gte: since },
    }).sort({ outTime: -1 });

    return sendSuccess(res, { records, count: records.length }, 'History fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/movement/history/:registerNumber (warden)
exports.getStudentHistory = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await AttendanceRecord.find({
      registerNumber: req.params.registerNumber.toUpperCase(),
      outTime: { $gte: since },
    }).sort({ outTime: -1 });

    return sendSuccess(res, { records, count: records.length }, 'Student history fetched');
  } catch (error) {
    next(error);
  }
};
