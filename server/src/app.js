const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { apiLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const taskRoutes = require('./routes/task.routes');
const notificationRoutes = require('./routes/notification.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Reverse proxy arkasında çalışıyorsanız (Nginx, Render, vb.) gerçek istemci IP'sini
// görebilmek için TRUST_PROXY=1 ayarlayın — rate limit'in doğru çalışması için gerekli.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// API
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Statik frontend (prototipin uyarlanmış hâli)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Bilinmeyen /api rotaları için 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Bulunamadı.' }));

app.use(errorHandler);

module.exports = app;
