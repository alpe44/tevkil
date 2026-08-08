const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  // .env henüz yüklenmemiş olabilir (örn. migrate.js doğrudan çalıştırıldığında)
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[db] Beklenmeyen PostgreSQL havuz hatası:', err);
  process.exit(1);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
