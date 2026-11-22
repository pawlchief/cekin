const crypto = require('crypto');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = {
  esc,
  publicUser: (u) => ({
    id: u.id, nama: u.nama, email: u.email, nim_nip: u.nim_nip, role: u.role, status: u.status,
    no_hp: u.no_hp ?? null, program_studi: u.program_studi ?? null, angkatan: u.angkatan ?? null,
    departemen: u.departemen ?? null, jabatan: u.jabatan ?? null,
    last_login_at: u.last_login_at ?? null, created_at: u.created_at ?? null
  }),
  newCsrf: () => crypto.randomBytes(24).toString('hex'),
  sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
  tempPassword: () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 11; i++) p += a[crypto.randomInt(a.length)];
    return p + crypto.randomInt(2, 10); // pastikan ada angka
  }
};
