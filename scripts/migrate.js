
// Menjalankan database/schema.sql. Aman dijalankan berulang.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  let conn;

  for (let i = 1; i <= 30; i++) {
    try {
      conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3308),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
      });
      break;
    } catch (e) {
      console.log(`Menunggu database (${i}/30): ${e.code || e.message}`);
      await sleep(2000);
    }
  }

  if (!conn) {
    console.error('Tidak bisa terhubung ke database.');
    process.exit(1);
  }

  try {
    await conn.query(sql);

    // Upgrade kolom users untuk database lama.
    const [userCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );

    const userHave = new Set(userCols.map((c) => c.COLUMN_NAME));

    const userTambah = {
      no_hp: 'VARCHAR(20) NULL',
      program_studi: 'VARCHAR(100) NULL',
      angkatan: 'SMALLINT UNSIGNED NULL',
      departemen: 'VARCHAR(100) NULL',
      jabatan: 'VARCHAR(100) NULL',
      last_login_at: 'DATETIME NULL'
    };

    for (const [nama, def] of Object.entries(userTambah)) {
      if (!userHave.has(nama)) {
        await conn.query(`ALTER TABLE users ADD COLUMN ${nama} ${def}`);
        console.log(`Kolom users.${nama} ditambahkan.`);
      }
    }

    await conn.query(
      "ALTER TABLE users MODIFY status ENUM('pending','aktif','ditolak','nonaktif') NOT NULL DEFAULT 'pending'"
    );

    // Upgrade tabel password_resets untuk OTP.
    const [resetCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_resets'"
    );

    const resetHave = new Set(resetCols.map((c) => c.COLUMN_NAME));

    const resetTambah = {
      attempts: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
      verified_at: 'DATETIME NULL'
    };

    for (const [nama, def] of Object.entries(resetTambah)) {
      if (!resetHave.has(nama)) {
        await conn.query(`ALTER TABLE password_resets ADD COLUMN ${nama} ${def}`);
        console.log(`Kolom password_resets.${nama} ditambahkan.`);
      }
    }

    console.log('Skema database siap.');
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error('Migrasi database gagal:', e.message);
  process.exit(1);
});
