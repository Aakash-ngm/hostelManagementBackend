const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAllStudents, getStudentById,
  addStudent, updateStudent, deleteStudent,
  getLiveStatus, getLateStudents, getCurrentlyOutside
} = require('../controllers/wardenController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');

router.use(protect, requireWarden);

router.get('/dashboard', getDashboardStats);
router.get('/students', getAllStudents);
router.post('/students', addStudent);
router.get('/students/:id', getStudentById);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.get('/live-status', getLiveStatus);
router.get('/late-today', getLateStudents);
router.get('/currently-outside', getCurrentlyOutside);

module.exports = router;
