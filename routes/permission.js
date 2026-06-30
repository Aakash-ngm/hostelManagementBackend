const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  grantPermission, 
  getActivePermissions, 
  getAllPermissions, 
  grantStaffPermission,
  grantEmergencyPermission,
  getEmergencyHistory,
  getPendingPermissions,
  approveStaffPermission,
  rejectStaffPermission,
  recordStaffPermissionOut,
  getMyPermissions
} = require('../controllers/permissionController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/student/my-permissions', protect, getMyPermissions);
router.post('/grant', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('permissionUntil').notEmpty().withMessage('Permission until time is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
], validate, grantPermission);

router.post('/grant-staff', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('permissionDate').notEmpty().withMessage('Permission date is required'),
  body('fromTime').notEmpty().withMessage('From time is required'),
  body('toTime').notEmpty().withMessage('To time is required'),
  body('staffName').notEmpty().withMessage('Staff name is required')
    .custom(val => ['sathish', 'vijayan', 'kannan', 'arul'].includes(val.toLowerCase()))
    .withMessage('Staff name must be one of: sathish, vijayan, kannan, arul'),
  body('reason').notEmpty().withMessage('Reason is required'),
], validate, grantStaffPermission);

router.post('/emergency', [
  body('registerNumber').notEmpty().withMessage('Register number is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('wardenName').notEmpty().withMessage('Warden name is required'),
  body('wardenDecision').notEmpty().withMessage('Warden decision is required')
    .isIn(['Approved', 'Rejected']).withMessage('Warden decision must be Approved or Rejected'),
], validate, grantEmergencyPermission);

router.get('/active', protect, requireWarden, getActivePermissions);
router.get('/all', protect, requireWarden, getAllPermissions);
router.get('/emergency/history', protect, requireWarden, getEmergencyHistory);
router.get('/pending-staff', protect, requireWarden, getPendingPermissions);
router.post('/approve-staff/:id', protect, requireWarden, approveStaffPermission);
router.post('/reject-staff/:id', protect, requireWarden, rejectStaffPermission);
router.post('/staff-out', [
  body('registerNumber').notEmpty().withMessage('Register number is required')
], validate, recordStaffPermissionOut);

module.exports = router;
