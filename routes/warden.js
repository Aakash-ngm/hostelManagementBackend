const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAllStudents, getStudentById,
  addStudent, updateStudent, deleteStudent,
  getLiveStatus, getLateStudents, getCurrentlyOutside
} = require('../controllers/wardenController');
const { protect } = require('../middleware/auth');
const { requireWarden, requireWardenOrAdminMess } = require('../middleware/roleGuard');

router.get('/dashboard', protect, requireWardenOrAdminMess, getDashboardStats);
router.get('/live-status', protect, requireWardenOrAdminMess, getLiveStatus);
router.get('/currently-outside', protect, requireWardenOrAdminMess, getCurrentlyOutside);

// All other routes require full Warden access
router.use(protect, requireWarden);

router.get('/students', getAllStudents);
router.post('/students', addStudent);
router.get('/students/:id', getStudentById);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.get('/late-today', getLateStudents);

module.exports = router;
