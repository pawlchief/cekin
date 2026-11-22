const crypto = require('crypto');
const { newCsrf } = require('../lib/helpers');

// Token CSRF disimpan di session; React mengirimnya lewat header X-CSRF-Token
// (ambil dari GET /api/auth/csrf). Cookie juga SameSite=Strict.
module.exports = (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = newCsrf();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = Buffer.from(String(req.get('x-csrf-token') || ''));
  const real = Buffer.from(req.session.csrf);
  if (sent.length === real.length && crypto.timingSafeEqual(sent, real)) return next();
  res.status(403).json({ code: 'CSRF', error: 'Token keamanan tidak valid. Muat ulang halaman.' });
};
