const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { lookupStudent, recordOut, recordIn, getMyHistory, getStudentHistory } = require('../controllers/movementController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/lookup/:registerNumber', lookupStudent);
router.post('/out', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
], validate, recordOut);
router.post('/in', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
], validate, recordIn);
router.get('/history', protect, getMyHistory);
router.get('/history/:registerNumber', protect, requireWarden, getStudentHistory);

module.exports = router;
