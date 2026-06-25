const AttendanceRecord = require('../models/AttendanceRecord');
const Student = require('../models/Student');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getCurrentISTDate, formatDuration } = require('../utils/timeHelpers');
const ExcelJS = require('exceljs');

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
    let records = [];
    let filename = 'hostelflow_report';

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
    } else {
      return sendError(res, 'Invalid report type. Use daily, weekly, or monthly.', 400);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HostelFlow System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Attendance Report', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Header styling
    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = 'HostelFlow – Hostel Attendance Report';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    sheet.mergeCells('A2:L2');
    sheet.getCell('A2').value = `Report Type: ${type.toUpperCase()} | Generated: ${new Date().toLocaleString('en-IN')}`;
    sheet.getCell('A2').font = { italic: true, size: 10 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    // Column headers
    const headers = [
      'S.No', 'Register No.', 'Student Name', 'Department', 'Year', 'Room No.',
      'Movement Type', 'Out Time', 'In Time', 'Duration', 'Status', 'Late By'
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Column widths
    sheet.columns = [
      { width: 6 }, { width: 16 }, { width: 22 }, { width: 18 }, { width: 10 },
      { width: 10 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 10 }
    ];

    // Data rows
    records.forEach((r, i) => {
      const row = sheet.addRow([
        i + 1,
        r.registerNumber,
        r.studentName,
        r.department || '',
        r.year || '',
        r.roomNumber || '',
        r.movementType,
        r.outTime ? new Date(r.outTime).toLocaleString('en-IN') : '',
        r.inTime ? new Date(r.inTime).toLocaleString('en-IN') : 'Not Returned',
        r.durationMinutes ? formatDuration(r.durationMinutes) : '-',
        r.isLate ? 'LATE' : r.status,
        r.isLate ? `${r.lateByMinutes} mins` : '-',
      ]);
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      if (r.isLate) {
        row.getCell(11).font = { bold: true, color: { argb: 'FFDC2626' } };
        row.getCell(12).font = { bold: true, color: { argb: 'FFDC2626' } };
      }
      if (i % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        });
      }
    });

    // Summary row
    const lateCount = records.filter(r => r.isLate).length;
    sheet.addRow([]);
    const summaryRow = sheet.addRow(['', '', '', '', '', '', 'TOTAL:', records.length, '', '', 'LATE:', lateCount]);
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
