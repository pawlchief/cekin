const { one } = require('../config/db');

const USER_COLS = 'id, nama, email, nim_nip, role, status, no_hp, program_studi, angkatan, departemen, jabatan, last_login_at, created_at';

// Muat user dari database di setiap request, supaya akun yang dihapus,
// ditolak, atau diubah admin langsung kehilangan akses.
async function loadUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const u = await one(`SELECT ${USER_COLS} FROM users WHERE id = ?`, [req.session.userId]);
      if (u && u.status === 'aktif') {
        req.user = u;
        return next();
      }
      return req.session.destroy(() => next());
    }
    next();
  } catch (e) {
    next(e);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Perananmu tidak punya izin untuk tindakan ini.' });
  };
}

module.exports = { loadUser, requireLogin, requireRole, USER_COLS };
