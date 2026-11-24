const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireRole } = require('../middleware/auth');

const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
const HARI_LABEL = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat' };
const WAKTU = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const hm = (t) => String(t).slice(0, 5); // 'HH:MM:SS' -> 'HH:MM'
const rapikan = (r) => ({ ...r, jam_mulai: hm(r.jam_mulai), jam_selesai: hm(r.jam_selesai) });

const SELECT_JADWAL = `
  SELECT j.id, j.kelas_id, j.hari, j.jam_mulai, j.jam_selesai, j.ruang,
         k.nama_kelas, mk.kode_mk, mk.nama_mk, mk.dosen_id
  FROM jadwal j
  JOIN kelas k ON k.id = j.kelas_id
  JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
`;

function kelasDenganPemilik(id) {
  return one(
    `SELECT k.id, k.nama_kelas, mk.nama_mk, mk.dosen_id
     FROM kelas k JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ?`,
    [id]
  );
}

function validasiInput(body) {
  const hari = String(body.hari || '').trim().toLowerCase();
  const ruang = String(body.ruang || '').trim();
  const jam_mulai = String(body.jam_mulai || '').trim();
  const jam_selesai = String(body.jam_selesai || '').trim();

  if (!HARI.includes(hari)) return { error: 'Hari harus Senin sampai Jumat.' };
  if (!ruang || ruang.length > 50) return { error: 'Ruangan wajib diisi (maksimal 50 karakter).' };
  if (!WAKTU.test(jam_mulai) || !WAKTU.test(jam_selesai)) return { error: 'Format jam harus HH:MM.' };
  if (hm(jam_mulai) >= hm(jam_selesai)) return { error: 'Jam selesai harus lebih besar dari jam mulai.' };

  return { data: { hari, ruang, jam_mulai: hm(jam_mulai), jam_selesai: hm(jam_selesai) } };
}

// #20: bentrok bila hari sama, jam tumpang tindih, dan ruangan sama (semua kelas)
// atau dosen sama. Jam yang tepat bersebelahan (selesai 10:30, mulai 10:30) boleh.
async function cariBentrok({ hari, ruang, jam_mulai, jam_selesai }, dosenId, abaikanId = 0) {
  const rows = await q(
    `${SELECT_JADWAL}
     WHERE j.hari = ? AND j.id <> ? AND j.jam_mulai < ? AND j.jam_selesai > ?
       AND (j.ruang = ? OR mk.dosen_id = ?)
     ORDER BY j.jam_mulai`,
    [hari, abaikanId, jam_selesai, jam_mulai, ruang, dosenId]
  );
  if (!rows.length) return null;

  const samaRuang = rows.find((r) => r.ruang.toLowerCase() === ruang.toLowerCase());
  const b = samaRuang || rows[0];
  const nama = `${b.nama_mk} · ${b.nama_kelas}`;
  const waktu = `${HARI_LABEL[b.hari]} ${hm(b.jam_mulai)} – ${hm(b.jam_selesai)}`;

  return samaRuang
    ? `${b.ruang} dipakai ${nama}, ${waktu}.`
    : `Kamu sudah mengajar ${nama}, ${waktu}.`;
}

// GET /api/jadwal/saya -> jadwal mingguan milik sendiri (#21, #22)
router.get('/saya', async (req, res) => {
  if (req.user.role === 'mahasiswa') {
    // TODO #22: isi setelah tabel peserta kelas (#23) ada
    return res.json({ data: [] });
  }
  const dosen = req.user.role === 'dosen';
  const rows = await q(
    `${SELECT_JADWAL} ${dosen ? 'WHERE mk.dosen_id = ?' : ''} ORDER BY j.hari, j.jam_mulai`,
    dosen ? [req.user.id] : []
  );
  res.json({ data: rows.map(rapikan) });
});

// GET /api/jadwal?kelas_id=1 -> jadwal satu kelas
router.get('/', requireRole('dosen', 'admin'), async (req, res) => {
  const kelasId = Number(req.query.kelas_id);
  if (!kelasId) return res.status(400).json({ error: 'kelas_id wajib diisi.' });

  const kelas = await kelasDenganPemilik(kelasId);
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (req.user.role === 'dosen' && kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu tidak punya akses ke kelas ini.' });
  }

  const rows = await q(`${SELECT_JADWAL} WHERE j.kelas_id = ? ORDER BY j.hari, j.jam_mulai`, [kelasId]);
  res.json({ data: rows.map(rapikan) });
});

// POST /api/jadwal -> tambah jadwal (#19)
router.post('/', requireRole('dosen'), async (req, res) => {
  const kelasId = Number(req.body.kelas_id);
  const kelas = kelasId ? await kelasDenganPemilik(kelasId) : null;
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  if (kelas.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa menambah jadwal pada kelas milikmu sendiri.' });
  }

  const v = validasiInput(req.body);
  if (v.error) return res.status(400).json({ error: v.error });

  const bentrok = await cariBentrok(v.data, kelas.dosen_id);
  if (bentrok) return res.status(409).json({ error: `Jadwal bentrok. ${bentrok}` });

  const result = await q(
    `INSERT INTO jadwal (kelas_id, hari, jam_mulai, jam_selesai, ruang) VALUES (?, ?, ?, ?, ?)`,
    [kelas.id, v.data.hari, v.data.jam_mulai, v.data.jam_selesai, v.data.ruang]
  );
  const created = await one(`${SELECT_JADWAL} WHERE j.id = ?`, [result.insertId]);
  res.status(201).json({ message: 'Jadwal berhasil ditambahkan.', data: rapikan(created) });
});

// PUT /api/jadwal/:id -> ubah jadwal (kelasnya tidak bisa dipindah)
router.put('/:id', requireRole('dosen'), async (req, res) => {
  const jadwal = await one(`${SELECT_JADWAL} WHERE j.id = ?`, [req.params.id]);
  if (!jadwal) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
  if (jadwal.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa mengubah jadwal kelas milikmu sendiri.' });
  }

  const v = validasiInput(req.body);
  if (v.error) return res.status(400).json({ error: v.error });

  const bentrok = await cariBentrok(v.data, jadwal.dosen_id, jadwal.id);
  if (bentrok) return res.status(409).json({ error: `Jadwal bentrok. ${bentrok}` });

  await q(
    `UPDATE jadwal SET hari = ?, jam_mulai = ?, jam_selesai = ?, ruang = ? WHERE id = ?`,
    [v.data.hari, v.data.jam_mulai, v.data.jam_selesai, v.data.ruang, jadwal.id]
  );
  const updated = await one(`${SELECT_JADWAL} WHERE j.id = ?`, [jadwal.id]);
  res.json({ message: 'Jadwal berhasil diperbarui.', data: rapikan(updated) });
});

// DELETE /api/jadwal/:id -> hapus jadwal (dosen pemilik atau admin)
router.delete('/:id', requireRole('dosen', 'admin'), async (req, res) => {
  const jadwal = await one(`${SELECT_JADWAL} WHERE j.id = ?`, [req.params.id]);
  if (!jadwal) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
  if (req.user.role === 'dosen' && jadwal.dosen_id !== req.user.id) {
    return res.status(403).json({ error: 'Kamu hanya bisa menghapus jadwal kelas milikmu sendiri.' });
  }

  await q(`DELETE FROM jadwal WHERE id = ?`, [jadwal.id]);
  res.json({ message: 'Jadwal berhasil dihapus.' });
});

module.exports = router;