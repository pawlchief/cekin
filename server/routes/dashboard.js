const router = require('express').Router();
const { q, one } = require('../config/db');

// Batas aman kehadiran (%), sama dengan routes/rekap.js.
const BATAS_PERSEN = 75;

const hm = (t) => String(t).slice(0, 5); // 'HH:MM:SS' -> 'HH:MM'
const persen = (hadir, slot) => (slot > 0 ? Math.round((hadir / slot) * 1000) / 10 : null);
const URUT_HARI = "FIELD(j.hari, 'senin','selasa','rabu','kamis','jumat')";

// Aturan hitung sama dengan rekap: hanya "hadir" yang dihitung hadir, mahasiswa tanpa
// catatan dianggap alpa, dan pertemuan yang tanggalnya belum tiba tidak dihitung.

// Jadwal mingguan + nomor pertemuan hari ini (kalau sesinya sudah dibuat).
async function ambilJadwal(whereSql, params) {
  const rows = await q(
    `SELECT j.kelas_id, j.hari, j.jam_mulai, j.jam_selesai, j.ruang, k.nama_kelas, mk.nama_mk
       FROM jadwal j
       JOIN kelas k ON k.id = j.kelas_id
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
      WHERE ${whereSql}
      ORDER BY ${URUT_HARI}, j.jam_mulai`,
    params
  );
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.kelas_id))];
  const sesi = await q(
    `SELECT kelas_id, pertemuan_ke FROM sesi_pertemuan
      WHERE tanggal = CURDATE() AND kelas_id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const ke = new Map(sesi.map((s) => [s.kelas_id, s.pertemuan_ke]));

  return rows.map((r) => ({
    kelas_id: r.kelas_id,
    hari: r.hari,
    jam_mulai: hm(r.jam_mulai),
    jam_selesai: hm(r.jam_selesai),
    ruang: r.ruang,
    nama_kelas: r.nama_kelas,
    nama_mk: r.nama_mk,
    pertemuan_hari_ini: ke.get(r.kelas_id) ?? null
  }));
}

async function dataAdmin() {
  const stat = await one(
    `SELECT (SELECT COUNT(*) FROM users WHERE status = 'aktif') AS total,
            (SELECT COUNT(*) FROM users WHERE role = 'dosen' AND status = 'aktif') AS dosen,
            (SELECT COUNT(*) FROM users WHERE role = 'mahasiswa' AND status = 'aktif') AS mahasiswa,
            (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending,
            (SELECT COUNT(*) FROM kelas) AS kelas`
  );
  const pending = await q(`SELECT id, nama, nim_nip, role, created_at FROM users WHERE status = 'pending' ORDER BY created_at LIMIT 5`);
  return { stat, pending };
}

async function dataDosen(user) {
  const kelas = await q(
    `SELECT k.id, k.nama_kelas, k.tahun_ajaran, mk.nama_mk,
            (SELECT COUNT(*) FROM kelas_mahasiswa km WHERE km.kelas_id = k.id) AS jml_mhs,
            (SELECT COUNT(*) FROM sesi_pertemuan s WHERE s.kelas_id = k.id AND s.tanggal <= CURDATE()) AS jml_sesi,
            (SELECT COUNT(*) FROM presensi p
               JOIN sesi_pertemuan s ON s.id = p.sesi_id
               JOIN kelas_mahasiswa km ON km.kelas_id = s.kelas_id AND km.mahasiswa_id = p.mahasiswa_id
              WHERE s.kelas_id = k.id AND s.tanggal <= CURDATE() AND p.status = 'hadir') AS jml_hadir
       FROM kelas k
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
      WHERE mk.dosen_id = ?
      ORDER BY mk.nama_mk, k.nama_kelas`,
    [user.id]
  );

  const { n: totalMhs } = await one(
    `SELECT COUNT(DISTINCT km.mahasiswa_id) AS n
       FROM kelas_mahasiswa km
       JOIN kelas k ON k.id = km.kelas_id
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
      WHERE mk.dosen_id = ?`,
    [user.id]
  );
  const { n: sesiHariIni } = await one(
    `SELECT COUNT(*) AS n
       FROM sesi_pertemuan s
       JOIN kelas k ON k.id = s.kelas_id
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
      WHERE mk.dosen_id = ? AND s.tanggal = CURDATE()`,
    [user.id]
  );

  let hadir = 0;
  let slot = 0;
  const perKelas = kelas.map((k) => {
    const s = k.jml_mhs * k.jml_sesi;
    hadir += k.jml_hadir;
    slot += s;
    return { id: k.id, nama: `${k.nama_mk} ${k.nama_kelas}`, persen: persen(k.jml_hadir, s) };
  });
  const tahun = kelas.map((k) => k.tahun_ajaran).filter(Boolean).sort().reverse()[0] || null;

  return {
    ringkas: { kelas: kelas.length, tahun_ajaran: tahun, mahasiswa: totalMhs, sesi_hari_ini: sesiHariIni, rata_hadir: persen(hadir, slot) },
    kelas: perKelas,
    jadwal: await ambilJadwal('mk.dosen_id = ?', [user.id])
  };
}

async function dataMahasiswa(user) {
  const kelas = await q(
    `SELECT k.id, k.nama_kelas, mk.nama_mk,
            (SELECT COUNT(*) FROM sesi_pertemuan s WHERE s.kelas_id = k.id AND s.tanggal <= CURDATE()) AS jml_sesi,
            (SELECT COUNT(*) FROM presensi p JOIN sesi_pertemuan s ON s.id = p.sesi_id
              WHERE s.kelas_id = k.id AND s.tanggal <= CURDATE() AND p.mahasiswa_id = ? AND p.status = 'hadir') AS jml_hadir,
            (SELECT COUNT(*) FROM presensi p JOIN sesi_pertemuan s ON s.id = p.sesi_id
              WHERE s.kelas_id = k.id AND s.tanggal <= CURDATE() AND p.mahasiswa_id = ? AND p.status IN ('izin','sakit')) AS jml_izin_sakit
       FROM kelas_mahasiswa km
       JOIN kelas k ON k.id = km.kelas_id
       JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
      WHERE km.mahasiswa_id = ?
      ORDER BY mk.nama_mk, k.nama_kelas`,
    [user.id, user.id, user.id]
  );

  let hadir = 0;
  let slot = 0;
  let izinSakit = 0;
  const perKelas = kelas.map((k) => {
    hadir += k.jml_hadir;
    slot += k.jml_sesi;
    izinSakit += k.jml_izin_sakit;
    return { id: k.id, nama: k.nama_mk, persen: persen(k.jml_hadir, k.jml_sesi) };
  });

  return {
    ringkas: { kelas: kelas.length, rata_hadir: persen(hadir, slot), izin_sakit: izinSakit },
    kelas: perKelas,
    jadwal: await ambilJadwal('j.kelas_id IN (SELECT kelas_id FROM kelas_mahasiswa WHERE mahasiswa_id = ?)', [user.id])
  };
}

// GET /api/dashboard -> data ringkasan sesuai peran
router.get('/', async (req, res) => {
  const { role } = req.user;
  if (role === 'admin') return res.json(await dataAdmin());
  const data = role === 'dosen' ? await dataDosen(req.user) : await dataMahasiswa(req.user);
  res.json({ ...data, batas: BATAS_PERSEN });
});

module.exports = router;