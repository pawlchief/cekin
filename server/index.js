const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('express-async-errors');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');

const { dbConfig } = require('./config/db');
const { loadUser, requireLogin } = require('./middleware/auth');
const csrf = require('./middleware/csrf');

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  console.error('SESSION_SECRET belum diisi atau kurang dari 32 karakter. Lihat .env.example.');
  process.exit(1);
}
const secureCookie = process.env.COOKIE_SECURE === 'true';

const app = express();
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: secureCookie ? [] : null
      }
    }
  })
);
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// ---------- API ----------
const api = express.Router();
api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
api.use(express.json({ limit: '50kb' }));
api.use(
  session({
    name: 'APP_SESSION',
    secret,
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore({ ...dbConfig, clearExpired: true, checkExpirationInterval: 15 * 60 * 1000, expiration: 24 * 60 * 60 * 1000, createDatabaseTable: false }),
    cookie: { httpOnly: true, secure: secureCookie, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 }
  })
);
api.use(csrf);
api.use(loadUser);
api.use('/auth', require('./routes/auth'));
api.use(requireLogin); // semua endpoint di bawah ini wajib login
api.use('/dashboard', require('./routes/dashboard'));
api.use('/profil', require('./routes/profil'));
api.use('/admin', require('./routes/admin'));
// Anggota lain: pasang router modulmu di bawah baris ini, mis. api.use('/kelas', require('./routes/kelas'));
api.use('/mata-kuliah', require('./routes/mataKuliah'));
api.use('/kelas', require('./routes/kelas'));
api.use('/rekap', require('./routes/rekap'));
api.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
app.use('/api', api);
// ---------- React (hasil build) ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '7d' }));
  app.get('*', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format permintaan tidak valid.' });
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API Cekin berjalan di http://localhost:${port}`));
