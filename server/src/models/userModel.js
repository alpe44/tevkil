const { query } = require('../config/db');

const PUBLIC_COLUMNS = `
  id, full_name, email, phone, bar_association, bar_registry_no, province, courthouse,
  bio, role, status, rating_avg, completed_count, created_count, created_at, approved_at,
  avatar_status, avatar_uploaded_at, avatar_rejection_reason
`;

async function createUser({ fullName, email, passwordHash, phone, barAssociation, barRegistryNo, province, courthouse, bio, avatarFilename }) {
  const { rows } = await query(
    `INSERT INTO users
      (full_name, email, password_hash, phone, bar_association, bar_registry_no, province, courthouse, bio,
       avatar_filename, avatar_status, avatar_uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ${avatarFilename ? 'now()' : 'NULL'})
     RETURNING ${PUBLIC_COLUMNS}`,
    [
      fullName, email, passwordHash, phone, barAssociation, barRegistryNo, province, courthouse, bio || null,
      avatarFilename || null, avatarFilename ? 'pending' : 'none',
    ]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByBarRegistry(barAssociation, barRegistryNo) {
  const { rows } = await query(
    'SELECT id FROM users WHERE bar_association = $1 AND bar_registry_no = $2',
    [barAssociation, barRegistryNo]
  );
  return rows[0] || null;
}

/**
 * Bir adliyede kayıtlı, onaylı avukatları "adil sıra" önceliğine göre sıralı döner:
 * en az görev üstlenmiş / en uzun süredir görev almamış avukat en başta.
 * (Bkz. taskModel — bildirim gönderim sırası ve "sıradakiler" gösterimi bunu kullanır.)
 */
async function listApprovedByCourthouseInQueueOrder(courthouse, { excludeUserId = null } = {}) {
  const { rows } = await query(
    `SELECT
        u.id, u.full_name, u.email, u.bar_association, u.bar_registry_no,
        u.province, u.courthouse, u.created_at,
        count(t.id) FILTER (WHERE t.status = 'completed') AS recent_completed,
        max(t.completed_at) AS last_completed_at
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id
      WHERE u.role = 'lawyer' AND u.status = 'approved' AND u.courthouse = $1
            ${excludeUserId ? 'AND u.id <> $2' : ''}
      GROUP BY u.id
      ORDER BY recent_completed ASC NULLS FIRST, last_completed_at ASC NULLS FIRST, u.created_at ASC`,
    excludeUserId ? [courthouse, excludeUserId] : [courthouse]
  );
  return rows;
}

async function listByStatus(status) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE status = $1 ORDER BY created_at ASC`,
    [status]
  );
  return rows;
}

async function setStatus(id, status, { rejectionReason = null } = {}) {
  // $2'yi her iki kullanımda da açıkça user_status'a cast ediyoruz — aksi halde Postgres,
  // "status = $2" (enum bağlamı) ile "$2 = 'approved'" (CASE içindeki metin karşılaştırması)
  // arasında $2 için tutarsız tip çıkarımı yapıp "inconsistent types deduced for parameter"
  // hatası veriyor (özellikle birden fazla enum tipi olduğunda).
  const { rows } = await query(
    `UPDATE users
        SET status = $2::user_status,
            rejection_reason = $3,
            approved_at = CASE WHEN $2::user_status = 'approved' THEN now() ELSE approved_at END
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [id, status, rejectionReason]
  );
  return rows[0] || null;
}

/** Ham dosya adı + durumu döner — yalnızca dosya servis eden controller içindir, PUBLIC_COLUMNS'a
 * girmez ki avatar_filename API yanıtlarında sızmasın (dosyalar yalnızca /api/users/:id/avatar
 * üzerinden, görünürlük kontrolünden geçerek servis edilir). */
async function findAvatarRecord(id) {
  const { rows } = await query(
    'SELECT id, avatar_filename, avatar_status FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/** Yeni fotoğraf yüklenince: durum daima 'pending'e döner (admin yeniden onaylamalı).
 * Silinmesi gereken eski dosya adını (varsa) döner. */
async function setAvatar(userId, filename) {
  const { rows: before } = await query('SELECT avatar_filename FROM users WHERE id = $1', [userId]);
  const oldFilename = before[0] ? before[0].avatar_filename : null;

  await query(
    `UPDATE users
        SET avatar_filename = $2,
            avatar_status = 'pending',
            avatar_uploaded_at = now(),
            avatar_rejection_reason = NULL
      WHERE id = $1`,
    [userId, filename]
  );
  return { oldFilename };
}

async function setAvatarStatus(id, status, { rejectionReason = null } = {}) {
  const { rows } = await query(
    `UPDATE users
        SET avatar_status = $2,
            avatar_rejection_reason = $3
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [id, status, rejectionReason]
  );
  return rows[0] || null;
}

async function listByAvatarStatus(status) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE avatar_status = $1 ORDER BY avatar_uploaded_at ASC`,
    [status]
  );
  return rows;
}

async function setResetToken(userId, tokenHash, expiresAt) {
  await query(
    'UPDATE users SET reset_token_hash = $2, reset_token_expires_at = $3 WHERE id = $1',
    [userId, tokenHash, expiresAt]
  );
}

async function findByValidResetTokenHash(tokenHash) {
  const { rows } = await query(
    `SELECT * FROM users
      WHERE reset_token_hash = $1 AND reset_token_expires_at IS NOT NULL AND reset_token_expires_at > now()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function setPasswordAndClearResetToken(userId, passwordHash) {
  await query(
    `UPDATE users
        SET password_hash = $2, reset_token_hash = NULL, reset_token_expires_at = NULL
      WHERE id = $1`,
    [userId, passwordHash]
  );
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  findByBarRegistry,
  listByStatus,
  listApprovedByCourthouseInQueueOrder,
  setStatus,
  setResetToken,
  findByValidResetTokenHash,
  setPasswordAndClearResetToken,
  findAvatarRecord,
  setAvatar,
  setAvatarStatus,
  listByAvatarStatus,
  PUBLIC_COLUMNS,
};
