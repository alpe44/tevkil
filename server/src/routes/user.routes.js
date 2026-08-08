const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { handleAvatarUpload } = require('../middleware/upload');

const router = Router();

router.post('/me/avatar', requireAuth, handleAvatarUpload, userController.uploadAvatar);
router.get('/:id/avatar', optionalAuth, userController.getAvatarImage);

module.exports = router;
