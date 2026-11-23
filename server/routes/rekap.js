const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Batas aman kehadiran (%). Di bawah angka ini mahasiswa berstatus "Perlu perhatian".
const BATAS_PERSEN = 75;

const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Hanya "hadir" yang dihitung hadir. Presensi yang belum diisi dianggap alpa.
// Pertemuan yang tanggalnya belum tiba tidak dihitung.
function ringkas(total, hadir, izin, sakit) {
  return {
    total,
    hadir,
    izin,
    sakit,
    alpa: total - hadir - izin - sakit,
    persen: total > 0 ? Math.round((hadir / total) * 1000) / 10 : null
  };
}

// Rekap satu mahasiswa di setiap kelas yang boleh dilihat pemanggil.
// Dosen hanya melihat kelas dari mata kuliah miliknya.
async function rekapMahasiswa(mahasiswaId, user) {
  let where = 'km.mahasiswa_id = ?';
  const params = [mahasiswaId];
  if (user.role === 'dosen') {
    where += ' AND mk.dosen_id = ?';
    params.push(user.id);
  }

  const kelas = await q(
    `SELECT k.id, k.nama_kelas, k.tahun_ajaran, mk.kode_mk, mk.nama_mk, d.nama AS nama_dosen
     FROM kelas_mahasiswa km
     JOIN kelas k ON k.id = km.kelas_id
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     JOIN users d ON d.id = mk.dosen_id
     WHERE ${where}
     ORDER BY mk.nama_mk, k.nama_kelas`,
    params
  );
  if (kelas.length === 0) return [];

  const rows = await q(
    `SELECT s.kelas_id, p.status, COUNT(*) AS jumlah
     FROM sesi_pertemuan s
     LEFT JOIN presensi p ON p.sesi_id = s.id AND p.mahasiswa_id = ?
     WHERE s.kelas_id IN (${kelas.map(() => '?').join(',')}) AND s.tanggal <= CURDATE()
     GROUP BY s.kelas_id, p.status`,
    [mahasiswaId, ...kelas.map((k) => k.id)]
  );

  return kelas.map((k) => {
    const mine = rows.filter((r) => r.kelas_id === k.id);
    const count = (st) => mine.filter((r) => r.status === st).reduce((a, r) => a + r.jumlah, 0);
    const total = mine.reduce((a, r) => a + r.jumlah, 0);
    return { ...k, ...ringkas(total, count('hadir'), count('izin'), count('sakit')) };
  });
}

// ---------- #42 Rekap per mahasiswa ----------

// Mahasiswa melihat rekap dirinya sendiri.
router.get('/saya', requireRole('mahasiswa'), async (req, res) => {
  res.json({ batas: BATAS_PERSEN, data: await rekapMahasiswa(req.user.id, req.user) });
});

// Dosen/admin melihat rekap satu mahasiswa.
router.get('/mahasiswa/:id', requireRole('dosen', 'admin'), async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID mahasiswa tidak valid.' });
  const mhs = await one(`SELECT id, nama, nim_nip, program_studi, angkatan FROM users WHERE id = ? AND role = 'mahasiswa'`, [id]);
  if (!mhs) return res.status(404).json({ error: 'Mahasiswa tidak ditemukan.' });
  res.json({ batas: BATAS_PERSEN, mahasiswa: mhs, data: await rekapMahasiswa(id, req.user) });
});

// ---------- #43 Rekap per kelas ----------

// Daftar kelas untuk pilihan filter. Dosen: kelas miliknya. Admin: semua.
router.get('/kelas', requireRole('dosen', 'admin'), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'dosen') {
    where = 'WHERE mk.dosen_id = ?';
    params.push(req.user.id);
  }
  const data = await q(
    `SELECT k.id, k.nama_kelas, k.tahun_ajaran, mk.kode_mk, mk.nama_mk, u.nama AS nama_dosen
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     JOIN users u ON u.id = mk.dosen_id
     ${where}
     ORDER BY k.tahun_ajaran DESC, mk.nama_mk, k.nama_kelas`,
    params
  );
  res.json({ batas: BATAS_PERSEN, data });
});

// Rekap seluruh mahasiswa dalam satu kelas.
router.get('/kelas/:id', requireRole('dosen', 'admin'), async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID kelas tidak valid.' });

  const params = [id];
  let extra = '';
  if (req.user.role === 'dosen') {
    extra = ' AND mk.dosen_id = ?';
    params.push(req.user.id);
  }
  const kelas = await one(
    `SELECT k.id, k.nama_kelas, k.tahun_ajaran, mk.kode_mk, mk.nama_mk, u.nama AS nama_dosen
     FROM kelas k
     JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     JOIN users u ON u.id = mk.dosen_id
     WHERE k.id = ?${extra}`,
    params
  );
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

  const { total } = await one(`SELECT COUNT(*) AS total FROM sesi_pertemuan WHERE kelas_id = ? AND tanggal <= CURDATE()`, [id]);
  const mahasiswa = await q(
    `SELECT u.id, u.nama, u.nim_nip
     FROM kelas_mahasiswa km JOIN users u ON u.id = km.mahasiswa_id
     WHERE km.kelas_id = ? ORDER BY u.nama`,
    [id]
  );
  const rows = await q(
    `SELECT p.mahasiswa_id, p.status, COUNT(*) AS jumlah
     FROM presensi p JOIN sesi_pertemuan s ON s.id = p.sesi_id
     WHERE s.kelas_id = ? AND s.tanggal <= CURDATE()
     GROUP BY p.mahasiswa_id, p.status`,
    [id]
  );
  const count = (mid, st) => rows.filter((r) => r.mahasiswa_id === mid && r.status === st).reduce((a, r) => a + r.jumlah, 0);

  const data = mahasiswa.map((m) => ({
    ...m,
    ...ringkas(total, count(m.id, 'hadir'), count(m.id, 'izin'), count(m.id, 'sakit'))
  }));
  res.json({ batas: BATAS_PERSEN, kelas: { ...kelas, total_pertemuan: total }, data });
});

