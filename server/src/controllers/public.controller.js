const { query } = require('../config/db');
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

module.exports = { stats };
