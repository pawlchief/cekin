const crypto = require('crypto');
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireRole } = require('../middleware/auth');

router.use(requireRole('dosen', 'admin'));

// Helper: Generate kode join 6 karakter huruf kapital & angka (tanpa huruf ambigu O/0/I/1) (#14)
async function generateUniqueJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    const existing = await one(`SELECT id FROM kelas WHERE kode_join = ?`, [code]);
    if (!existing) return code;
  }
  throw new Error('Gagal menghasilkan kode join unik.');
}

// GET /api/kelas -> List semua kelas (Admin lihat semua, Dosen lihat kelas dari matkul miliknya)
router.get('/', async (req, res) => {
  if (req.user.role === 'admin') {
    const rows = await q(
      `SELECT k.*, mk.kode_mk, mk.nama_mk, u.nama AS nama_dosen
       FROM kelas k
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
       JOIN users u ON u.id = mk.dosen_id
       ORDER BY k.created_at DESC`
    );
    return res.json({ data: rows });
  }

  const rows = await q(
    `SELECT k.*, mk.kode_mk, mk.nama_mk
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE mk.dosen_id = ?
     ORDER BY k.created_at DESC`,
    [req.user.id]
  );
  res.json({ data: rows });
});

// POST /api/kelas -> Buat kelas di bawah mata kuliah + auto generate kode_join (#13, #14)
router.post('/', requireRole('dosen'), async (req, res) => {
  const mata_kuliah_id = Number(req.body.mata_kuliah_id);
  const nama_kelas = String(req.body.nama_kelas || '').trim();
  const tahun_ajaran = req.body.tahun_ajaran ? String(req.body.tahun_ajaran).trim() : null;

  if (!mata_kuliah_id || !nama_kelas) {
    return res.status(400).json({ error: 'Mata kuliah dan nama kelas wajib diisi.' });
  }

  // Pastikan mata kuliahnya ada dan milik dosen yang sedang login (#16)
  const mk = await one(`SELECT * FROM mata_kuliah WHERE id = ?`, [mata_kuliah_id]);
  if (!mk) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });
  if (mk.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu tidak berhak menambahkan kelas pada mata kuliah ini.' });
  }

  const kode_join = await generateUniqueJoinCode();

  const result = await q(
    `INSERT INTO kelas (mata_kuliah_id, nama_kelas, tahun_ajaran, kode_join, is_pendaftaran_buka)
     VALUES (?, ?, ?, ?, TRUE)`,
    [mata_kuliah_id, nama_kelas, tahun_ajaran, kode_join]
  );

  const created = await one(`SELECT * FROM kelas WHERE id = ?`, [result.insertId]);
  res.status(201).json({ message: 'Kelas berhasil dibuat.', data: created });
});

// PUT /api/kelas/:id -> Edit data kelas (#13, #16)
router.put('/:id', requireRole('dosen'), async (req, res) => {
  const kelas = await one(
    `SELECT k.*, mk.dosen_id FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [req.params.id]
  );
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa mengedit kelas milikmu sendiri.' });
  }

  const nama_kelas = String(req.body.nama_kelas || kelas.nama_kelas).trim();
  const tahun_ajaran = req.body.tahun_ajaran !== undefined ? String(req.body.tahun_ajaran).trim() : kelas.tahun_ajaran;

  if (!nama_kelas) {
    return res.status(400).json({ error: 'Nama kelas tidak boleh kosong.' });
  }

  await q(
    `UPDATE kelas SET nama_kelas = ?, tahun_ajaran = ? WHERE id = ?`,
    [nama_kelas, tahun_ajaran, kelas.id]
  );
  const updated = await one(`SELECT * FROM kelas WHERE id = ?`, [kelas.id]);
  res.json({ message: 'Kelas berhasil diperbarui.', data: updated });
});

// PATCH /api/kelas/:id/regenerate-kode -> Buat ulang kode join baru (#15)
router.patch('/:id/regenerate-kode', requireRole('dosen'), async (req, res) => {
  const kelas = await one(
    `SELECT k.*, mk.dosen_id FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [req.params.id]
  );
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const kodeBaru = await generateUniqueJoinCode();
  await q(`UPDATE kelas SET kode_join = ? WHERE id = ?`, [kodeBaru, kelas.id]);

  res.json({ message: 'Kode join berhasil diperbarui.', kode_join: kodeBaru });
});

// PATCH /api/kelas/:id/toggle-pendaftaran -> Buka/tutup pendaftaran kelas (#15)
router.patch('/:id/toggle-pendaftaran', requireRole('dosen'), async (req, res) => {
  const kelas = await one(
    `SELECT k.*, mk.dosen_id FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [req.params.id]
  );
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const statusBaru = kelas.is_pendaftaran_buka ? 0 : 1;
  await q(`UPDATE kelas SET is_pendaftaran_buka = ? WHERE id = ?`, [statusBaru, kelas.id]);

  res.json({
    message: statusBaru ? 'Pendaftaran kelas dibuka.' : 'Pendaftaran kelas ditutup.',
    is_pendaftaran_buka: Boolean(statusBaru)
  });
});

// DELETE /api/kelas/:id -> Hapus kelas (dosen pemilik atau admin) (#16, #17)
router.delete('/:id', async (req, res) => {
  const kelas = await one(
    `SELECT k.*, mk.dosen_id FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [req.params.id]
  );
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

  if (req.user.role === 'dosen' && kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa menghapus kelas milikmu sendiri.' });
  }

  await q(`DELETE FROM kelas WHERE id = ?`, [kelas.id]);
  res.json({ message: 'Kelas berhasil dihapus.' });
});

module.exports = router;