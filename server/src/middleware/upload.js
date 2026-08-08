const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Yüklenen fotoğraflar public/ dışında, kontrollü bir uçtan (bkz. user.controller.js
// getAvatarImage) servis edilir — admin onaylayana kadar herkese açık dosya yolu olmasın diye.
const AVATAR_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname) || '';
    const unique = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, `avatar-${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME[file.mimetype]) {
    return cb(new Error('Yalnızca JPEG, PNG veya WEBP formatında fotoğraf yükleyebilirsiniz.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 }, // 3MB
});

/** multer hatalarını (dosya tipi/boyut) tek tip JSON hataya çevirir. */
function handleAvatarUpload(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fotoğraf en fazla 3MB olabilir.' });
    }
    return res.status(400).json({ error: err.message || 'Fotoğraf yüklenemedi.' });
  });
}

module.exports = { AVATAR_DIR, handleAvatarUpload };
