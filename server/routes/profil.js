const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../config/db');
const V = require('../lib/validate');
const { publicUser } = require('../lib/helpers');
const { killUserSessions } = require('../lib/sessions');
const { USER_COLS } = require('../middleware/auth');

const opsional = (v, max) => (String(v ?? '').trim() === '' ? { ok: true, val: null } : V.str(v, { max }) ? { ok: true, val: String(v).trim() } : { ok: false });

// Edit profil sendiri. Email, NIM/NIP/username, dan peran hanya bisa diubah administrator.
router.put('/', async (req, res) => {
  const b = req.body;
  const errors = [];
  const nama = V.str(b.nama, { min: 2, max: 100 });
  if (!nama) errors.push('Nama wajib diisi (2-100 karakter).');

  const hp = String(b.no_hp ?? '').trim();
  if (hp && !/^[0-9+\-\s]{6,20}$/.test(hp)) errors.push('No. HP hanya boleh angka, spasi, + atau - (6-20 karakter).');

  let { program_studi, angkatan, departemen, jabatan } = req.user;
  if (req.user.role === 'mahasiswa') {
    const ps = opsional(b.program_studi, 100);
    if (!ps.ok) errors.push('Program studi maksimal 100 karakter.');
    else program_studi = ps.val;
    if (String(b.angkatan ?? '').trim() === '') angkatan = null;
    else {
      const a = V.int(b.angkatan, { min: 1990, max: new Date().getFullYear() + 1 });
      if (!a) errors.push('Angkatan harus berupa tahun, mis. 2022.');
      else angkatan = a;
    }
  } else if (req.user.role === 'dosen') {
    const d = opsional(b.departemen, 100);
    const j = opsional(b.jabatan, 100);
    if (!d.ok) errors.push('Departemen maksimal 100 karakter.'); else departemen = d.val;
    if (!j.ok) errors.push('Jabatan maksimal 100 karakter.'); else jabatan = j.val;
  }
  if (errors.length) return res.status(400).json({ errors });

  await q('UPDATE users SET nama = ?, no_hp = ?, program_studi = ?, angkatan = ?, departemen = ?, jabatan = ? WHERE id = ?',
    [nama, hp || null, program_studi ?? null, angkatan ?? null, departemen ?? null, jabatan ?? null, req.user.id]);
  const fresh = await one(`SELECT ${USER_COLS} FROM users WHERE id = ?`, [req.user.id]);
  res.json({ user: publicUser(fresh), message: 'Profil diperbarui.' });
});

router.post('/password', async (req, res) => {
  const { lama, baru, konfirmasi } = req.body;
  const errors = [];
  const row = await one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (typeof lama !== 'string' || !(await bcrypt.compare(lama, row.password_hash))) errors.push('Kata sandi saat ini salah.');
  const pwErr = V.passwordError(baru);
  if (pwErr) errors.push(pwErr);
  else if (baru !== konfirmasi) errors.push('Konfirmasi kata sandi baru tidak sama.');
  else if (baru === lama) errors.push('Kata sandi baru harus berbeda dari yang lama.');
  if (errors.length) return res.status(400).json({ errors });

  await q('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(baru, 12), req.user.id]);
  await killUserSessions(req.user.id, req.sessionID); // keluarkan perangkat lain
  res.json({ message: 'Kata sandi diganti. Perangkat lain sudah dikeluarkan.' });
});

module.exports = router;
