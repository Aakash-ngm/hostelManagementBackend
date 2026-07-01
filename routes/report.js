const express = require('express');
const router = express.Router();
const { getDailyReport, getWeeklyReport, getMonthlyReport, exportExcel, getAttendanceChartData } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireWarden, requireWardenOrAdminMess } = require('../middleware/roleGuard');

router.use(protect, requireWardenOrAdminMess);

router.get('/daily', getDailyReport);
router.get('/weekly', getWeeklyReport);
router.get('/monthly', getMonthlyReport);
router.get('/chart', requireWardenOrAdminMess, getAttendanceChartData);
router.get('/export', exportExcel);

module.exports = router;
