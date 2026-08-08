const rateLimit = require('express-rate-limit');

const baseOpts = { standardHeaders: true, legacyHeaders: false };

// Login: brute-force şifre denemesine karşı IP başına sıkı limit.
const loginLimiter = rateLimit({
  ...baseOpts,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' },
});

// Kayıt: otomatik/toplu sahte üyelik açılmasına karşı.
const registerLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' },
});

// Şifre sıfırlama: e-posta bombalama / hesap keşfi denemelerine karşı.
const forgotPasswordLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Çok fazla şifre sıfırlama talebi yapıldı. Lütfen daha sonra tekrar deneyin.' },
});

// Genel API: aşırı otomatik istek/DoS'a karşı gevşek bir taban limit.
const apiLimiter = rateLimit({
  ...baseOpts,
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' },
});

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter, apiLimiter };
