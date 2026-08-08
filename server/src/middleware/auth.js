const { verifyToken } = require('../utils/jwt');
const userModel = require('../models/userModel');

const COOKIE_NAME = 'tevkil_token';

/**
 * JWT'yi cookie'den okur, kullanıcıyı DB'den taze çeker (status/role değişmiş olabilir)
 * ve req.user'a atar. Token yok/geçersizse 401 döner.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
    }
    const payload = verifyToken(token);
    const user = await userModel.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] requireAuth hata:', err.name, '-', err.message);
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

/**
 * requireAuth'un aksine oturum yoksa/geçersizse hata döndürmez, sadece req.user'ı boş bırakır.
 * Herkese açık olabilen ama giriş yapmış kullanıcıya göre davranışı değişebilen uçlar için
 * (ör. avatar görselleri — onaylıysa herkes, değilse yalnızca sahibi/admin görür).
 */
async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();
    const payload = verifyToken(token);
    const user = await userModel.findById(payload.sub);
    if (user) req.user = user;
  } catch (err) {
    /* geçersiz/süresi dolmuş token — sessizce yoksay, giriş yapmamış gibi devam et */
  }
  next();
}

/** requireAuth'tan sonra kullanılır: sadece admin onaylı üyeler geçebilir. */
function requireApproved(req, res, next) {
  if (req.user.status !== 'approved') {
    return res.status(403).json({
      error:
        req.user.status === 'pending'
          ? 'Hesabınız admin onayı bekliyor.'
          : 'Hesabınız onaylanmadı.',
      status: req.user.status,
    });
  }
  next();
}

/** requireAuth'tan sonra kullanılır: sadece admin rolü. */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekir.' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireApproved, requireAdmin, COOKIE_NAME };
