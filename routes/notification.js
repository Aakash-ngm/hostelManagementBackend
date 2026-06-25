const express = require('express');
const router = express.Router();
const { getNotifications, markRead, markAllRead, clearAll } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { requireWarden } = require('../middleware/roleGuard');

router.use(protect, requireWarden);

router.get('/', getNotifications);
router.put('/:id/read', markRead);
router.put('/mark-all-read', markAllRead);
router.delete('/clear', clearAll);

module.exports = router;
