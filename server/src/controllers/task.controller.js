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
    taskType: t.task_type,
    budget: t.budget,
    dueTime: t.due_time,
    isOffSite: t.is_off_site,
    offSiteAddress: t.off_site_address,
  };
}

/** "Ayşe Yılmaz" -> "Ayşe Yı" — Görev Takibi'nde onaylanana kadar kimliği kısmen gizler. */
function partialName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts.slice(0, -1).join(' ');
  const lastInitials = parts[parts.length - 1].slice(0, 2);
  return first + ' ' + lastInitials;
}

/**
 * Bir adliyedeki onaylı avukatların "adil sıra" önceliğini gösterir (bkz.
 * userModel.listApprovedByCourthouseInQueueOrder) — Görev Takibi'ndeki başvuru
 * sıralamasıyla aynı ölçütü kullanır, görev oluşturma formunda önizleme sağlar.
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
  const { title, description, city, dueDate, taskType, budget, dueTime, isOffSite, offSiteAddress } = req.body;
  const offSite = isOffSite === true || isOffSite === 'true';
  const task = await taskModel.createTask({
    ownerId: req.user.id,
    title: title.trim(),
    description: description.trim(),
    city: city.trim(),
    dueDate: dueDate || null,
    taskType: taskType.trim(),
    budget: budget ? budget.trim() : null,
    dueTime: dueTime || null,
    isOffSite: offSite,
    offSiteAddress: offSite ? (offSiteAddress || '').trim() : null,
  });
  fireAndForget(notifyService.notifyTaskOpenMatch(task));
  res.status(201).json({ message: 'Görev yayınlandı.', task: serialize(task) });
});

/**
 * Bir avukat bir göreve BAŞVURUR — görev hemen üstlenilmiş olmaz, görev sahibinin
 * "Görev Takibi" ekranından onaylamasını bekler. Aynı kişi bir göreve yalnızca bir kez
 * başvurabilir.
 */
const apply = asyncHandler(async (req, res) => {
  if (!handleValidation(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz görev id.' });

  const existing = await taskModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Görev bulunamadı.' });
  if (existing.owner_id === req.user.id) {
    return res.status(400).json({ error: 'Kendi görevinize başvuramazsınız.' });
  }
  if (existing.status !== 'open') {
    return res.status(409).json({ error: 'Bu görev artık uygun değil (başka birine verilmiş olabilir).' });
  }

  const { phone, contactAddress, note } = req.body;
  const application = await taskModel.createApplication({
    taskId: id,
    applicantId: req.user.id,
    phone,
    contactAddress,
    note,
  });
  if (!application) {
    return res.status(409).json({ error: 'Bu göreve zaten başvurdunuz.' });
  }
  fireAndForget(notifyService.notifyNewApplication(existing, req.user));
  res.status(201).json({ message: 'Başvurunuz alındı. Görev sahibi onayladığında bilgilendirileceksiniz.' });
});

/**
 * Görev sahibinin kendi açık görevlerine gelen bekleyen başvurularını, adil sıraya
 * göre sıralanmış ve isim/adres kısmen görünür şekilde listeler ("Görev Takibi").
 */
const listMyApplications = asyncHandler(async (req, res) => {
  const rows = await taskModel.listPendingApplicationsForOwner(req.user.id);

  const taskMap = new Map();
  for (const r of rows) {
    if (!taskMap.has(r.task_id)) {
      taskMap.set(r.task_id, { taskId: r.task_id, title: r.task_title, city: r.task_city, applications: [] });
    }
    taskMap.get(r.task_id).applications.push({
      applicationId: r.application_id,
      applicantId: r.applicant_id,
      displayName: partialName(r.applicant_name),
      address: r.contact_address,
      appliedAt: r.applied_at,
    });
  }
  res.json({ tasks: Array.from(taskMap.values()) });
});

/** Görev sahibi bir başvuruyu onaylar: görev o kişiye atanır, diğer bekleyenler otomatik reddedilir. */
const approveApplication = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const applicantId = Number(req.params.applicantId);
  if (!Number.isInteger(id) || !Number.isInteger(applicantId)) {
    return res.status(400).json({ error: 'Geçersiz istek.' });
  }

  const existing = await taskModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Görev bulunamadı.' });
  if (existing.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Yalnızca görev sahibi başvuru onaylayabilir.' });
  }

  const result = await taskModel.approveApplication(id, applicantId);
  if (!result) {
    return res.status(409).json({ error: 'Bu başvuru artık geçerli değil (görev başkasına verilmiş olabilir).' });
  }

  fireAndForget(notifyService.notifyApplicationApproved(result.task));
  fireAndForget(
    Promise.all(
      result.autoRejectedApplicantIds.map(async (uid) => {
        const u = await userModel.findById(uid);
        if (u) await notifyService.notifyApplicationAutoRejected(u, existing);
      })
    )
  );
  res.json({ message: 'Başvuru onaylandı, görev üstlendirildi.', task: serialize(result.task) });
});

/** Görev sahibi tek bir başvuruyu (görev hâlâ açıkken) reddeder. */
const rejectApplication = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const applicantId = Number(req.params.applicantId);
  if (!Number.isInteger(id) || !Number.isInteger(applicantId)) {
    return res.status(400).json({ error: 'Geçersiz istek.' });
  }

  const existing = await taskModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Görev bulunamadı.' });
  if (existing.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Yalnızca görev sahibi başvuru reddedebilir.' });
  }

  const rejected = await taskModel.rejectApplication(id, applicantId);
  if (!rejected) {
    return res.status(409).json({ error: 'Bu başvuru artık geçerli değil.' });
  }

  const applicant = await userModel.findById(applicantId);
  if (applicant) fireAndForget(notifyService.notifyApplicationRejected(applicant, existing));
  res.json({ message: 'Başvuru reddedildi.' });
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

module.exports = {
  listOpen,
  listMine,
  listTaken,
  create,
  apply,
  listMyApplications,
  approveApplication,
  rejectApplication,
  complete,
  queueForCourthouse,
};
