
require('dotenv').config();
const { q, pool } = require('./server/config/db');

(async () => {
  try {
    const akun = await q(
      'SELECT id, nama, email, nim_nip, role, status FROM users'
    );
    console.table(akun);
  } catch (err) {
    console.error('Gagal:', err.message);
  } finally {
    await pool.end();
  }
})();
