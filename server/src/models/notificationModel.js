const { query } = require('../config/db');

async function create({ userId, type, title, body, taskId = null }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, task_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, title, body || null, taskId]
  );
  return rows[0];
}

/** Birden fazla kullanıcıya aynı bildirimi tek sorguda oluşturur. */
async function createMany(userIds, { type, title, body, taskId = null }) {
  if (userIds.length === 0) return [];
  const values = [];
  const params = [];
  userIds.forEach((userId, i) => {
    const base = i * 5;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    params.push(userId, type, title, body || null, taskId);
  });
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, task_id)
     VALUES ${values.join(', ')} RETURNING *`,
    params
  );
  return rows;
}

async function listForUser(userId, { onlyUnread = false, limit = 30 } = {}) {
  const { rows } = await query(
    `SELECT * FROM notifications
      WHERE user_id = $1 ${onlyUnread ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function countUnread(userId) {
  const { rows } = await query(
    'SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
  return Number(rows[0].count);
}

async function markRead(id, userId) {
  const { rows } = await query(
    'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING *',
    [id, userId]
  );
  return rows[0] || null;
}

async function markAllRead(userId) {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
}

module.exports = { create, createMany, listForUser, countUnread, markRead, markAllRead };
