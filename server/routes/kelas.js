const crypto = require('crypto');
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireRole } = require('../middleware/auth');

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

// ============================================================================
// ENDPOINT MAHASISWA — Gabung Kelas, Validasi Kode & Kelas Diikuti (#24, #25, #28)
// ============================================================================

// GET /api/kelas/diikuti -> Daftar kelas yang sedang diikuti mahasiswa (#28)
router.get('/diikuti', requireRole('mahasiswa'), async (req, res) => {
  const rows = await q(
    `SELECT
       k.id,
       k.nama_kelas,
       k.tahun_ajaran,
       k.kode_join,
       k.is_pendaftaran_buka,
       mk.kode_mk,
       mk.nama_mk,
       mk.sks,
       mk.semester,
       u.nama AS nama_dosen,
       u.email AS email_dosen,
       km.joined_at,
       j.hari,
       TIME_FORMAT(j.jam_mulai, '%H:%i') AS jam_mulai,
       TIME_FORMAT(j.jam_selesai, '%H:%i') AS jam_selesai,
       j.ruang,
       (SELECT COUNT(*) FROM kelas_mahasiswa km2 WHERE km2.kelas_id = k.id) AS jumlah_peserta
     FROM kelas_mahasiswa km
     JOIN kelas k ON k.id = km.kelas_id
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     JOIN users u ON u.id = mk.dosen_id
     LEFT JOIN jadwal j ON j.kelas_id = k.id
     WHERE km.mahasiswa_id = ?
     ORDER BY km.joined_at DESC`,
    [req.user.id]
  );

  res.json({ data: rows });
});

// GET /api/kelas/cari/:kode -> Preview & validasi kode kelas sebelum mahasiswa bergabung (#24, #25)
router.get('/cari/:kode', requireRole('mahasiswa'), async (req, res) => {
  const kode = String(req.params.kode || '').trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(kode)) {
    return res.status(400).json({
      status_kode: 'INVALID',
      error: 'Kode kelas harus terdiri dari 6 karakter huruf dan angka.'
    });
  }

  const kelas = await one(
    `SELECT
       k.id,
       k.nama_kelas,
       k.tahun_ajaran,
       k.kode_join,
       k.is_pendaftaran_buka,
       mk.kode_mk,
       mk.nama_mk,
       mk.sks,
       u.nama AS nama_dosen,
       j.hari,
       TIME_FORMAT(j.jam_mulai, '%H:%i') AS jam_mulai,
       TIME_FORMAT(j.jam_selesai, '%H:%i') AS jam_selesai,
       j.ruang,
       (SELECT COUNT(*) FROM kelas_mahasiswa km WHERE km.kelas_id = k.id) AS jumlah_peserta
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     JOIN users u ON u.id = mk.dosen_id
     LEFT JOIN jadwal j ON j.kelas_id = k.id
     WHERE UPPER(k.kode_join) = ?`,
    [kode]
  );

  if (!kelas) {
    return res.status(404).json({
      status_kode: 'INVALID',
      error: 'Kode tidak valid. Periksa lagi kode dari dosenmu.'
    });
  }

  // Cek apakah mahasiswa sudah terdaftar di kelas ini (#25)
  const sudahTerdaftar = await one(
    `SELECT id FROM kelas_mahasiswa WHERE kelas_id = ? AND mahasiswa_id = ?`,
    [kelas.id, req.user.id]
  );

  let status_kode = 'OPEN';
  if (sudahTerdaftar) {
    status_kode = 'ALREADY_JOINED';
  } else if (!kelas.is_pendaftaran_buka) {
    status_kode = 'CLOSED';
  }

  res.json({
    status_kode,
    data: {
      ...kelas,
      is_pendaftaran_buka: Boolean(kelas.is_pendaftaran_buka),
      sudah_terdaftar: Boolean(sudahTerdaftar)
    }
  });
});

// POST /api/kelas/gabung -> Mahasiswa bergabung ke kelas menggunakan kode_join (#24, #25)
router.post('/gabung', requireRole('mahasiswa'), async (req, res) => {
  const kode = String(req.body.kode_join || req.body.kode || '').trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(kode)) {
    return res.status(400).json({
      status_kode: 'INVALID',
      error: 'Kode tidak valid. Periksa lagi kode dari dosenmu.'
    });
  }

  const kelas = await one(
    `SELECT
       k.id,
       k.nama_kelas,
       k.kode_join,
       k.is_pendaftaran_buka,
       mk.kode_mk,
       mk.nama_mk
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE UPPER(k.kode_join) = ?`,
    [kode]
  );

  if (!kelas) {
    return res.status(404).json({
      status_kode: 'INVALID',
      error: 'Kode tidak valid. Periksa lagi kode dari dosenmu.'
    });
  }

  // Cegah daftar ganda (#25)
  const existing = await one(
    `SELECT id FROM kelas_mahasiswa WHERE kelas_id = ? AND mahasiswa_id = ?`,
    [kelas.id, req.user.id]
  );
  if (existing) {
    return res.status(409).json({
      status_kode: 'ALREADY_JOINED',
      error: 'Kamu sudah menjadi peserta kelas ini.'
    });
  }

  // Validasi status pendaftaran kelas (#25)
  if (!kelas.is_pendaftaran_buka) {
    return res.status(403).json({
      status_kode: 'CLOSED',
      error: 'Dosen sedang menutup pendaftaran kelas ini.'
    });
  }

  try {
    await q(
      `INSERT INTO kelas_mahasiswa (kelas_id, mahasiswa_id) VALUES (?, ?)`,
      [kelas.id, req.user.id]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        status_kode: 'ALREADY_JOINED',
        error: 'Kamu sudah menjadi peserta kelas ini.'
      });
    }
    throw err;
  }

  res.status(201).json({
    status_kode: 'JOINED',
    message: `Berhasil bergabung! Kamu terdaftar di ${kelas.nama_mk} · Kelas ${kelas.nama_kelas}.`,
    data: kelas
  });
});

