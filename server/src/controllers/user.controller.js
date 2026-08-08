const fs = require('fs');
const path = require('path');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const { AVATAR_DIR } = require('../middleware/upload');

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fotoğraf seçilmedi.' });
  }

  const { oldFilename } = await userModel.setAvatar(req.user.id, req.file.filename);

  if (oldFilename) {
    fs.unlink(path.join(AVATAR_DIR, oldFilename), (err) => {
      if (err && err.code !== 'ENOENT') console.error('[avatar] Eski dosya silinemedi:', err.message);
    });
  }

  const user = await userModel.findById(req.user.id);
  res.json({ message: 'Fotoğrafınız yüklendi, admin onayı bekliyor.', user });
});

/**
 * Fotoğrafı servis eder — görünürlük kuralı:
 * onaylıysa herkese, değilse yalnızca sahibi veya admin görebilir.
 * Bu sayede onay bekleyen/reddedilen fotoğraflar başka kullanıcılara sızmaz.
 */
const getAvatarImage = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const record = await userModel.findAvatarRecord(id);
  if (!record || !record.avatar_filename) {
    return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
  }

  const isOwner = req.user && req.user.id === id;
  const isAdmin = req.user && req.user.role === 'admin';
  if (record.avatar_status !== 'approved' && !isOwner && !isAdmin) {
    return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
  }

  const filePath = path.join(AVATAR_DIR, record.avatar_filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
  }
  res.sendFile(filePath);
});

module.exports = { uploadAvatar, getAvatarImage };
