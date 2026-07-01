const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { registerStudent, loginStudent, registerWarden, loginWarden, getMe, getWardens, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const studentRegisterValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('registerNumber').trim().notEmpty().withMessage('Register number is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('roomNumber').trim().notEmpty().withMessage('Room number is required'),
  body('studentPhone').matches(/^[6-9]\d{9}$/).withMessage('Valid student phone is required'),
  body('parentPhone').matches(/^[6-9]\d{9}$/).withMessage('Valid parent phone is required'),
];

router.post('/student/register', studentRegisterValidation, validate, registerStudent);
router.post('/student/login', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, loginStudent);
router.post('/warden/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, loginWarden);
router.get('/me', protect, getMe);
router.get('/wardens', getWardens);
router.post('/change-password', [
  protect,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], validate, changePassword);

module.exports = router;