// DELETE /api/kelas/:id/keluar -> Mahasiswa keluar dari kelas yang diikuti (#28)
router.delete('/:id/keluar', requireRole('mahasiswa'), async (req, res) => {
  const kelasId = Number(req.params.id);
  const membership = await one(
    `SELECT km.id, k.nama_kelas, mk.nama_mk
     FROM kelas_mahasiswa km
     JOIN kelas k ON k.id = km.kelas_id
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE km.kelas_id = ? AND km.mahasiswa_id = ?`,
    [kelasId, req.user.id]
  );

  if (!membership) {
    return res.status(404).json({ error: 'Kamu tidak terdaftar pada kelas ini.' });
  }

  await q(`DELETE FROM kelas_mahasiswa WHERE id = ?`, [membership.id]);
  res.json({
    message: `Kamu telah keluar dari ${membership.nama_mk} · Kelas ${membership.nama_kelas}.`
  });
});

// ============================================================================
// ENDPOINT DOSEN & ADMIN — CRUD Kelas & Pengelolaan Peserta (#26, #27)
// ============================================================================

// GET /api/kelas -> List semua kelas (Admin lihat semua, Dosen lihat kelas dari matkul miliknya)
router.get('/', requireRole('dosen', 'admin'), async (req, res) => {
  if (req.user.role === 'admin') {
    const rows = await q(
      `SELECT k.*, mk.kode_mk, mk.nama_mk, u.nama AS nama_dosen,
              (SELECT COUNT(*) FROM kelas_mahasiswa km WHERE km.kelas_id = k.id) AS jumlah_peserta
       FROM kelas k
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
       JOIN users u ON u.id = mk.dosen_id
       ORDER BY k.created_at DESC`
    );
    return res.json({ data: rows });
  }

  const rows = await q(
    `SELECT k.*, mk.kode_mk, mk.nama_mk,
            (SELECT COUNT(*) FROM kelas_mahasiswa km WHERE km.kelas_id = k.id) AS jumlah_peserta
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE mk.dosen_id = ?
     ORDER BY k.created_at DESC`,
    [req.user.id]
  );
  res.json({ data: rows });
});

// GET /api/kelas/:id/peserta -> Daftar peserta per kelas (#26)
router.get('/:id/peserta', requireRole('dosen', 'admin'), async (req, res) => {
  const kelas = await one(
    `SELECT k.*, mk.kode_mk, mk.nama_mk, mk.dosen_id
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [req.params.id]
  );

  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (req.user.role === 'dosen' && kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa melihat peserta kelas milikmu sendiri.' });
  }

  const peserta = await q(
    `SELECT
       u.id,
       u.nama,
       u.email,
       u.nim_nip,
       u.program_studi,
       u.angkatan,
       km.joined_at
     FROM kelas_mahasiswa km
     JOIN users u ON u.id = km.mahasiswa_id
     WHERE km.kelas_id = ?
     ORDER BY u.nim_nip ASC, u.nama ASC`,
    [kelas.id]
  );

  res.json({
    kelas: {
      id: kelas.id,
      kode_mk: kelas.kode_mk,
      nama_mk: kelas.nama_mk,
      nama_kelas: kelas.nama_kelas,
      tahun_ajaran: kelas.tahun_ajaran,
      kode_join: kelas.kode_join
    },
    data: peserta
  });
});

// DELETE /api/kelas/:id/peserta/:mahasiswaId -> Dosen/admin mengeluarkan mahasiswa (#27)
router.delete('/:id/peserta/:mahasiswaId', requireRole('dosen', 'admin'), async (req, res) => {
  const kelas = await one(
    `SELECT k.*, mk.dosen_id
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [req.params.id]
  );

  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (req.user.role === 'dosen' && kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa mengelola peserta kelas milikmu sendiri.' });
  }

  const mhs = await one(
    `SELECT km.id, u.nama
     FROM kelas_mahasiswa km
     JOIN users u ON u.id = km.mahasiswa_id
     WHERE km.kelas_id = ? AND km.mahasiswa_id = ?`,
    [kelas.id, req.params.mahasiswaId]
  );

  if (!mhs) {
    return res.status(404).json({ error: 'Mahasiswa tidak terdaftar di kelas ini.' });
  }

  await q(`DELETE FROM kelas_mahasiswa WHERE id = ?`, [mhs.id]);
  res.json({ message: `${mhs.nama} berhasil dikeluarkan dari Kelas ${kelas.nama_kelas}.` });
});

// POST /api/kelas -> Buat kelas di bawah mata kuliah + auto generate kode_join (#13, #14)
router.post('/', requireRole('dosen'), async (req, res) => {
  const mata_kuliah_id = Number(req.body.mata_kuliah_id);
  const nama_kelas = String(req.body.nama_kelas || '').trim();
  const tahun_ajaran = req.body.tahun_ajaran ? String(req.body.tahun_ajaran).trim() : null;

  if (!mata_kuliah_id || !nama_kelas) {
    return res.status(400).json({ error: 'Mata kuliah dan nama kelas wajib diisi.' });
  }

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
router.delete('/:id', requireRole('dosen', 'admin'), async (req, res) => {
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