// ---------- Laporan presensi (dosen) ----------

const STATUS = ['hadir', 'izin', 'sakit', 'alpa'];
const TAB = ['sesi', 'kelas', 'periode'];
const tglValid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const bagi = (n, slot) => (slot > 0 ? Math.round((n / slot) * 1000) / 10 : null);
const kosong = () => ({ hadir: 0, izin: 0, sakit: 0, alpa: 0 });

// GET /api/rekap/laporan?kelas_id=&tab=sesi|kelas|periode&dari=&sampai=&status=
// "status" memilih status yang dihitung persentasenya (kosong/semua = hadir).
// Mahasiswa tanpa catatan presensi di suatu pertemuan dihitung alpa.
router.get('/laporan', requireRole('dosen'), async (req, res) => {
  const kelasId = toId(req.query.kelas_id);
  if (!kelasId) return res.status(400).json({ error: 'Pilih kelas terlebih dahulu.' });
  const tab = TAB.includes(req.query.tab) ? req.query.tab : 'sesi';
  const status = STATUS.includes(req.query.status) ? req.query.status : 'semua';
  const dari = req.query.dari || null;
  const sampai = req.query.sampai || null;
  if ((dari && !tglValid(dari)) || (sampai && !tglValid(sampai))) return res.status(400).json({ error: 'Format tanggal tidak valid.' });
  if (dari && sampai && dari > sampai) return res.status(400).json({ error: 'Tanggal awal tidak boleh setelah tanggal akhir.' });

  const kelas = await one(
    `SELECT k.id, k.nama_kelas, k.tahun_ajaran, mk.kode_mk, mk.nama_mk
     FROM kelas k JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
     WHERE k.id = ? AND mk.dosen_id = ?`,
    [kelasId, req.user.id]
  );
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

  let rentang = 's.kelas_id = ? AND s.tanggal <= CURDATE()';
  const params = [kelasId];
  if (dari) { rentang += ' AND s.tanggal >= ?'; params.push(dari); }
  if (sampai) { rentang += ' AND s.tanggal <= ?'; params.push(sampai); }

  const sesi = await q(`SELECT s.id, s.pertemuan_ke, s.tanggal, s.topik FROM sesi_pertemuan s WHERE ${rentang} ORDER BY s.tanggal DESC, s.pertemuan_ke DESC`, params);
  const mhs = await q(`SELECT u.id, u.nama, u.nim_nip FROM kelas_mahasiswa km JOIN users u ON u.id = km.mahasiswa_id WHERE km.kelas_id = ? ORDER BY u.nama`, [kelasId]);
  const catatan = await q(
    `SELECT p.sesi_id, p.mahasiswa_id, p.status
     FROM presensi p
     JOIN sesi_pertemuan s ON s.id = p.sesi_id
     JOIN kelas_mahasiswa km ON km.kelas_id = s.kelas_id AND km.mahasiswa_id = p.mahasiswa_id
     WHERE ${rentang}`,
    params
  );

  const perSesi = new Map(sesi.map((s) => [s.id, kosong()]));
  const perMhs = new Map(mhs.map((m) => [m.id, kosong()]));
  for (const c of catatan) {
    perSesi.get(c.sesi_id)[c.status] += 1;
    perMhs.get(c.mahasiswa_id)[c.status] += 1;
  }

  const basis = status === 'semua' ? 'hadir' : status;
  const hitung = (c, slot) => ({ hadir: c.hadir, izin: c.izin, sakit: c.sakit, alpa: slot - c.hadir - c.izin - c.sakit, persen: bagi(basis === 'alpa' ? slot - c.hadir - c.izin - c.sakit : c[basis], slot) });

  let rows;
  if (tab === 'sesi') {
    rows = sesi.map((s) => ({ id: s.id, tanggal: s.tanggal, pertemuan_ke: s.pertemuan_ke, topik: s.topik, ...hitung(perSesi.get(s.id), mhs.length) }));
  } else if (tab === 'kelas') {
    rows = mhs.map((m) => ({ id: m.id, nama: m.nama, nim_nip: m.nim_nip, total: sesi.length, ...hitung(perMhs.get(m.id), sesi.length) }));
  } else {
    const bulan = new Map();
    for (const s of sesi) {
      const tglStr = s.tanggal instanceof Date ? s.tanggal.toLocaleDateString('sv-SE') : String(s.tanggal);
      const kunci = tglStr.slice(0, 7);
      const b = bulan.get(kunci) || { periode: kunci, pertemuan: 0, ...kosong() };
      const c = perSesi.get(s.id);
      b.pertemuan += 1;
      for (const st of STATUS) b[st] += c[st];
      bulan.set(kunci, b);
    }
    rows = [...bulan.values()].map((b) => {
      const slot = b.pertemuan * mhs.length;
      return { ...b, ...hitung(b, slot) };
    });
  }

  res.json({ batas: BATAS_PERSEN, tab, status, kelas, jumlah_mahasiswa: mhs.length, rows });
});

module.exports = router;
