const { validationResult } = require('express-validator');
const taskModel = require('../models/taskModel');
const userModel = require('../models/userModel');
const notifyService = require('../services/notifyService');
const asyncHandler = require('../utils/asyncHandler');

// Bildirim gönderimi ana isteği asla bloklamamalı/çökertmemeli — hata olursa sadece loglanır.
function fireAndForget(promise) {
  Promise.resolve(promise).catch((err) => console.error('[notify] Bildirim gönderilemedi:', err.message));
}

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
    return false;
  }
  return true;
}

function serialize(t) {
  return {
    id: t.id,
    title: t.title,
    desc: t.description,
    city: t.city,
    date: t.due_date ? new Date(t.due_date).toISOString().slice(0, 10) : null,
    status: t.status,
    rating: t.rating,
    ownerId: t.owner_id,
    ownerName: t.owner_name,
    assigneeId: t.assignee_id,
    assigneeName: t.assignee_name,
    createdAt: t.created_at,
    assignedAt: t.assigned_at,
    completedAt: t.completed_at,
  };
}

/**
 * Bir adliyedeki onaylı avukatların "adil sıra" önceliğini gösterir (bkz.
 * userModel.listApprovedByCourthouseInQueueOrder). Görev kabul etmek hâlâ
 * herkese açıktır; bu uç nokta sadece bildirim/gösterim sırasını şeffaf kılar.
 */
const queueForCourthouse = asyncHandler(async (req, res) => {
  const courthouse = (req.query.courthouse || '').trim();
  if (!courthouse) return res.status(400).json({ error: 'courthouse parametresi gerekli.' });

  const list = await userModel.listApprovedByCourthouseInQueueOrder(courthouse);
  const queue = list.map((u, idx) => ({ position: idx + 1, id: u.id, fullName: u.full_name }));
  const mine = queue.find((q) => q.id === req.user.id);
  res.json({ courthouse, queue, myPosition: mine ? mine.position : null });
});

const listOpen = asyncHandler(async (req, res) => {
  const tasks = await taskModel.listOpen();
  res.json({ tasks: tasks.map(serialize) });
});

const listMine = asyncHandler(async (req, res) => {
  const tasks = await taskModel.listByOwner(req.user.id);
  res.json({ tasks: tasks.map(serialize) });
});

const listTaken = asyncHandler(async (req, res) => {
  const tasks = await taskModel.listByAssignee(req.user.id);
  res.json({ tasks: tasks.map(serialize) });
});

const create = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) return;
  const { title, description, city, dueDate } = req.body;
  const task = await taskModel.createTask({
    ownerId: req.user.id,
    title: title.trim(),
    description: description.trim(),
    city: city.trim(),
    dueDate: dueDate || null,
  });
  fireAndForget(notifyService.notifyTaskOpenMatch(task));
  res.status(201).json({ message: 'Görev yayınlandı.', task: serialize(task) });
});

const accept = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz görev id.' });

  const existing = await taskModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Görev bulunamadı.' });
  if (existing.owner_id === req.user.id) {
    return res.status(400).json({ error: 'Kendi görevinizi üstlenemezsiniz.' });
  }
  if (existing.status !== 'open') {
    return res.status(409).json({ error: 'Bu görev artık uygun değil (başka biri üstlenmiş olabilir).' });
  }

  const task = await taskModel.acceptTask(id, req.user.id);
  if (!task) {
    return res.status(409).json({ error: 'Bu görev artık uygun değil (başka biri üstlenmiş olabilir).' });
  }
  fireAndForget(notifyService.notifyTaskAccepted(task));
  res.json({ message: 'Görevi üstlendiniz.', task: serialize(task) });
});

const complete = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz görev id.' });

  const existing = await taskModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Görev bulunamadı.' });
  if (existing.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Yalnızca görev sahibi tamamlayıp puanlayabilir.' });
  }
  if (existing.status !== 'assigned') {
    return res.status(409).json({ error: 'Yalnızca üstlenilmiş görevler tamamlanabilir.' });
  }

  const task = await taskModel.completeTask(id, req.user.id, req.body.rating);
  if (!task) {
    return res.status(409).json({ error: 'Görev tamamlanamadı, tekrar deneyin.' });
  }
  res.json({ message: 'Görev tamamlandı ve puanlandı.', task: serialize(task) });
});

module.exports = { listOpen, listMine, listTaken, create, accept, complete, queueForCourthouse };
