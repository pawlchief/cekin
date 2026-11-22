const router = require('express').Router();
const { q, one } = require('../config/db');

router.get('/', async (req, res) => {
  if (req.user.role !== 'admin') return res.json({});
  const stat = await one(
    `SELECT (SELECT COUNT(*) FROM users WHERE status = 'aktif') AS total,
            (SELECT COUNT(*) FROM users WHERE role = 'dosen' AND status = 'aktif') AS dosen,
            (SELECT COUNT(*) FROM users WHERE role = 'mahasiswa' AND status = 'aktif') AS mahasiswa,
            (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending`
  );
  const pending = await q(`SELECT id, nama, nim_nip, role, created_at FROM users WHERE status = 'pending' ORDER BY created_at LIMIT 5`);
  res.json({ stat, pending });
});

module.exports = router;
