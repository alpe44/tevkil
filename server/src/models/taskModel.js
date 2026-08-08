const { query } = require('../config/db');

const BASE_SELECT = `
  SELECT
    t.id, t.title, t.description, t.city, t.due_date, t.status, t.rating,
    t.created_at, t.assigned_at, t.completed_at,
    t.acceptance_phone, t.acceptance_contact, t.acceptance_note,
    t.task_type, t.budget, t.due_time, t.is_off_site, t.off_site_address,
    t.owner_id, ou.full_name AS owner_name,
    t.assignee_id, au.full_name AS assignee_name
  FROM tasks t
  JOIN users ou ON ou.id = t.owner_id
  LEFT JOIN users au ON au.id = t.assignee_id
`;

async function findById(id) {
  const { rows } = await query(`${BASE_SELECT} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

async function createTask({
  ownerId, title, description, city, dueDate,
  taskType, budget, dueTime, isOffSite, offSiteAddress,
}) {
  const { rows } = await query(
    `INSERT INTO tasks (owner_id, title, description, city, due_date, task_type, budget, due_time, is_off_site, off_site_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      ownerId, title, description, city, dueDate || null,
      taskType || null, budget || null, dueTime || null, Boolean(isOffSite), isOffSite ? offSiteAddress : null,
    ]
  );
  return findById(rows[0].id);
}

async function listOpen() {
  const { rows } = await query(`${BASE_SELECT} WHERE t.status = 'open' ORDER BY t.created_at DESC`);
  return rows;
}

async function listByOwner(ownerId) {
  const { rows } = await query(`${BASE_SELECT} WHERE t.owner_id = $1 ORDER BY t.created_at DESC`, [ownerId]);
  return rows;
}

async function listByAssignee(assigneeId) {
  const { rows } = await query(`${BASE_SELECT} WHERE t.assignee_id = $1 ORDER BY t.created_at DESC`, [assigneeId]);
  return rows;
}

/**
 * Atomik kabul: satır yalnızca hâlâ 'open' ise VE görev sahibi kabul eden kişi değilse güncellenir.
 * İki avukat aynı anda kabul etmeye çalışırsa sadece biri UPDATE'i "kazanır" (yarış durumuna karşı korumalı).
 */
async function acceptTask(taskId, assigneeId, { phone, contactAddress, note } = {}) {
  const { rows } = await query(
    `UPDATE tasks
        SET status = 'assigned', assignee_id = $2, assigned_at = now(),
            acceptance_phone = $3, acceptance_contact = $4, acceptance_note = $5
      WHERE id = $1 AND status = 'open' AND owner_id <> $2
      RETURNING id`,
    [taskId, assigneeId, phone || null, contactAddress || null, note || null]
  );
  return rows.length ? findById(taskId) : null;
}

/**
 * Atomik tamamlama: yalnızca görev sahibi VE görev hâlâ 'assigned' durumundaysa günceller.
 */
async function completeTask(taskId, ownerId, rating) {
  const { rows } = await query(
    `UPDATE tasks
        SET status = 'completed', rating = $3, completed_at = now()
      WHERE id = $1 AND owner_id = $2 AND status = 'assigned'
      RETURNING id`,
    [taskId, ownerId, rating]
  );
  return rows.length ? findById(taskId) : null;
}

/** Bir kullanıcının profil sayaçlarını (görev tablosundan canlı) hesaplar. */
async function getUserStats(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT count(*) FROM tasks WHERE owner_id = $1) AS created_count,
       (SELECT count(*) FROM tasks WHERE assignee_id = $1 AND status = 'completed') AS completed_count,
       (SELECT round(avg(rating)::numeric, 1) FROM tasks WHERE assignee_id = $1 AND rating IS NOT NULL) AS rating_avg`,
    [userId]
  );
  const r = rows[0];
  return {
    createdCount: Number(r.created_count),
    completedCount: Number(r.completed_count),
    ratingAvg: r.rating_avg !== null ? Number(r.rating_avg) : null,
  };
}

module.exports = {
  findById,
  createTask,
  listOpen,
  listByOwner,
  listByAssignee,
  acceptTask,
  completeTask,
  getUserStats,
};
