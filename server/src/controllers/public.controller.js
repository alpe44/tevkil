const { query } = require('../config/db');
const taskModel = require('../models/taskModel');
const asyncHandler = require('../utils/asyncHandler');

// Herkese açık, kimlik gerektirmeyen basit sayaçlar (ana sayfa istatistik şeridi için).
const stats = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
       (SELECT count(*) FROM users WHERE role = 'lawyer' AND status = 'approved') AS approved_lawyers,
       (SELECT count(*) FROM tasks) AS total_tasks,
       (SELECT count(*) FROM tasks WHERE status = 'completed') AS completed_tasks`
  );
  const r = rows[0];
  res.json({
    approvedLawyers: Number(r.approved_lawyers),
    totalTasks: Number(r.total_tasks),
    completedTasks: Number(r.completed_tasks),
  });
});

// Admin onaylı yorumu olan, en yeni tamamlanan görevler — "Tamamlananlar" vitrini.
const completed = asyncHandler(async (req, res) => {
  const tasks = await taskModel.listApprovedCommentsPublic(20);
  res.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      city: t.city,
      rating: t.rating,
      comment: t.comment,
      assigneeName: t.assignee_name,
      ownerName: t.owner_name,
      completedAt: t.completed_at,
    })),
  });
});

module.exports = { stats, completed };
