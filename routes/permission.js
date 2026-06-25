const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { grantPermission, getActivePermissions, getAllPermissions } = require('../controllers/permissionController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.post('/grant', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('permissionUntil').notEmpty().withMessage('Permission until time is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
], validate, grantPermission);
router.get('/active', protect, requireWarden, getActivePermissions);
router.get('/all', protect, requireWarden, getAllPermissions);

module.exports = router;
