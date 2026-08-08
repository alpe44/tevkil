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
  body('taskType').trim().notEmpty().withMessage('Görev türünü seçiniz.'),
  body('budget').optional({ checkFalsy: true }).isLength({ max: 60 }),
  body('dueTime')
    .optional({ checkFalsy: true })
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Geçerli bir saat giriniz.'),
  body('isOffSite').optional().isBoolean().withMessage('Geçersiz değer.'),
  body('offSiteAddress').custom((value, { req }) => {
    const isOffSite = req.body.isOffSite === true || req.body.isOffSite === 'true';
    if (isOffSite && (!value || !String(value).trim())) {
      throw new Error('Adliye dışı işlem için adres giriniz.');
    }
    return true;
  }),
];

const completeRules = [body('rating').isInt({ min: 1, max: 5 }).withMessage('1 ile 5 arası bir puan giriniz.')];

const acceptRules = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Telefon numarası giriniz.')
    .matches(/^[0-9+()\s-]{10,20}$/)
    .withMessage('Geçerli bir telefon numarası giriniz.'),
  body('contactAddress').trim().notEmpty().withMessage('İletişim adresi giriniz.'),
  body('note').trim().notEmpty().withMessage('Tevkil ile ilgili bilgileri giriniz.'),
];

// Herkese açık: açık görevleri görebilmek için giriş şart değil (Görev Panosu).
router.get('/open', taskController.listOpen);

router.get('/queue', requireAuth, requireApproved, taskController.queueForCourthouse);
router.get('/mine', requireAuth, requireApproved, taskController.listMine);
router.get('/taken', requireAuth, requireApproved, taskController.listTaken);
router.post('/', requireAuth, requireApproved, createRules, taskController.create);
router.post('/:id/accept', requireAuth, requireApproved, acceptRules, taskController.accept);
router.post('/:id/complete', requireAuth, requireApproved, completeRules, taskController.complete);

module.exports = router;
