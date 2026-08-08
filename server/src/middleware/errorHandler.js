// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  // PostgreSQL unique violation (yarış durumu vb. — controller içinde yakalanmayan)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Bu kayıt zaten mevcut.' });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Sunucu hatası oluştu.' : err.message,
  });
}

module.exports = errorHandler;
