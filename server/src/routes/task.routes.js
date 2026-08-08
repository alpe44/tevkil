const { Router } = require('express');
const { body } = require('express-validator');
const taskController = require('../controllers/task.controller');
const { requireAuth, requireApproved } = require('../middleware/auth');

const router = Router();

const createRules = [
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Başlık giriniz (en az 3 karakter).'),
  body('description').trim().isLength({ min: 3, max: 4000 }).withMessage('Açıklama giriniz.'),
  body('city').trim().notEmpty().withMessage('Adliye/İl giriniz.'),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Geçerli bir tarih giriniz.'),
];

const completeRules = [body('rating').isInt({ min: 1, max: 5 }).withMessage('1 ile 5 arası bir puan giriniz.')];

// Herkese açık: açık görevleri görebilmek için giriş şart değil (Görev Panosu).
router.get('/open', taskController.listOpen);

router.get('/queue', requireAuth, requireApproved, taskController.queueForCourthouse);
router.get('/mine', requireAuth, requireApproved, taskController.listMine);
router.get('/taken', requireAuth, requireApproved, taskController.listTaken);
router.post('/', requireAuth, requireApproved, createRules, taskController.create);
router.post('/:id/accept', requireAuth, requireApproved, taskController.accept);
router.post('/:id/complete', requireAuth, requireApproved, completeRules, taskController.complete);

module.exports = router;
