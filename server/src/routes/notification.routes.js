const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

router.get('/', notificationController.list);
router.post('/:id/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

module.exports = router;
