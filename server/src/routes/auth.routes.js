const { Router } = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require('../middleware/rateLimit');
const { handleAvatarUpload } = require('../middleware/upload');

const router = Router();

const registerRules = [
  body('fullName').trim().isLength({ min: 3, max: 150 }).withMessage('Ad soyad giriniz.'),
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta giriniz.'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Telefon numarası giriniz.')
    .matches(/^[0-9+()\s-]{10,20}$/)
    .withMessage('Geçerli bir telefon numarası giriniz.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Şifre en az 8 karakter olmalı.')
    .matches(/[a-zA-Z]/)
    .withMessage('Şifre en az bir harf içermeli.')
    .matches(/[0-9]/)
    .withMessage('Şifre en az bir rakam içermeli.'),
  body('barAssociation').trim().notEmpty().withMessage('Baro giriniz.'),
  body('barRegistryNo').trim().notEmpty().withMessage('Sicil no giriniz.'),
  body('province').trim().notEmpty().withMessage('İl giriniz.'),
  body('courthouse').trim().notEmpty().withMessage('Adliye giriniz.'),
  body('bio').optional({ checkFalsy: true }).isLength({ max: 2000 }),
  body('kvkkConsent')
    .custom((value) => value === true || value === 'true')
    .withMessage('KVKK Aydınlatma Metni\'ni okuyup açık rıza vermeniz gerekiyor.'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta giriniz.'),
  body('password').notEmpty().withMessage('Şifre giriniz.'),
];

const forgotPasswordRules = [body('email').trim().isEmail().withMessage('Geçerli bir e-posta giriniz.')];

const resetPasswordRules = [
  body('token').trim().notEmpty().withMessage('Geçersiz bağlantı.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Şifre en az 8 karakter olmalı.')
    .matches(/[a-zA-Z]/)
    .withMessage('Şifre en az bir harf içermeli.')
    .matches(/[0-9]/)
    .withMessage('Şifre en az bir rakam içermeli.'),
];

// handleAvatarUpload multipart body'yi req.body'ye çözüyor (opsiyonel 'avatar' alanı) —
// registerRules'ın req.body üzerinde çalışabilmesi için ondan önce gelmeli.
router.post('/register', registerLimiter, handleAvatarUpload, registerRules, authController.register);
router.post('/login', loginLimiter, loginRules, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordRules, authController.forgotPassword);
router.post('/reset-password', forgotPasswordLimiter, resetPasswordRules, authController.resetPassword);

module.exports = router;
