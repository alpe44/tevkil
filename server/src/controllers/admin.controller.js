const { validationResult } = require('express-validator');
const userModel = require('../models/userModel');
const notifyService = require('../services/notifyService');
const asyncHandler = require('../utils/asyncHandler');

function fireAndForget(promise) {
  Promise.resolve(promise).catch((err) => console.error('[notify] Bildirim gönderilemedi:', err.message));
}

const VALID_STATUSES = ['pending', 'approved', 'rejected'];
const VALID_AVATAR_STATUSES = ['pending', 'approved', 'rejected'];

const listUsers = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Geçersiz status parametresi.' });
  }
  const users = await userModel.listByStatus(status);
  res.json({ users });
});

const approveUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const target = await userModel.findById(id);
  if (!target) return res.status(404).json({ error: 'Üye bulunamadı.' });
  if (target.status === 'approved') {
    return res.status(409).json({ error: 'Üye zaten onaylanmış.' });
  }
  const user = await userModel.setStatus(id, 'approved');
  fireAndForget(notifyService.notifyAccountApproved(user));
  res.json({ message: 'Üye onaylandı.', user });
});

const rejectUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  const id = Number(req.params.id);
  const target = await userModel.findById(id);
  if (!target) return res.status(404).json({ error: 'Üye bulunamadı.' });
  if (target.status === 'rejected') {
    return res.status(409).json({ error: 'Üye zaten reddedilmiş.' });
  }
  const user = await userModel.setStatus(id, 'rejected', { rejectionReason: req.body.reason || null });
  fireAndForget(notifyService.notifyAccountRejected(user, req.body.reason));
  res.json({ message: 'Üye reddedildi.', user });
});

// Bir avatar isteği, hesap zaten onaylıyken de gelebilir (profil fotoğrafı sonradan değiştirilir) —
// bu yüzden üyelik durumundan (pending/approved/rejected users) bağımsız, ayrı bir kuyruk.
const listAvatarRequests = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  if (!VALID_AVATAR_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Geçersiz status parametresi.' });
  }
  const users = await userModel.listByAvatarStatus(status);
  res.json({ users });
});

const approveAvatar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const target = await userModel.findById(id);
  if (!target) return res.status(404).json({ error: 'Üye bulunamadı.' });
  if (target.avatar_status !== 'pending') {
    return res.status(409).json({ error: 'Onay bekleyen bir fotoğraf isteği yok.' });
  }
  const user = await userModel.setAvatarStatus(id, 'approved');
  fireAndForget(notifyService.notifyAvatarApproved(user));
  res.json({ message: 'Fotoğraf onaylandı.', user });
});

const rejectAvatar = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  const id = Number(req.params.id);
  const target = await userModel.findById(id);
  if (!target) return res.status(404).json({ error: 'Üye bulunamadı.' });
  if (target.avatar_status !== 'pending') {
    return res.status(409).json({ error: 'Onay bekleyen bir fotoğraf isteği yok.' });
  }
  const user = await userModel.setAvatarStatus(id, 'rejected', { rejectionReason: req.body.reason || null });
  fireAndForget(notifyService.notifyAvatarRejected(user, req.body.reason));
  res.json({ message: 'Fotoğraf reddedildi.', user });
});

module.exports = { listUsers, approveUser, rejectUser, listAvatarRequests, approveAvatar, rejectAvatar };
