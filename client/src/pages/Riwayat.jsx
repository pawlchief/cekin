import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Alert, PageHead } from '../components/ui.jsx';
import { fmtTanggal } from '../nav.js';

const STATUS = [['semua', 'Semua status'], ['hadir', 'Hadir'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['alpa', 'Alpa']];
const BADGE = { hadir: 'badge-ok', izin: 'badge-warn', sakit: 'badge-warn', alpa: 'badge-bad' };
const label = (st) => st.charAt(0).toUpperCase() + st.slice(1);
const waktu = (r) => (typeof r.waktu_isi === 'string' && r.waktu_isi.length >= 16 ? r.waktu_isi.slice(11, 16) : '–');
const SEMUA = '__semua';

// Halaman Riwayat Presensi mahasiswa (#50). Hanya membaca; mahasiswa lain tidak bisa dilihat.
export default function Riwayat() {
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [cari, setCari] = useState('');
  const [kelas, setKelas] = useState(SEMUA);
  const [status, setStatus] = useState('semua');
  const [semester, setSemester] = useState(SEMUA);

  useEffect(() => {
    api.get('/rekap/riwayat').then((r) => {
      setRes(r);
      const terbaru = r.data.map((x) => x.tahun_ajaran).filter(Boolean).sort().reverse()[0];
      if (terbaru) setSemester(terbaru); // bawaan: semester terbaru
    }).catch((e) => setError(e.message));
  }, []);

  const data = res?.data || [];
  const semesterList = useMemo(() => [...new Set(data.map((r) => r.tahun_ajaran).filter(Boolean))].sort().reverse(), [data]);
  const kelasList = useMemo(() => {
    const m = new Map();
    data.forEach((r) => m.set(r.kelas_id, `${r.nama_mk} · ${r.nama_kelas}`));
    return [...m];
  }, [data]);

  const kata = cari.trim().toLowerCase();
  const rows = data.filter((r) =>
    (semester === SEMUA || r.tahun_ajaran === semester) &&
    (kelas === SEMUA || r.kelas_id === Number(kelas)) &&
    (status === 'semua' || r.status === status) &&
    (!kata || `${r.nama_mk} ${r.kode_mk}`.toLowerCase().includes(kata))
  );

  let kosong = '';
  if (!res && !error) kosong = 'Memuat...';
  else if (res && data.length === 0) kosong = 'Belum ada riwayat presensi. Gabung ke kelas dulu, lalu riwayatnya muncul di sini.';
  else if (res && rows.length === 0) kosong = 'Tidak ada presensi yang cocok dengan filter.';

  const select = 'input !w-auto min-w-[150px]';
  return (
    <>
      <PageHead title="Riwayat Presensi" sub="Semua presensi yang pernah kamu isi" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Cari mata kuliah</span>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !pl-10" placeholder="Cari mata kuliah..." value={cari} onChange={(e) => setCari(e.target.value)} />
          </label>
          <select className={select} aria-label="Mata kuliah" value={kelas} onChange={(e) => setKelas(e.target.value)}>
            <option value={SEMUA}>Semua mata kuliah</option>
            {kelasList.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
          </select>
          <select className={`${select} hidden md:block`} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map(([k, nama]) => <option key={k} value={k}>{nama}</option>)}
          </select>
          <select className={select} aria-label="Semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value={SEMUA}>Semua semester</option>
            {semesterList.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Mobile: status sebagai chip, daftar sebagai kartu */}
        <div className="flex flex-wrap gap-2 md:hidden" role="group" aria-label="Filter status">
          {STATUS.map(([k, nama]) => (
            <button key={k} type="button" aria-pressed={status === k} className={status === k ? 'btn-primary btn-sm' : 'btn-ghost btn-sm !rounded-full'} onClick={() => setStatus(k)}>
              {k === 'semua' ? 'Semua' : nama}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-3 md:hidden">
          {kosong ? (
            <li className="card !rounded-2xl py-10 text-center text-sm text-muted">{kosong}</li>
          ) : rows.map((r) => (
            <li key={`${r.sesi_id}`} className="card flex items-center justify-between gap-3 !rounded-2xl !p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.nama_mk} {r.nama_kelas}</p>
                <p className="text-xs text-muted">{fmtTanggal(r.tanggal)} · Pertemuan {r.pertemuan_ke} · {waktu(r)}</p>
              </div>
              <span className={BADGE[r.status]}>{label(r.status)}</span>
            </li>
          ))}
        </ul>

        <section className="card hidden !rounded-2xl !p-0 overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="bg-soft text-xs font-semibold text-primary">
                  <th className="px-5 py-[13px]">TANGGAL</th><th className="px-3 py-[13px]">MATA KULIAH</th><th className="px-3 py-[13px]">PERTEMUAN</th>
                  <th className="px-3 py-[13px]">STATUS</th><th className="px-3 py-[13px]">WAKTU ISI</th>
                </tr>
              </thead>
              <tbody>
                {kosong ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted">{kosong}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.sesi_id} className="even:bg-soft/60">
                    <td className="px-5 py-3 font-semibold">{fmtTanggal(r.tanggal)}</td>
                    <td className="px-3 py-3">{r.nama_mk} · {r.nama_kelas}</td>
                    <td className="px-3 py-3">Pertemuan {r.pertemuan_ke}</td>
                    <td className="px-3 py-3"><span className={BADGE[r.status]}>{label(r.status)}</span></td>
                    <td className="px-3 py-3">{waktu(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
