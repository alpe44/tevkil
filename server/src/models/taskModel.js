const { query, pool } = require('../config/db');

const BASE_SELECT = `
  SELECT
    t.id, t.title, t.description, t.city, t.due_date, t.status, t.rating,
    t.created_at, t.assigned_at, t.completed_at,
    t.acceptance_phone, t.acceptance_contact, t.acceptance_note,
    t.task_type, t.budget, t.due_time, t.is_off_site, t.off_site_address,
    t.comment, t.comment_status, t.comment_rejection_reason,
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
 * Bir avukatın bir göreve BAŞVURUSUNU kaydeder (henüz görev üstlenilmiş olmaz).
 * Aynı kişi aynı göreve iki kez başvuramaz (UNIQUE(task_id, applicant_id)) —
 * çakışma olursa null döner, controller bunu "zaten başvurdunuz" olarak ele alır.
 */
async function createApplication({ taskId, applicantId, phone, contactAddress, note }) {
  try {
    const { rows } = await query(
      `INSERT INTO task_applications (task_id, applicant_id, phone, contact_address, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [taskId, applicantId, phone || null, contactAddress || null, note || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') return null; // unique violation — zaten başvurmuş
    throw err;
  }
}

/**
 * Görev sahibinin, kendi AÇIK görevlerine gelen BEKLEYEN başvurularını listeler.
 * Her görev içinde başvuranlar adil sıra ölçütüyle (en az tamamlanmış görev /
 * en uzun süredir görev almamış önce) sıralanır — onay kararını kolaylaştırmak için.
 */
async function listPendingApplicationsForOwner(ownerId) {
  const { rows } = await query(
    `SELECT
        ta.id AS application_id, ta.task_id, ta.applicant_id, ta.status AS application_status,
        ta.phone, ta.contact_address, ta.note, ta.created_at AS applied_at,
        t.title AS task_title, t.city AS task_city,
        u.full_name AS applicant_name,
        count(ct.id) FILTER (WHERE ct.status = 'completed') AS completed_count,
        max(ct.completed_at) AS last_completed_at
      FROM task_applications ta
      JOIN tasks t ON t.id = ta.task_id
      JOIN users u ON u.id = ta.applicant_id
      LEFT JOIN tasks ct ON ct.assignee_id = u.id
     WHERE t.owner_id = $1 AND t.status = 'open' AND ta.status = 'pending'
     GROUP BY ta.id, t.id, u.id
     ORDER BY t.created_at DESC, completed_count ASC NULLS FIRST, last_completed_at ASC NULLS FIRST, ta.created_at ASC`,
    [ownerId]
  );
  return rows;
}

async function findApplication(taskId, applicantId) {
  const { rows } = await query(
    'SELECT * FROM task_applications WHERE task_id = $1 AND applicant_id = $2',
    [taskId, applicantId]
  );
  return rows[0] || null;
}

/**
 * Görev sahibi bir başvuruyu onaylar: görev o kişiye atanır (tüm iletişim/tevkil
 * bilgileriyle birlikte), aynı görevin diğer bekleyen başvuruları otomatik reddedilir.
 * Tek transaction içinde yapılır; görev artık 'open' değilse (biri elden kaçırmışsa) başarısız olur.
 */
async function approveApplication(taskId, applicantId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appRes = await client.query(
      `SELECT * FROM task_applications WHERE task_id = $1 AND applicant_id = $2 AND status = 'pending'`,
      [taskId, applicantId]
    );
    const application = appRes.rows[0];
    if (!application) {
      await client.query('ROLLBACK');
      return null;
    }

    const taskRes = await client.query(
      `UPDATE tasks
          SET status = 'assigned', assignee_id = $2, assigned_at = now(),
              acceptance_phone = $3, acceptance_contact = $4, acceptance_note = $5
        WHERE id = $1 AND status = 'open' AND owner_id <> $2
        RETURNING id`,
      [taskId, applicantId, application.phone, application.contact_address, application.note]
    );
    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE task_applications SET status = 'approved', decided_at = now() WHERE id = $1`,
      [application.id]
    );
    const rejectedRes = await client.query(
      `UPDATE task_applications
          SET status = 'rejected', decided_at = now()
        WHERE task_id = $1 AND id <> $2 AND status = 'pending'
        RETURNING applicant_id`,
      [taskId, application.id]
    );

    await client.query('COMMIT');
    return { task: await findById(taskId), autoRejectedApplicantIds: rejectedRes.rows.map((r) => r.applicant_id) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Görev sahibi tek bir başvuruyu (henüz onaylamadan) reddeder. */
async function rejectApplication(taskId, applicantId) {
  const { rows } = await query(
    `UPDATE task_applications
        SET status = 'rejected', decided_at = now()
      WHERE task_id = $1 AND applicant_id = $2 AND status = 'pending'
      RETURNING *`,
    [taskId, applicantId]
  );
  return rows[0] || null;
}

/**
 * Atomik tamamlama: yalnızca görev sahibi VE görev hâlâ 'assigned' durumundaysa günceller.
 * Yorum girildiyse admin onayına düşer ('pending'); boşsa yorum yok ('none').
 */
async function completeTask(taskId, ownerId, rating, comment) {
  const trimmedComment = comment ? String(comment).trim() : '';
  const { rows } = await query(
    `UPDATE tasks
        SET status = 'completed', rating = $3, completed_at = now(),
            comment = $4, comment_status = $5
      WHERE id = $1 AND owner_id = $2 AND status = 'assigned'
      RETURNING id`,
    [taskId, ownerId, rating, trimmedComment || null, trimmedComment ? 'pending' : 'none']
  );
  return rows.length ? findById(taskId) : null;
}

/** Admin: onay bekleyen/onaylı/reddedilen yorumları görev+taraf bilgileriyle listeler. */
async function listByCommentStatus(status) {
  const { rows } = await query(
    `${BASE_SELECT} WHERE t.comment_status = $1 ORDER BY t.completed_at DESC`,
    [status]
  );
  return rows;
}

/** Admin: bir yorumu onaylar veya reddeder. */
async function setCommentStatus(taskId, status, { rejectionReason = null } = {}) {
  const { rows } = await query(
    `UPDATE tasks
        SET comment_status = $2, comment_rejection_reason = $3
      WHERE id = $1 AND comment_status = 'pending'
      RETURNING id`,
    [taskId, status, rejectionReason]
  );
  return rows.length ? findById(taskId) : null;
}

/** Herkese açık "Tamamlananlar" vitrini: onaylı yorumu olan, en yeni tamamlanan görevler. */
async function listApprovedCommentsPublic(limit = 20) {
  const { rows } = await query(
    `${BASE_SELECT} WHERE t.comment_status = 'approved' ORDER BY t.completed_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
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
  completeTask,
  getUserStats,
  createApplication,
  listPendingApplicationsForOwner,
  findApplication,
  approveApplication,
  rejectApplication,
  listByCommentStatus,
  setCommentStatus,
  listApprovedCommentsPublic,
};
