
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { q, one, pool } = require('../server/config/db');

const akun = [
  {
    nama: 'Admin Cekin',
    email: 'admin@cekin.test',
    nim_nip: 'admin',
    role: 'admin',
    password: 'CekinAdmin2026!'
  },
  {
    nama: 'Dosen Contoh',
    email: 'dosen@cekin.test',
    nim_nip: '198001012010011001',
    role: 'dosen',
    password: 'CekinDosen2026!'
  },
  {
    nama: 'Mahasiswa Contoh',
    email: 'mahasiswa@cekin.test',
    nim_nip: '2210001',
    role: 'mahasiswa',
    password: 'CekinMhs2026!'
  }
];

(async () => {
  try {
    for (const a of akun) {
      const hash = await bcrypt.hash(a.password, 12);
      const existing = await one(
        'SELECT id FROM users WHERE email = ?',
        [a.email]
      );

      if (existing) {
        await q(
          `UPDATE users
           SET nama = ?, nim_nip = ?, password_hash = ?, role = ?, status = 'aktif'
           WHERE email = ?`,
          [a.nama, a.nim_nip, hash, a.role, a.email]
        );

        console.log(`Password diperbarui: ${a.email}`);
      } else {
        await q(
          `INSERT INTO users
           (nama, email, nim_nip, password_hash, role, status)
           VALUES (?, ?, ?, ?, ?, 'aktif')`,
          [a.nama, a.email, a.nim_nip, hash, a.role]
        );

        console.log(`Akun dibuat: ${a.email}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
