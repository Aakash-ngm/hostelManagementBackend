const AttendanceRecord = require('../models/AttendanceRecord');
const Student = require('../models/Student');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getCurrentISTDate, formatDuration } = require('../utils/timeHelpers');
const ExcelJS = require('exceljs');
const Permission = require('../models/Permission');
const NativeLeave = require('../models/NativeLeave');
const EmergencyPermission = require('../models/EmergencyPermission');

const getMealCountsForDate = async (targetDate) => {
  const targetDayStart = new Date(targetDate);
  targetDayStart.setHours(0, 0, 0, 0);
  const targetDayEnd = new Date(targetDate);
  targetDayEnd.setHours(23, 59, 59, 999);

  const leavesOnDay = await NativeLeave.find({
    status: { $in: ['Approved', 'Active'] },
    fromDate: { $lte: targetDayEnd },
    toDate: { $gte: targetDayStart }
  });
  const excludedLeaveStudentIds = leavesOnDay.map(l => l.studentId.toString());

  const permissionsOnDay = await Permission.find({
    status: { $in: ['Approved', 'Active'] },
    permissionStartTime: { $gte: targetDayStart, $lte: targetDayEnd }
  });

  const breakfastStart = 7 * 60;
  const breakfastEnd = 8 * 60 + 30;
  const lunchStart = 12 * 60 + 30;
  const lunchEnd = 14 * 60;
  const dinnerStart = 20 * 60;
  const dinnerEnd = 21 * 60;

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

const getReportData = async (startDate, endDate) => {
  const records = await AttendanceRecord.find({
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: -1, outTime: -1 });
  return records;
};

// @route GET /api/report/daily?date=YYYY-MM-DD
exports.getDailyReport = async (req, res, next) => {
  try {
    const date = req.query.date || getCurrentISTDate();

    if (req.userRole === 'admin-mess') {
      const targetDayStart = new Date(date);
      targetDayStart.setHours(0, 0, 0, 0);
      const targetDayEnd = new Date(date);
      targetDayEnd.setHours(23, 59, 59, 999);

      // Excluded leaves: any student with an active/approved native leave on target date
      const leavesOnDay = await NativeLeave.find({
        status: { $in: ['Approved', 'Active'] },
        fromDate: { $lte: targetDayEnd },
        toDate: { $gte: targetDayStart }
      });
      const excludedLeaveStudentIds = leavesOnDay.map(l => l.studentId.toString());

      // Excluded permissions: approved staff permissions on target date overlapping meal times
      const permissionsOnDay = await Permission.find({
        status: { $in: ['Approved', 'Active'] },
        permissionStartTime: { $gte: targetDayStart, $lte: targetDayEnd }
      });

      const breakfastStart = 7 * 60;
      const breakfastEnd = 8 * 60 + 30;
      const lunchStart = 12 * 60 + 30;
      const lunchEnd = 14 * 60;
      const dinnerStart = 20 * 60;
      const dinnerEnd = 21 * 60;

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

      // Excluded emergencies: active emergency permissions on target date
      const emergenciesOnDay = await EmergencyPermission.find({
        wardenDecision: 'Approved',
        outTime: { $gte: targetDayStart, $lte: targetDayEnd }
      });
      const emergencyExcludedStudentIds = emergenciesOnDay.map(e => e.studentId ? e.studentId.toString() : '');

      const allStudents = await Student.find({ isActive: true }).sort({ name: 1 });

      const records = allStudents.map(student => {
        const idStr = student._id.toString();
        const isOnLeave = excludedLeaveStudentIds.includes(idStr);
        const isEmergencyOut = emergencyExcludedStudentIds.includes(idStr);

        const isBreakfastEx = isOnLeave || isEmergencyOut || breakfastExcludedPermissions.includes(idStr);
        const isLunchEx = isOnLeave || isEmergencyOut || lunchExcludedPermissions.includes(idStr);
        const isDinnerEx = isOnLeave || isEmergencyOut || dinnerExcludedPermissions.includes(idStr);

        return {
          _id: student._id,
          registerNumber: student.registerNumber,
          studentName: student.name,
          roomNumber: student.roomNumber,
          status: student.currentStatus,
          breakfast: isBreakfastEx ? 'Excluded' : 'Included',
          lunch: isLunchEx ? 'Excluded' : 'Included',
          dinner: isDinnerEx ? 'Excluded' : 'Included'
        };
      });

      const breakfastCount = records.filter(r => r.breakfast === 'Included').length;
      const lunchCount = records.filter(r => r.lunch === 'Included').length;
      const dinnerCount = records.filter(r => r.dinner === 'Included').length;
      const insideCount = allStudents.filter(s => s.currentStatus === 'Inside').length;
      const outsideCount = allStudents.filter(s => s.currentStatus === 'Outside').length;
      const leaveCount = allStudents.filter(s => s.currentStatus === 'NativeLeave').length;
      const permCount = allStudents.filter(s => s.currentStatus === 'Permission').length;

      const attendanceRecords = await AttendanceRecord.find({ date }).sort({ outTime: -1 });

      return sendSuccess(res, {
        records: attendanceRecords,
        mealAllocation: records,
        stats: {
          breakfastCount,
          lunchCount,
          dinnerCount,
          nativeLeaveCount: leaveCount,
          permissionCount: permCount,
          studentsInside: insideCount,
          studentsOutside: outsideCount
        },
        date
      }, 'Daily summary report fetched');
    }

    const records = await AttendanceRecord.find({ date }).sort({ outTime: -1 });
    const stats = {
      total: records.length,
      returned: records.filter(r => r.status === 'Returned' || r.status === 'LateReturn').length,
      outside: records.filter(r => r.status === 'Out').length,
      late: records.filter(r => r.isLate).length,
    };
    return sendSuccess(res, { records, stats, date }, 'Daily report fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/report/weekly
exports.getWeeklyReport = async (req, res, next) => {
  try {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const startDate = days[0];
    const endDate = days[days.length - 1];

    if (req.userRole === 'admin-mess') {
      const dailyStats = [];
      for (const day of days) {
        const mealStats = await getMealCountsForDate(new Date(day));
        const insideCount = await Student.countDocuments({ currentStatus: 'Inside', isActive: true });
        const outsideCount = await Student.countDocuments({ currentStatus: 'Outside', isActive: true });
        const leaveCount = await Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true });
        const permCount = await Student.countDocuments({ currentStatus: 'Permission', isActive: true });

        dailyStats.push({
          date: day,
          breakfastCount: mealStats.breakfastCount,
          lunchCount: mealStats.lunchCount,
          dinnerCount: mealStats.dinnerCount,
          nativeLeaveCount: leaveCount,
          permissionCount: permCount,
          studentsInside: insideCount,
          studentsOutside: outsideCount
        });
      }
      const records = await getReportData(startDate, endDate);
      return sendSuccess(res, { records, dailyStats, dateRange: { startDate, endDate } }, 'Weekly summary report fetched');
    }

    const records = await getReportData(startDate, endDate);
    const dailyStats = days.map(day => ({
      date: day,
      total: records.filter(r => r.date === day).length,
      late: records.filter(r => r.date === day && r.isLate).length,
      returned: records.filter(r => r.date === day && (r.status === 'Returned' || r.status === 'LateReturn')).length,
    }));
    return sendSuccess(res, { records, dailyStats, dateRange: { startDate, endDate } }, 'Weekly report fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/report/monthly
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const today = new Date();
    const year = req.query.year || today.getFullYear();
    const month = req.query.month || (today.getMonth() + 1);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    if (req.userRole === 'admin-mess') {
      const dailyStats = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().split('T')[0];
        const mealStats = await getMealCountsForDate(new Date(d));
        const insideCount = await Student.countDocuments({ currentStatus: 'Inside', isActive: true });
        const outsideCount = await Student.countDocuments({ currentStatus: 'Outside', isActive: true });
        const leaveCount = await Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true });
        const permCount = await Student.countDocuments({ currentStatus: 'Permission', isActive: true });

        dailyStats.push({
          date: dayStr,
          breakfastCount: mealStats.breakfastCount,
          lunchCount: mealStats.lunchCount,
          dinnerCount: mealStats.dinnerCount,
          nativeLeaveCount: leaveCount,
          permissionCount: permCount,
          studentsInside: insideCount,
          studentsOutside: outsideCount
        });
      }
      const records = await getReportData(startDate, endDate);
      return sendSuccess(res, { records, dailyStats, dateRange: { startDate, endDate } }, 'Monthly summary report fetched');
    }

    const records = await getReportData(startDate, endDate);
    const stats = {
      total: records.length,
      late: records.filter(r => r.isLate).length,
      onTime: records.filter(r => !r.isLate && r.inTime).length,
      pending: records.filter(r => !r.inTime).length,
    };
    return sendSuccess(res, { records, stats, dateRange: { startDate, endDate } }, 'Monthly report fetched');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/report/export?type=daily|weekly|monthly&date=YYYY-MM-DD
exports.exportExcel = async (req, res, next) => {
  try {
    const { type, date, year, month } = req.query;
    let dataRows = [];
    let filename = 'hostelflow_report';

    if (req.userRole === 'admin-mess') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HostelFlow Mess System';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Mess Attendance Report');

      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'HostelFlow – Mess Attendance & Planning Summary';
      sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 35;

      sheet.mergeCells('A2:G2');
      sheet.getCell('A2').value = `Generated: ${new Date().toLocaleString('en-IN')}`;
      sheet.getCell('A2').font = { italic: true, size: 10 };
      sheet.getCell('A2').alignment = { horizontal: 'center' };
      sheet.getRow(2).height = 20;

      const headers = [
        'Date / Period', 'Breakfast Count', 'Lunch Count', 'Dinner Count',
        'Students Inside', 'Students Outside', 'Native Leave Count'
      ];
      const headerRow = sheet.addRow(headers);
      headerRow.height = 22;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      let statsList = [];
      const queryDate = date || getCurrentISTDate();

      if (type === 'daily' || !type) {
        const mealStats = await getMealCountsForDate(new Date(queryDate));
        const insideCount = await Student.countDocuments({ currentStatus: 'Inside', isActive: true });
        const outsideCount = await Student.countDocuments({ currentStatus: 'Outside', isActive: true });
        const leaveCount = await Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true });
        
        statsList.push([
          queryDate,
          mealStats.breakfastCount,
          mealStats.lunchCount,
          mealStats.dinnerCount,
          insideCount,
          outsideCount,
          leaveCount
        ]);
      } else if (type === 'weekly') {
        const today = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          days.push(d.toISOString().split('T')[0]);
        }
        for (const day of days) {
          const mealStats = await getMealCountsForDate(new Date(day));
          const insideCount = await Student.countDocuments({ currentStatus: 'Inside', isActive: true });
          const outsideCount = await Student.countDocuments({ currentStatus: 'Outside', isActive: true });
          const leaveCount = await Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true });
          statsList.push([
            day,
            mealStats.breakfastCount,
            mealStats.lunchCount,
            mealStats.dinnerCount,
            insideCount,
            outsideCount,
            leaveCount
          ]);
        }
      } else if (type === 'monthly') {
        const today = new Date();
        const qYear = year || today.getFullYear();
        const qMonth = month || (today.getMonth() + 1);
        const startDateStr = `${qYear}-${String(qMonth).padStart(2, '0')}-01`;
        const endDateStr = new Date(qYear, qMonth, 0).toISOString().split('T')[0];

        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toISOString().split('T')[0];
          const mealStats = await getMealCountsForDate(new Date(d));
          const insideCount = await Student.countDocuments({ currentStatus: 'Inside', isActive: true });
          const outsideCount = await Student.countDocuments({ currentStatus: 'Outside', isActive: true });
          const leaveCount = await Student.countDocuments({ currentStatus: 'NativeLeave', isActive: true });
          statsList.push([
            dayStr,
            mealStats.breakfastCount,
            mealStats.lunchCount,
            mealStats.dinnerCount,
            insideCount,
            outsideCount,
            leaveCount
          ]);
        }
      }

      statsList.forEach(row => {
        sheet.addRow(row);
      });

      sheet.columns.forEach(col => {
        col.width = 18;
        col.alignment = { horizontal: 'center' };
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=mess_summary_${getCurrentISTDate()}.xlsx`);

      await workbook.xlsx.write(res);
      return res.end();
    }

    const Permission = require('../models/Permission');
    const NativeLeave = require('../models/NativeLeave');

    if (type === 'permission') {
      const perms = await Permission.find().sort({ createdAt: -1 });
      dataRows = perms.map(p => ({
        registerNumber: p.registerNumber,
        studentName: p.studentName,
        department: '',
        year: '',
        outTime: p.startTime,
        inTime: p.status === 'Returned' ? p.updatedAt : null,
        permissionStartTime: p.permissionStartTime || p.startTime,
        permissionEndTime: p.permissionEndTime || p.permissionUntil,
        staffName: p.staffName || '',
        durationMinutes: p.status === 'Returned' ? Math.floor((p.updatedAt - p.startTime) / 60000) : 0,
        lateByMinutes: p.status === 'Expired' ? Math.floor((new Date() - p.permissionUntil) / 60000) : 0,
        status: p.status === 'Returned' ? 'On Time' : (p.status === 'Expired' ? 'Late' : 'Permission')
      }));
      filename = `permission_report_${getCurrentISTDate()}`;
    } else if (type === 'nativeleave' || type === 'leave') {
      const leaves = await NativeLeave.find().sort({ createdAt: -1 });
      dataRows = leaves.map(l => ({
        registerNumber: l.registerNumber,
        studentName: l.studentName,
        department: l.department || '',
        year: l.year || '',
        outTime: l.fromDate,
        inTime: l.actualReturnDate || null,
        permissionStartTime: null,
        permissionEndTime: null,
        staffName: '',
        durationMinutes: l.actualReturnDate ? Math.floor((l.actualReturnDate - l.fromDate) / 60000) : 0,
        lateByMinutes: 0,
        status: l.returnedEarly ? 'Returned Early' : (l.status === 'Active' ? 'Native Leave' : 'On Time')
      }));
      filename = `native_leave_report_${getCurrentISTDate()}`;
    } else if (type === 'emergency') {
      const EmergencyPermission = require('../models/EmergencyPermission');
      const emers = await EmergencyPermission.find().sort({ createdAt: -1 });
      dataRows = emers.map(e => ({
        registerNumber: e.registerNumber,
        studentName: e.studentName,
        department: e.department || '',
        year: e.year || '',
        outTime: e.outTime,
        inTime: null,
        permissionStartTime: null,
        permissionEndTime: null,
        staffName: e.wardenName || '',
        durationMinutes: 0,
        lateByMinutes: 0,
        status: `Emergency (${e.wardenDecision})`
      }));
      filename = `emergency_permission_report_${getCurrentISTDate()}`;
    } else {
      let records = [];
      if (type === 'daily') {
        const d = date || getCurrentISTDate();
        records = await AttendanceRecord.find({ date: d }).sort({ outTime: -1 });
        filename = `daily_report_${d}`;
      } else if (type === 'weekly') {
        const today = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          days.push(d.toISOString().split('T')[0]);
        }
        records = await getReportData(days[0], days[days.length - 1]);
        filename = `weekly_report_${days[0]}_to_${days[days.length - 1]}`;
      } else if (type === 'monthly') {
        const y = year || new Date().getFullYear();
        const m = month || (new Date().getMonth() + 1);
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const endDate = new Date(y, m, 0).toISOString().split('T')[0];
        records = await getReportData(startDate, endDate);
        filename = `monthly_report_${y}_${m}`;
      } else if (type === 'latecomer' || type === 'late') {
        records = await AttendanceRecord.find({ isLate: true }).sort({ outTime: -1 });
        filename = `late_comer_report_${getCurrentISTDate()}`;
      } else {
        records = await AttendanceRecord.find().sort({ outTime: -1 });
        filename = `attendance_report_${getCurrentISTDate()}`;
      }

      dataRows = records.map(r => {
        let statusStr = 'On Time';
        if (r.movementType === 'NativeLeave') {
          statusStr = r.returnedEarly ? 'Returned Early' : (r.status === 'Out' ? 'Native Leave' : 'On Time');
        } else if (r.movementType === 'StaffPermission' || r.movementType === 'Permission') {
          statusStr = r.status === 'Out' ? 'Permission' : (r.isLate ? 'Late' : 'On Time');
        } else if (r.movementType === 'EmergencyPermission') {
          statusStr = r.status === 'Out' ? 'Emergency' : (r.isLate ? 'Late' : 'On Time');
        } else {
          statusStr = r.isLate ? 'Late' : (r.status === 'Out' ? 'Out' : 'On Time');
        }

        return {
          registerNumber: r.registerNumber,
          studentName: r.studentName,
          department: r.department || '',
          year: r.year || '',
          outTime: r.outTime,
          inTime: r.inTime,
          permissionStartTime: r.permissionStartTime || (r.movementType === 'StaffPermission' || r.movementType === 'Permission' || r.movementType === 'EmergencyPermission' ? r.outTime : null),
          permissionEndTime: r.permissionEndTime || r.permissionUntil,
          staffName: r.staffName || '',
          durationMinutes: r.durationMinutes || 0,
          lateByMinutes: r.lateByMinutes || 0,
          status: statusStr
        };
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HostelFlow System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Attendance Report', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = 'HostelFlow – Hostel Attendance Report';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    sheet.mergeCells('A2:L2');
    sheet.getCell('A2').value = `Report Type: ${type ? type.toUpperCase() : 'ALL'} | Generated: ${new Date().toLocaleString('en-IN')}`;
    sheet.getCell('A2').font = { italic: true, size: 10 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    const headers = [
      'Register Number', 'Student Name', 'Department', 'Year',
      'Out Time', 'In Time', 'Permission Start Time', 'Permission End Time',
      'Staff Name', 'Duration Outside', 'Late Minutes', 'Status'
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    sheet.columns = [
      { width: 16 }, { width: 22 }, { width: 18 }, { width: 10 },
      { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
      { width: 18 }, { width: 18 }, { width: 12 }, { width: 16 }
    ];

    dataRows.forEach((r, i) => {
      const row = sheet.addRow([
        r.registerNumber,
        r.studentName,
        r.department,
        r.year,
        r.outTime ? new Date(r.outTime).toLocaleString('en-IN') : '',
        r.inTime ? new Date(r.inTime).toLocaleString('en-IN') : 'Not Returned',
        r.permissionStartTime ? new Date(r.permissionStartTime).toLocaleString('en-IN') : '-',
        r.permissionEndTime ? new Date(r.permissionEndTime).toLocaleString('en-IN') : '-',
        r.staffName || '-',
        r.durationMinutes ? `${r.durationMinutes} mins` : '-',
        r.lateByMinutes ? `${r.lateByMinutes} mins` : '0',
        r.status
      ]);
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      if (r.status === 'Late') {
        row.getCell(11).font = { bold: true, color: { argb: 'FFDC2626' } };
        row.getCell(12).font = { bold: true, color: { argb: 'FFDC2626' } };
      }
      if (i % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        });
      }
    });

    sheet.addRow([]);
    const lateCount = dataRows.filter(r => r.status === 'Late').length;
    const summaryRow = sheet.addRow(['', '', '', '', '', '', 'TOTAL:', dataRows.length, '', '', 'LATE:', lateCount]);
    summaryRow.eachCell(cell => { cell.font = { bold: true }; });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

// @route GET /api/report/attendance-chart
exports.getAttendanceChartData = async (req, res, next) => {
  try {
    const today = new Date();
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const total = await AttendanceRecord.countDocuments({ date: dateStr });
      const late = await AttendanceRecord.countDocuments({ date: dateStr, isLate: true });
      const onTime = total - late;
      chartData.push({ date: dateStr, total, late, onTime, day: d.toLocaleDateString('en-IN', { weekday: 'short' }) });
    }
    return sendSuccess(res, { chartData }, 'Chart data fetched');
  } catch (error) {
    next(error);
  }
};
