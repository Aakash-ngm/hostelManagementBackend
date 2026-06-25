const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { applyNativeLeave, returnFromLeave, getActiveLeaves, getAllLeaves } = require('../controllers/leaveController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.post('/apply', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('fromDate').notEmpty().withMessage('From date is required'),
  body('toDate').notEmpty().withMessage('To date is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
], validate, applyNativeLeave);
router.post('/return', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
], validate, returnFromLeave);
router.get('/active', protect, requireWarden, getActiveLeaves);
router.get('/all', protect, requireWarden, getAllLeaves);

module.exports = router;
