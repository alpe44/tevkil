const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const userModel = require('../models/userModel');
const taskModel = require('../models/taskModel');
const { signToken } = require('../utils/jwt');
const { COOKIE_NAME } = require('../middleware/auth');
const { AVATAR_DIR } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const mailer = require('../utils/mailer');

/** Kayıt başarısız olursa (doğrulama/çakışma hatası) multer'ın önceden diske yazdığı
 * fotoğrafı öksüz bırakmamak için siler. */
function cleanupUploadedFile(req) {
  if (!req.file) return;
  fs.unlink(path.join(AVATAR_DIR, req.file.filename), (err) => {
    if (err && err.code !== 'ENOENT') console.error('[avatar] Yüklenen dosya temizlenemedi:', err.message);
  });
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Profil sayaçlarını (rating_avg / completed_count / created_count) tasks tablosundan
// canlı hesaplayıp kullanıcı nesnesine gömer — ayrı bir alan tutup senkron etmek yerine
// her zaman doğru olan tek kaynaktan (tasks) türetiyoruz.
async function withLiveStats(user) {
  if (!user) return user;
  const stats = await taskModel.getUserStats(user.id);
  return {
    ...user,
    rating_avg: stats.ratingAvg,
    completed_count: stats.completedCount,
    created_count: stats.createdCount,
  };
}

const SALT_ROUNDS = 12;
const isProd = process.env.NODE_ENV === 'production';

function setAuthCookie(res, user) {
  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
  });
}

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
    return false;
  }
  return true;
}

const register = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) {
    cleanupUploadedFile(req);
    return;
  }

  const {
    fullName,
    email,
    password,
    phone,
    barAssociation,
    barRegistryNo,
    province,
    courthouse,
    bio,
  } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    cleanupUploadedFile(req);
    return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.' });
  }

  const existingSicil = await userModel.findByBarRegistry(barAssociation.trim(), barRegistryNo.trim());
  if (existingSicil) {
    cleanupUploadedFile(req);
    return res.status(409).json({ error: 'Bu baro sicil numarasıyla zaten bir kayıt mevcut.' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await userModel.createUser({
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: phone.trim(),
    barAssociation: barAssociation.trim(),
    barRegistryNo: barRegistryNo.trim(),
    province: province.trim(),
    courthouse: courthouse.trim(),
    bio: bio ? bio.trim() : null,
    avatarFilename: req.file ? req.file.filename : null,
  });

  // Not: status='pending' olarak oluşturuldu; admin onaylamadan giriş yapamaz.
  // Bu yüzden kayıt sonrası otomatik oturum AÇMIYORUZ.
  res.status(201).json({
    message: 'Kaydınız alındı. Admin onayından sonra giriş yapabileceksiniz.',
    user,
  });
});

const login = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) return;

  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      error: 'Hesabınız admin onayı bekliyor. Onaylandığında bilgilendirileceksiniz.',
      status: 'pending',
    });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({
      error: 'Üyelik başvurunuz onaylanmadı.' + (user.rejection_reason ? ' Sebep: ' + user.rejection_reason : ''),
      status: 'rejected',
    });
  }

  setAuthCookie(res, user);
  // findByEmail SELECT * kullanıyor (bcrypt.compare için password_hash gerekli) — yanıta
  // sızmaması gereken iç alanları burada temizliyoruz (avatar_filename servis edilen dosya adı,
  // reset_token_* şifre sıfırlama iç durumu; PUBLIC_COLUMNS'un dışında tutulan aynı alanlar).
  delete user.password_hash;
  delete user.reset_token_hash;
  delete user.reset_token_expires_at;
  delete user.avatar_filename;
  const enrichedUser = await withLiveStats(user);
  res.json({ message: 'Giriş başarılı.', user: enrichedUser });
});

const me = asyncHandler(async (req, res) => {
  const enrichedUser = await withLiveStats(req.user);
  res.json({ user: enrichedUser });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: 'Çıkış yapıldı.' });
});

// Kullanıcı e-posta ile şifre sıfırlama talep eder. Hesap var/yok bilgisini sızdırmamak için
// (user enumeration'a karşı) her durumda aynı genel mesajla yanıt veriyoruz.
const forgotPassword = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) return;
  const email = req.body.email.trim().toLowerCase();
  const genericMessage = 'Bu e-posta adresine kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.';

  const user = await userModel.findByEmail(email);
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await userModel.setResetToken(user.id, sha256(rawToken), expiresAt);

    const resetUrl = (process.env.APP_BASE_URL || 'http://localhost:4000') + '/?resetToken=' + rawToken;
    await mailer.sendMail({
      to: user.email,
      subject: '[Nöbetçi] Şifre sıfırlama',
      text:
        'Merhaba ' + user.full_name + ',\n\n' +
        'Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın (1 saat geçerlidir):\n' +
        resetUrl + '\n\n' +
        'Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.\n',
    });
  }

  res.json({ message: genericMessage });
});

const resetPassword = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) return;
  const { token, password } = req.body;

  const user = await userModel.findByValidResetTokenHash(sha256(token));
  if (!user) {
    return res.status(400).json({ error: 'Bağlantı geçersiz veya süresi dolmuş. Tekrar şifre sıfırlama talebinde bulunun.' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await userModel.setPasswordAndClearResetToken(user.id, passwordHash);

  res.json({ message: 'Şifreniz güncellendi. Şimdi giriş yapabilirsiniz.' });
});

module.exports = { register, login, me, logout, forgotPassword, resetPassword };
