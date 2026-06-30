const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  applyNativeLeave, 
  returnFromLeave, 
  getActiveLeaves, 
  getAllLeaves,
  getPendingLeaves,
  approveNativeLeave,
  rejectNativeLeave,
  recordLeaveOut,
  getMyLeaves
} = require('../controllers/leaveController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/student/my-leaves', protect, getMyLeaves);
router.post('/apply', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('fromDate').notEmpty().withMessage('From date is required'),
  body('toDate').notEmpty().withMessage('To date is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('wardenId').notEmpty().withMessage('Warden selection is required'),
], validate, applyNativeLeave);

router.post('/return', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
], validate, returnFromLeave);

router.get('/pending', protect, requireWarden, getPendingLeaves);
router.get('/active', protect, requireWarden, getActiveLeaves);
router.get('/all', protect, requireWarden, getAllLeaves);
router.post('/approve/:id', protect, requireWarden, approveNativeLeave);
router.post('/reject/:id', protect, requireWarden, rejectNativeLeave);
router.post('/out', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
], validate, recordLeaveOut);

module.exports = router;
