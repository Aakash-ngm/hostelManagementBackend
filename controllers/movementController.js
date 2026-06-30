const Student = require('../models/Student');
const AttendanceRecord = require('../models/AttendanceRecord');
const Notification = require('../models/Notification');
const NativeLeave = require('../models/NativeLeave');
const Permission = require('../models/Permission');
const EmergencyPermission = require('../models/EmergencyPermission');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getMovementTypeByTime, getCurrentISTDate, isLateReturn, getLateByMinutes } = require('../utils/timeHelpers');
const { checkAndMarkLate } = require('../services/lateDetectionService');
const { formatDateDDMMMYYYY } = require('../utils/timeFormatters');

// @route GET /api/movement/lookup/:registerNumber
exports.lookupStudent = async (req, res, next) => {
  try {
    const student = await Student.findOne({ registerNumber: req.params.registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found. Check register number.', 404);

    const activeLeave = await NativeLeave.findOne({
      registerNumber: student.registerNumber,
      status: { $in: ['Pending', 'Approved', 'Active'] }
    }).sort({ createdAt: -1 });

    const activeStaffPermission = await Permission.findOne({
      registerNumber: student.registerNumber,
      staffName: { $ne: '' },
      status: { $in: ['Pending', 'Approved', 'Active'] }
    }).sort({ createdAt: -1 });

    const activeEmergency = await EmergencyPermission.findOne({
      registerNumber: student.registerNumber,
      wardenDecision: 'Approved',
      outTime: null
    }).sort({ createdAt: -1 });

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
      activeLeave: activeLeave ? {
        id: activeLeave._id,
        status: activeLeave.status,
        fromDate: activeLeave.fromDate,
        toDate: activeLeave.toDate,
        reason: activeLeave.reason,
        wardenName: activeLeave.wardenName,
      } : null,
      activeStaffPermission: activeStaffPermission ? {
        id: activeStaffPermission._id,
        status: activeStaffPermission.status,
        permissionStartTime: activeStaffPermission.permissionStartTime,
        permissionEndTime: activeStaffPermission.permissionEndTime,
        reason: activeStaffPermission.reason,
        staffName: activeStaffPermission.staffName,
      } : null,
      activeEmergency: activeEmergency ? {
        id: activeEmergency._id,
        wardenName: activeEmergency.wardenName,
        reason: activeEmergency.reason,
        wardenDecision: activeEmergency.wardenDecision,
      } : null
    }, 'Student found');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/movement/out
exports.recordOut = async (req, res, next) => {
  try {
    const { registerNumber } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() });
    if (!student) return sendError(res, 'Student not found.', 404);
    if (student.currentStatus !== 'Inside') {
      return sendError(res, `Student is already ${student.currentStatus}. Cannot record OUT.`, 400);
    }

    // 1. Check for approved Emergency Permission
    const activeEmergency = await EmergencyPermission.findOne({
      registerNumber: student.registerNumber,
      wardenDecision: 'Approved',
      outTime: null
    }).sort({ createdAt: -1 });

    // 2. Check for approved Native Leave
    const activeLeave = await NativeLeave.findOne({
      registerNumber: student.registerNumber,
      status: 'Approved'
    }).sort({ createdAt: -1 });

    // 3. Check for approved Staff Permission
    const activeStaffPermission = await Permission.findOne({
      registerNumber: student.registerNumber,
      status: 'Approved',
      staffName: { $ne: '' }
    }).sort({ createdAt: -1 });

    let detectedType = null;
    let reasonText = '';
    let untilTime = null;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    if (activeEmergency) {
      detectedType = 'EmergencyPermission';
      reasonText = activeEmergency.reason;
      activeEmergency.outTime = now;
      await activeEmergency.save();
    } else if (activeLeave) {
      detectedType = 'NativeLeave';
      reasonText = activeLeave.reason;
      untilTime = new Date(activeLeave.toDate);
      activeLeave.status = 'Active';
      await activeLeave.save();
    } else if (activeStaffPermission) {
      detectedType = 'StaffPermission';
      reasonText = activeStaffPermission.reason;
      untilTime = new Date(activeStaffPermission.permissionEndTime);
      activeStaffPermission.status = 'Active';
      activeStaffPermission.startTime = now;
      await activeStaffPermission.save();
    } else {
      // Check scheduled outing times
      const eveningStart = 16 * 60 + 30; // 4:30 PM
      const eveningEnd = 18 * 60 + 30;   // 6:30 PM
      const dinnerStart = 20 * 60;       // 8:00 PM
      const dinnerEnd = 21 * 60;         // 9:00 PM

      if (totalMinutes >= eveningStart && totalMinutes <= eveningEnd) {
        detectedType = 'EveningOuting';
        reasonText = 'Regular evening outing';
        const expectedReturn = new Date();
        expectedReturn.setHours(18, 30, 0, 0);
        untilTime = expectedReturn;
      } else if (totalMinutes >= dinnerStart && totalMinutes <= dinnerEnd) {
        detectedType = 'DinnerBreak';
        reasonText = 'Regular dinner break';
        const expectedReturn = new Date();
        expectedReturn.setHours(21, 0, 0, 0);
        untilTime = expectedReturn;
      }
    }

    if (!detectedType) {
      return sendError(res, 'No active approved leaves, permissions, or scheduled outing times found.', 400);
    }

    const record = await AttendanceRecord.create({
      studentId: student._id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      department: student.department,
      year: student.year,
      roomNumber: student.roomNumber,
      outTime: now,
      movementType: detectedType,
      reason: reasonText,
      permissionUntil: untilTime,
      date: getCurrentISTDate(),
      status: 'Out',
    });

    student.currentStatus = (detectedType === 'Permission' || detectedType === 'StaffPermission') ? 'Permission' : detectedType === 'NativeLeave' ? 'NativeLeave' : 'Outside';
    await student.save();

    const alerts = [];
    if (detectedType === 'EveningOuting') alerts.push('Must return by 6:30 PM');
    if (detectedType === 'DinnerBreak') alerts.push('Must return by 9:00 PM');

    return sendSuccess(res, { record, action: 'OUT_RECORDED' }, `OUT entry recorded automatically for ${student.name} (${detectedType})`, 201, alerts);
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

    const now = new Date();

    // Handle Native Leave returns directly
    if (student.currentStatus === 'NativeLeave') {
      const leave = await NativeLeave.findOne({
        registerNumber: student.registerNumber,
        status: 'Active'
      }).sort({ createdAt: -1 });

      if (leave) {
        const plannedReturn = new Date(leave.toDate);

        // Normalize dates for day-based comparison (midnight boundaries)
        const plannedReturnDateOnly = new Date(plannedReturn.getFullYear(), plannedReturn.getMonth(), plannedReturn.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const isEarly = nowDateOnly < plannedReturnDateOnly;
        const isLate = nowDateOnly > plannedReturnDateOnly;

        // Always allow return — early, on-time, or late
        leave.status = isEarly ? 'Returned Early' : 'Returned';
        leave.returnedEarly = isEarly;
        leave.plannedReturnDate = plannedReturn;
        leave.actualReturnDate = now;
        await leave.save();

        // Find or create matching AttendanceRecord
        let record = await AttendanceRecord.findOne({
          registerNumber: student.registerNumber,
          movementType: 'NativeLeave',
          status: 'Out'
        }).sort({ outTime: -1 });

        if (!record) {
          record = new AttendanceRecord({
            studentId: student._id,
            registerNumber: student.registerNumber,
            studentName: student.name,
            department: student.department,
            year: student.year,
            roomNumber: student.roomNumber,
            outTime: leave.fromDate,
            movementType: 'NativeLeave',
            reason: leave.reason,
            date: getCurrentISTDate()
          });
        }

        record.inTime = now;
        record.durationMinutes = Math.floor((now - record.outTime) / 60000);
        record.returnedEarly = isEarly;
        record.plannedReturnDate = plannedReturn;
        record.actualReturnDate = now;

        let alerts = [];

        if (isEarly) {
          record.status = 'Returned Early';
          const expectedStr = formatDateDDMMMYYYY(plannedReturn);
          const actualStr = formatDateDDMMMYYYY(now);
          await Notification.create({
            studentId: student._id,
            registerNumber: student.registerNumber,
            studentName: student.name,
            type: 'ReturnedEarly',
            message: `🟢 Returned Early\n\nStudent:\n${student.name} (${student.registerNumber})\n\nNative Leave End:\n${expectedStr}\n\nActual Return:\n${actualStr}`,
            status: 'unread',
            severity: 'info'
          });
          alerts.push('Student returned early from Native Leave');
        } else if (isLate) {
          // lateByMinutes as whole days converted to minutes
          const lateDays = Math.floor((nowDateOnly - plannedReturnDateOnly) / (1000 * 60 * 60 * 24));
          const lateMinutes = lateDays * 24 * 60;
          record.isLate = true;
          record.lateByMinutes = lateMinutes;
          record.status = 'LateReturn';

          const expectedStr = formatDateDDMMMYYYY(plannedReturn);
          const actualStr = formatDateDDMMMYYYY(now);
          await Notification.create({
            studentId: student._id,
            registerNumber: student.registerNumber,
            studentName: student.name,
            type: 'LateComer',
            message: `🔴 Late Comer\n\nStudent:\n${student.name} (${student.registerNumber})\n\nExpected Return:\n${expectedStr}\n\nActual Return:\n${actualStr}\n\nLate By:\n${lateDays} day(s)`,
            status: 'unread',
            severity: 'danger'
          });
          alerts.push(`Student is ${lateDays} day(s) late from Native Leave!`);
        } else {
          record.status = 'Returned';
        }

        await record.save();
        student.currentStatus = 'Inside';
        await student.save();

        return sendSuccess(res, {
          action: 'IN_RECORDED',
          durationMinutes: record.durationMinutes,
          isLate,
          lateByMinutes: record.lateByMinutes || 0,
          returnedEarly: isEarly,
          record
        }, `IN entry recorded for ${student.name}. Native Leave return processed.`, 200, alerts);
      }

      // Fallback: No active leave found but student is still marked NativeLeave
      // Allow IN anyway and reset status (prevents orphan NativeLeave state)
      const fallbackRecord = await AttendanceRecord.findOne({
        registerNumber: student.registerNumber,
        movementType: 'NativeLeave',
        status: 'Out'
      }).sort({ outTime: -1 });

      if (fallbackRecord) {
        fallbackRecord.inTime = now;
        fallbackRecord.durationMinutes = Math.floor((now - fallbackRecord.outTime) / 60000);
        fallbackRecord.status = 'Returned';
        fallbackRecord.actualReturnDate = now;
        await fallbackRecord.save();
      }

      student.currentStatus = 'Inside';
      await student.save();

      return sendSuccess(res, {
        action: 'IN_RECORDED',
        durationMinutes: fallbackRecord?.durationMinutes || 0,
        isLate: false,
        lateByMinutes: 0,
        returnedEarly: false,
        record: fallbackRecord
      }, `IN entry recorded for ${student.name}. Native Leave return processed.`, 200, []);
    }

    const record = await AttendanceRecord.findOne({
      registerNumber: student.registerNumber,
      status: 'Out',
    }).sort({ outTime: -1 });

    if (!record) return sendError(res, 'No active OUT record found.', 404);

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

// @route GET /api/movement/student/stats
exports.getStudentDashboardStats = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user._id);
    if (!student) return sendError(res, 'Student not found', 404);

    const registerNumber = student.registerNumber;

    // Total OUT and IN entries
    const totalOut = await AttendanceRecord.countDocuments({ registerNumber, outTime: { $ne: null } });
    const totalIn = await AttendanceRecord.countDocuments({ registerNumber, inTime: { $ne: null } });

    // Staff Permissions
    const staffPermissionsCount = await Permission.countDocuments({ registerNumber, staffName: { $ne: '' } });

    // Native Leaves
    const nativeLeavesCount = await NativeLeave.countDocuments({ registerNumber });

    // Emergency Permissions
    const emergencyPermissionsCount = await EmergencyPermission.countDocuments({ registerNumber });

    // Late Returns
    const lateReturnsCount = await AttendanceRecord.countDocuments({ registerNumber, isLate: true });

    // Recent activity (latest 10 attendance records)
    const recentActivity = await AttendanceRecord.find({ registerNumber })
      .sort({ outTime: -1 })
      .limit(10);

    // Calendar activities mapping
    const allRecords = await AttendanceRecord.find({ registerNumber });

    const calendarData = allRecords.map(r => {
      const dateStr = new Date(r.outTime).toLocaleDateString('en-CA');
      let type = 'attendance';
      if (r.movementType === 'NativeLeave') type = 'leave';
      else if (r.movementType === 'StaffPermission') type = 'permission';
      else if (r.movementType === 'EmergencyPermission') type = 'emergency';
      
      if (r.isLate) type = 'late';

      return {
        date: dateStr,
        type,
        details: `${r.movementType} Out: ${new Date(r.outTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${r.inTime ? `, In: ${new Date(r.inTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' (Still Out)'}`
      };
    });

    return sendSuccess(res, {
      stats: {
        totalOut,
        totalIn,
        staffPermissions: staffPermissionsCount,
        nativeLeaves: nativeLeavesCount,
        emergencyPermissions: emergencyPermissionsCount,
        lateReturns: lateReturnsCount,
        currentStatus: student.currentStatus
      },
      recentActivity,
      calendarData
    }, 'Student dashboard stats fetched successfully');
  } catch (error) {
    next(error);
  }
};
