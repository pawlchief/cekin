import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Alert, PageHead } from '../components/ui.jsx';

const HARI = [
  ['senin', 'Senin', 'Sen'],
  ['selasa', 'Selasa', 'Sel'],
  ['rabu', 'Rabu', 'Rab'],
  ['kamis', 'Kamis', 'Kam'],
  ['jumat', 'Jumat', 'Jum']
];
const NAMA_HARI = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']; // urutan Date.getDay()

const WARNA = [
  'bg-[#e8f0ff] text-[#1d4ed8]',
  'bg-[#d5f7ee] text-[#0f766e]',
  'bg-[#fdf0c4] text-[#b45309]',
  'bg-[#ece8ff] text-[#6d28d9]',
  'bg-[#ffe4ec] text-[#be123c]',
  'bg-[#e0f2fe] text-[#0369a1]'
];
const BAR = ['bg-[#2563eb]', 'bg-[#0f766e]', 'bg-[#d97706]', 'bg-[#7c3aed]', 'bg-[#e11d48]', 'bg-[#0284c7]'];

const tambahHari = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Tanggal Senin sampai Jumat untuk minggu ini (Sabtu/Minggu menampilkan minggu depan).
function tanggalMinggu(now) {
  const dow = now.getDay();
  const keSenin = dow === 0 ? 1 : dow === 6 ? 2 : -(dow - 1);
  const senin = tambahHari(now, keSenin);
  return HARI.map((_, i) => tambahHari(senin, i));
}

// Kelas terdekat setelah sekarang (kelas yang sudah mulai hari ini dilewati).
function cariBerikutnya(jadwal, now) {
  const hariIni = now.getDay();
  const menitSkrg = now.getHours() * 60 + now.getMinutes();
  let terbaik = null;
  for (const j of jadwal) {
    const [h, m] = j.jam_mulai.split(':').map(Number);
    const mulai = h * 60 + m;
    let selisih = (NAMA_HARI.indexOf(j.hari) - hariIni + 7) % 7;
    if (selisih === 0 && mulai <= menitSkrg) selisih = 7;
    const skor = selisih * 1440 + mulai;
    if (!terbaik || skor < terbaik.skor) terbaik = { j, selisih, mulai, skor };
  }
  return terbaik;
}

function labelMulai(b, now) {
  if (b.selisih === 0) {
    const sisa = b.mulai - (now.getHours() * 60 + now.getMinutes());
    const jam = Math.floor(sisa / 60);
    const menit = sisa % 60;
    return `Dimulai dalam ${jam > 0 ? `${jam} jam ` : ''}${menit} menit`;
  }
  return `Dimulai dalam ${b.selisih} hari`;
}

export default function JadwalKuliah() {
  const [now] = useState(() => new Date());
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hariPilih, setHariPilih] = useState(() => {
    const nama = NAMA_HARI[new Date().getDay()];
    return HARI.some(([v]) => v === nama) ? nama : 'senin';
  });

  useEffect(() => {
    api
      .get('/jadwal/saya')
      .then((res) => setJadwal(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const idKelas = useMemo(() => [...new Set(jadwal.map((j) => j.kelas_id))].sort((a, b) => a - b), [jadwal]);
  const warna = (id) => Math.max(0, idKelas.indexOf(id)) % WARNA.length;
  const tanggal = useMemo(() => tanggalMinggu(now), [now]);
  const berikutnya = useMemo(() => cariBerikutnya(jadwal, now), [jadwal, now]);
  const hariIniNama = NAMA_HARI[now.getDay()];

  const fmtTanggalPanjang = (d) =>
    d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

  const isiHari = (nilai) => jadwal.filter((j) => j.hari === nilai);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Jadwal Kuliah" sub="Jadwal mingguan kelas yang kamu ikuti" />
      {error && <Alert>{error}</Alert>}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Memuat jadwal...</p>
      ) : (
        <>
          {/* Kelas berikutnya */}
          {berikutnya ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#1e3a8a] p-5 text-white shadow-card">
              <div>
                <p className="text-[11px] font-semibold tracking-wider opacity-80">KELAS BERIKUTNYA</p>
                <p className="mt-1 text-xl font-bold">
                  {berikutnya.j.nama_mk} · {berikutnya.j.nama_kelas}
                </p>
                <p className="mt-0.5 text-sm opacity-90">
                  {fmtTanggalPanjang(tambahHari(now, berikutnya.selisih))} · {berikutnya.j.jam_mulai} –{' '}
                  {berikutnya.j.jam_selesai} · {berikutnya.j.ruang}
                </p>
              </div>
              <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold">
                {labelMulai(berikutnya, now)}
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-white p-5 text-sm text-muted shadow-card">
              Belum ada jadwal untuk kelas yang kamu ikuti. Gabung ke kelas dengan kode dari dosen, lalu
              jadwalnya akan muncul di sini.
            </div>
          )}

          {/* Desktop: lima kolom hari */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-5">
            {HARI.map(([nilai, label]) => (
              <div
                key={nilai}
                className={`min-h-[220px] rounded-2xl border bg-white p-3 shadow-card ${
                  nilai === hariIniNama ? 'border-primary' : 'border-line'
                }`}
              >
                <p
                  className={`rounded-lg py-1.5 text-center text-sm font-semibold ${
                    nilai === hariIniNama ? 'bg-primary text-white' : 'bg-soft text-primary'
                  }`}
                >
                  {label}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {isiHari(nilai).length === 0 && <p className="text-xs text-muted">Tidak ada kelas</p>}
                  {isiHari(nilai).map((j) => (
                    <div key={j.id} className={`rounded-xl p-2.5 ${WARNA[warna(j.kelas_id)]}`}>
                      <p className="text-xs font-bold leading-snug">
                        {j.nama_mk} · {j.nama_kelas}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-ink">
                        {j.jam_mulai} – {j.jam_selesai}
                      </p>
                      <p className="text-[11px] text-muted">{j.ruang}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: deretan tanggal + daftar hari terpilih */}
          <div className="lg:hidden">
            <div className="grid grid-cols-5 gap-2">
              {HARI.map(([nilai, , singkat], i) => (
                <button
                  key={nilai}
                  type="button"
                  onClick={() => setHariPilih(nilai)}
                  className={`flex flex-col items-center rounded-xl py-2 text-xs font-semibold shadow-card ${
                    hariPilih === nilai ? 'bg-primary text-white' : 'bg-white text-ink'
                  }`}
                >
                  <span>{singkat}</span>
                  <span className="text-base font-bold">{tanggal[i].getDate()}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm font-bold text-ink">
              {fmtTanggalPanjang(tanggal[HARI.findIndex(([v]) => v === hariPilih)])}
            </p>
            <div className="mt-2 flex flex-col gap-3">
              {isiHari(hariPilih).length === 0 && <p className="text-sm text-muted">Tidak ada kelas</p>}
              {isiHari(hariPilih).map((j) => (
                <div key={j.id} className="flex gap-3 rounded-xl bg-white p-3 shadow-card">
                  <span className={`w-1 rounded-full ${BAR[warna(j.kelas_id)]}`} />
                  <div>
                    <p className="text-sm font-bold text-primary">
                      {j.nama_mk} · {j.nama_kelas}
                    </p>
                    <p className="text-xs text-muted">
                      {j.jam_mulai} – {j.jam_selesai} · {j.ruang}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}