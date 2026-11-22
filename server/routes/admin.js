const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../config/db');
const V = require('../lib/validate');
const { tempPassword } = require('../lib/helpers');
const { killUserSessions } = require('../lib/sessions');
const { requireRole } = require('../middleware/auth');

router.use(requireRole('admin')); // hak akses dicek di server, bukan hanya disembunyikan di UI

const STATUSES = ['pending', 'aktif', 'ditolak', 'nonaktif'];
const ROLES = ['admin', 'dosen', 'mahasiswa'];

router.get('/akun', async (req, res) => {
  const status = V.oneOf(req.query.status, STATUSES);
  const role = V.oneOf(req.query.role, ROLES);
  const cari = V.str(req.query.q, { max: 100 }) || '';

  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (role) { where.push('role = ?'); params.push(role); }
  if (cari) {
    where.push('(nama LIKE ? OR email LIKE ? OR nim_nip LIKE ?)');
    const like = `%${cari.replace(/[%_\\]/g, '\\$&')}%`;
    params.push(like, like, like);
  }
  const rows = await q(
    `SELECT id, nama, email, nim_nip, role, status, created_at FROM users
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 200`,
    params
  );
  const hitung = await q('SELECT status, COUNT(*) AS n FROM users GROUP BY status');
  const count = { pending: 0, aktif: 0, ditolak: 0, nonaktif: 0, ...Object.fromEntries(hitung.map((h) => [h.status, h.n])) };
  res.json({ rows, count });
});

router.post('/akun', async (req, res) => {
  const b = req.body;
  const errors = [];
  const nama = V.str(b.nama, { min: 2, max: 100 });
  const email = V.email(b.email);
  const role = V.oneOf(b.role, ROLES);
  const nimNip = b.nim_nip ? V.nimNip(b.nim_nip) : null;
  const pwErr = V.passwordError(b.password);
  if (!nama) errors.push('Nama wajib diisi (2-100 karakter).');
  if (!email) errors.push('Format email tidak valid.');
  if (!role) errors.push('Peran tidak valid.');
  if (b.nim_nip && !nimNip) errors.push('NIM/NIP hanya boleh huruf, angka, titik, strip.');
  if (pwErr) errors.push(pwErr);
  if (errors.length) return res.status(400).json({ errors });

  try {
    await q('INSERT INTO users (nama, email, nim_nip, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)', [nama, email, nimNip, await bcrypt.hash(b.password, 12), role, 'aktif']);
  } catch (e) {
    if (e.code !== 'ER_DUP_ENTRY') throw e;
    return res.status(409).json({ errors: [/nim_nip/.test(e.message) ? 'NIM/NIP sudah terdaftar.' : 'Email sudah terdaftar.'] });
  }
  res.status(201).json({ message: `Akun ${nama} dibuat dan langsung aktif.` });
});

async function target(req, res) {
  const id = V.int(req.params.id, { min: 1 });
  const u = id && (await one('SELECT id, nama, role, status FROM users WHERE id = ?', [id]));
  if (!u) { res.status(404).json({ error: 'Akun tidak ditemukan.' }); return null; }
  return u;
}

router.post('/akun/:id/setuju', async (req, res) => {
  const u = await target(req, res); if (!u) return;
  await q(`UPDATE users SET status = 'aktif' WHERE id = ?`, [u.id]);
  res.json({ message: `Akun ${u.nama} disetujui.` });
});

router.post('/akun/:id/tolak', async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (u.id === req.user.id) return res.status(400).json({ error: 'Kamu tidak bisa menolak akunmu sendiri.' });
  await q(`UPDATE users SET status = 'ditolak' WHERE id = ?`, [u.id]);
  await killUserSessions(u.id);
  res.json({ message: `Akun ${u.nama} ditolak.` });
});

router.post('/akun/:id/nonaktif', async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (u.id === req.user.id) return res.status(400).json({ error: 'Kamu tidak bisa menonaktifkan akunmu sendiri.' });
  if (u.status !== 'aktif') return res.status(400).json({ error: 'Hanya akun aktif yang bisa dinonaktifkan.' });
  await q(`UPDATE users SET status = 'nonaktif' WHERE id = ?`, [u.id]);
  await killUserSessions(u.id);
  res.json({ message: `Akun ${u.nama} dinonaktifkan.` });
});

router.post('/akun/:id/aktifkan', async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (u.status !== 'nonaktif') return res.status(400).json({ error: 'Hanya akun nonaktif yang bisa diaktifkan kembali.' });
  await q(`UPDATE users SET status = 'aktif' WHERE id = ?`, [u.id]);
  res.json({ message: `Akun ${u.nama} diaktifkan kembali.` });
});

router.post('/akun/:id/reset', async (req, res) => {
  const u = await target(req, res); if (!u) return;
  const pw = tempPassword();
  await q('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(pw, 12), u.id]);
  await killUserSessions(u.id);
  res.json({ message: `Kata sandi ${u.nama} direset.`, nama: u.nama, tempPassword: pw });
});

router.post('/akun/:id/hapus', async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (u.id === req.user.id) return res.status(400).json({ error: 'Kamu tidak bisa menghapus akunmu sendiri.' });
  await killUserSessions(u.id);
  await q('DELETE FROM users WHERE id = ?', [u.id]);
  res.json({ message: `Akun ${u.nama} dihapus.` });
});

module.exports = router;
