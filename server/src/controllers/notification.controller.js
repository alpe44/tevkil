const notificationModel = require('../models/notificationModel');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const onlyUnread = req.query.unread === '1';
  const [notifications, unreadCount] = await Promise.all([
    notificationModel.listForUser(req.user.id, { onlyUnread }),
    notificationModel.countUnread(req.user.id),
  ]);
  res.json({ notifications, unreadCount });
});

const markRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz bildirim id.' });
  const notification = await notificationModel.markRead(id, req.user.id);
  if (!notification) return res.status(404).json({ error: 'Bildirim bulunamadı.' });
  res.json({ notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationModel.markAllRead(req.user.id);
  res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi.' });
});

module.exports = { list, markRead, markAllRead };
