const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3308),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true
});

// Semua query memakai parameterized query (placeholder ?), tidak ada string concat dari input.
const q = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};
const one = async (sql, params = []) => (await q(sql, params))[0] || null;

module.exports = { pool, q, one, dbConfig };
