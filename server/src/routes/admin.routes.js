const { Router } = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = Router();

// Bu router altındaki her uç nokta: giriş yapmış VE admin rolünde olmalı.
router.use(requireAuth, requireAdmin);

router.get('/users', adminController.listUsers);
router.post('/users/:id/approve', adminController.approveUser);
router.post(
  '/users/:id/reject',
  [body('reason').optional({ checkFalsy: true }).isLength({ max: 500 })],
  adminController.rejectUser
);

router.get('/avatars', adminController.listAvatarRequests);
router.post('/users/:id/avatar/approve', adminController.approveAvatar);
router.post(
  '/users/:id/avatar/reject',
  [body('reason').optional({ checkFalsy: true }).isLength({ max: 500 })],
  adminController.rejectAvatar
);

router.get('/comments', adminController.listComments);
router.post('/tasks/:id/comment/approve', adminController.approveComment);
router.post(
  '/tasks/:id/comment/reject',
  [body('reason').optional({ checkFalsy: true }).isLength({ max: 500 })],
  adminController.rejectComment
);

module.exports = router;
