const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Semua endpoint di sini hanya untuk dosen dan admin
router.use(requireRole('dosen', 'admin'));

// GET /api/mata-kuliah -> Dosen lihat miliknya, Admin lihat semua (#12, #17)
router.get('/', async (req, res) => {
  if (req.user.role === 'admin') {
    const rows = await q(
      `SELECT mk.*, u.nama AS nama_dosen, u.nim_nip AS nip_dosen
       FROM mata_kuliah mk
       JOIN users u ON u.id = mk.dosen_id
       ORDER BY mk.created_at DESC`
    );
    return res.json({ data: rows });
  }

  const rows = await q(
    `SELECT mk.*, u.nama AS nama_dosen, u.nim_nip AS nip_dosen
     FROM mata_kuliah mk
     JOIN users u ON u.id = mk.dosen_id
     WHERE mk.dosen_id = ?
     ORDER BY mk.created_at DESC`,
    [req.user.id]
  );
  res.json({ data: rows });
});

// GET /api/mata-kuliah/:id -> Detail 1 mata kuliah + daftar kelas di bawahnya
router.get('/:id', async (req, res) => {
  const mk = await one(
    `SELECT mk.*, u.nama AS nama_dosen
     FROM mata_kuliah mk
     JOIN users u ON u.id = mk.dosen_id
     WHERE mk.id = ?`,
    [req.params.id]
  );
  if (!mk) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });

  if (req.user.role === 'dosen' && mk.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu tidak punya akses ke mata kuliah ini.' });
  }

  const kelas = await q(
    `SELECT * FROM kelas WHERE mata_kuliah_id = ? ORDER BY created_at DESC`,
    [mk.id]
  );

  res.json({ data: { ...mk, kelas } });
});

// POST /api/mata-kuliah -> Tambah mata kuliah baru (khusus dosen) (#12)
router.post('/', requireRole('dosen'), async (req, res) => {
  const kode_mk = String(req.body.kode_mk || '').trim().toUpperCase();
  const nama_mk = String(req.body.nama_mk || '').trim();
  const sks = Number(req.body.sks || 2);
  const semester = req.body.semester ? Number(req.body.semester) : null;

  if (!kode_mk || !nama_mk) {
    return res.status(400).json({ error: 'Kode MK dan Nama MK wajib diisi.' });
  }
  if (sks < 1 || sks > 6) {
    return res.status(400).json({ error: 'SKS harus antara 1 sampai 6.' });
  }

  try {
    const result = await q(
      `INSERT INTO mata_kuliah (kode_mk, nama_mk, sks, semester, dosen_id)
       VALUES (?, ?, ?, ?, ?)`,
      [kode_mk, nama_mk, sks, semester, req.user.id]
    );
    const created = await one(`SELECT * FROM mata_kuliah WHERE id = ?`, [result.insertId]);
    res.status(201).json({ message: 'Mata kuliah berhasil dibuat.', data: created });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kode mata kuliah ini sudah kamu buat sebelumnya.' });
    }
    throw err;
  }
});

// PUT /api/mata-kuliah/:id -> Edit mata kuliah (hanya dosen pemiliknya) (#16)
router.put('/:id', requireRole('dosen'), async (req, res) => {
  const mk = await one(`SELECT * FROM mata_kuliah WHERE id = ?`, [req.params.id]);
  if (!mk) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });
  if (mk.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa mengedit mata kuliah milikmu sendiri.' });
  }

  const kode_mk = String(req.body.kode_mk || mk.kode_mk).trim().toUpperCase();
  const nama_mk = String(req.body.nama_mk || mk.nama_mk).trim();
  const sks = req.body.sks !== undefined ? Number(req.body.sks) : mk.sks;
  const semester = req.body.semester !== undefined ? (req.body.semester ? Number(req.body.semester) : null) : mk.semester;

  if (!kode_mk || !nama_mk) {
    return res.status(400).json({ error: 'Kode MK dan Nama MK tidak boleh kosong.' });
  }

  try {
    await q(
      `UPDATE mata_kuliah SET kode_mk = ?, nama_mk = ?, sks = ?, semester = ? WHERE id = ?`,
      [kode_mk, nama_mk, sks, semester, mk.id]
    );
    const updated = await one(`SELECT * FROM mata_kuliah WHERE id = ?`, [mk.id]);
    res.json({ message: 'Mata kuliah berhasil diperbarui.', data: updated });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kode mata kuliah sudah digunakan.' });
    }
    throw err;
  }
});

// DELETE /api/mata-kuliah/:id -> Hapus mata kuliah (dosen pemilik atau admin) (#16, #17)
router.delete('/:id', async (req, res) => {
  const mk = await one(`SELECT * FROM mata_kuliah WHERE id = ?`, [req.params.id]);
  if (!mk) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });

  if (req.user.role === 'dosen' && mk.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa menghapus mata kuliah milikmu sendiri.' });
  }

  await q(`DELETE FROM mata_kuliah WHERE id = ?`, [mk.id]);
  res.json({ message: 'Mata kuliah berhasil dihapus.' });
});

module.exports = router;