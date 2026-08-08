/**
 * Basit migration runner.
 * server/src/db/migrations/ altındaki *.sql dosyalarını dosya adı sırasına göre
 * çalıştırır; hangilerinin uygulandığını schema_migrations tablosunda tutar.
 *
 * Kullanım:  npm run migrate   (server/ klasöründen)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('[migrate] Uygulanacak yeni migration yok. Veritabanı güncel.');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] Uygulanıyor: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] OK: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration başarısız (${file}): ${err.message}`);
      }
    }

    console.log(`[migrate] Tamamlandı. ${pending.length} migration uygulandı.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[migrate] Hata:', err.message);
  process.exit(1);
});
