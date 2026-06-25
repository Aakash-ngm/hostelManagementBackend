const express = require('express');
const router = express.Router();
const { getDailyReport, getWeeklyReport, getMonthlyReport, exportExcel, getAttendanceChartData } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');

router.use(protect, requireWarden);

router.get('/daily', getDailyReport);
router.get('/weekly', getWeeklyReport);
router.get('/monthly', getMonthlyReport);
router.get('/chart', getAttendanceChartData);
router.get('/export', exportExcel);

module.exports = router;
