const { q } = require('../config/db');

// Hapus semua session milik user (kecuali session yang sedang dipakai).
// Dipakai untuk "satu akun, satu sesi", ganti/reset password, tolak dan hapus akun.
exports.killUserSessions = (userId, exceptSessionId = '') =>
  q(
    `DELETE FROM sessions
      WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) AS UNSIGNED) = ?
        AND session_id <> ?`,
    [userId, exceptSessionId]
  );
