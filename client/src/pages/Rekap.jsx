import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Avatar, Deco, PageHead } from '../components/ui.jsx';
import { namaFile, unduhCsv } from '../ekspor.js';

export const pct = (n) => (n == null ? '–' : `${String(n).replace('.', ',')}%`);
const aman = (n, batas) => n != null && n >= batas;

export function Bar({ nilai, batas }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={`Kehadiran ${pct(nilai)}`}>
      <div className={`h-full rounded-full ${aman(nilai, batas) ? 'bg-primary' : 'bg-gradient-to-r from-[#fbbf24] to-[#d97706]'}`} style={{ width: `${nilai ?? 0}%` }} />
    </div>
  );
}

function Status({ nilai, batas }) {
  if (nilai == null) return <span className="badge-off">Belum ada data</span>;
  return aman(nilai, batas) ? <span className="badge-ok">Aman</span> : <span className="badge-warn">Perlu perhatian</span>;
}

function Empty({ children }) {
  return <p className="card !rounded-2xl py-12 text-center text-sm text-muted">{children}</p>;
}

// ---------- Mahasiswa ----------

const CHIP = {
  H: ['bg-[#dcfce7] text-ok', 'hadir'],
  I: ['bg-[#fef3c7] text-[#b45309]', 'izin'],
  S: ['bg-[#e0f2fe] text-[#0284c7]', 'sakit'],
  A: ['bg-[#fee2e2] text-bad', 'alpa']
};

function RekapMahasiswa() {
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/rekap/saya').then(setRes).catch((e) => setError(e.message)); }, []);

  const data = res?.data || [];
  const batas = res?.batas ?? 75;
  const sum = (k) => data.reduce((a, r) => a + r[k], 0);
  const total = sum('total');
  const hadir = sum('hadir');
  const persen = total > 0 ? Math.round((hadir / total) * 1000) / 10 : null;
  const semester = [...new Set(data.map((r) => r.tahun_ajaran).filter(Boolean))];
  const rendah = data.filter((r) => r.persen != null && r.persen < batas);

  return (
    <>
      <PageHead title="Rekap Kehadiran" sub="Persentase kehadiran pribadi per mata kuliah" />
      {error && <Alert>{error}</Alert>}
      {!res && !error && <p className="text-sm text-muted">Memuat...</p>}
      {res && data.length === 0 && <Empty>Belum ada data kehadiran. Gabung ke kelas dulu, lalu rekapnya muncul di sini.</Empty>}
      {data.length > 0 && (
        <div className="flex flex-col gap-[18px]">
          <section className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[20px] bg-gradient-to-b from-primary to-royal p-6 text-white shadow-card sm:p-7">
            <Deco className="-right-[60px] -top-[70px] size-[250px]" />
            <Deco className="right-[70px] top-[30px] size-[190px]" />
            <div className="relative">
              <p className="text-xs font-medium tracking-[0.12em] text-mist">KEHADIRAN KESELURUHAN</p>
              <p className="mt-1 text-5xl font-bold leading-tight">{pct(persen)}</p>
              <p className="mt-1 text-sm text-mist">{hadir} dari {total} pertemuan{semester.length === 1 ? ` · semester ${semester[0]}` : ''}</p>
            </div>
            <div className="relative grid grid-cols-4 gap-2.5">
              {[['hadir', 'Hadir'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['alpa', 'Alpa']].map(([k, label]) => (
                <div key={k} className="min-w-[60px] rounded-xl bg-white/[0.14] px-3 py-3 text-center">
                  <p className="text-xl font-bold">{sum(k)}</p>
                  <p className="text-xs text-mist">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
            {data.map((k) => (
              <section key={k.id} className="card !rounded-2xl !p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{k.nama_mk}</h3>
                    <p className="text-xs text-muted">Kelas {k.nama_kelas} · {k.nama_dosen}</p>
                  </div>
                  <Status nilai={k.persen} batas={batas} />
                </div>
                <p className={`mt-3 text-[32px] font-bold leading-none ${k.persen != null && k.persen < batas ? 'text-[#b45309]' : 'text-primary'}`}>{pct(k.persen)}</p>
                <div className="mt-3"><Bar nilai={k.persen} batas={batas} /></div>
                <p className="mt-2 text-xs text-muted">{k.hadir} dari {k.total} pertemuan</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {Object.entries(CHIP).map(([huruf, [kelas, kunci]]) => (
                    <span key={huruf} className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${kelas}`} title={kunci}>{huruf} {k[kunci]}</span>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {rendah.map((k) => (
            <div key={k.id} role="alert" className="flex items-start gap-2.5 rounded-xl bg-[#fef3c7] px-4 py-3 text-[13px] text-[#b45309]">
              <Icon name="warn" size={16} className="mt-0.5" />
              <p>Kehadiran {k.nama_mk} {pct(k.persen)}, di bawah batas aman {batas}%. Jaga kehadiranmu di pertemuan berikutnya.</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Dosen ----------

function exportCsv(kelas, rows, batas) {
  const kepala = ['Nama', 'NIM', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Persentase (%)', 'Status'];
  const baris = rows.map((m) => [m.nama, m.nim_nip || '', m.hadir, m.izin, m.sakit, m.alpa, m.persen ?? '', m.persen == null ? '-' : aman(m.persen, batas) ? 'Aman' : 'Perlu perhatian']);
  unduhCsv(namaFile('rekap', kelas.kode_mk, kelas.nama_kelas), kepala, baris);
}

function StatKartu({ label, value, note, icon, tint, color }) {
  return (
    <div className="card flex flex-col gap-2 !rounded-2xl !p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{label}</p>
        <span className="flex size-[38px] items-center justify-center rounded-[11px]" style={{ background: tint, color }}><Icon name={icon} size={18} /></span>
      </div>
      <p className="text-[32px] font-bold leading-none">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

const namaKelas = (k) => `${k.nama_mk} · Kelas ${k.nama_kelas}`;

function RekapDosen() {
  const [daftar, setDaftar] = useState(null);
  const [semester, setSemester] = useState('');
  const [kelasId, setKelasId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [cari, setCari] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/rekap/kelas').then((r) => {
      setDaftar(r);
      if (r.data[0]) { setSemester(r.data[0].tahun_ajaran || ''); setKelasId(r.data[0].id); }
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!kelasId) return;
    setDetail(null);
    api.get(`/rekap/kelas/${kelasId}`).then(setDetail).catch((e) => setError(e.message));
  }, [kelasId]);

  const semesterList = useMemo(() => [...new Set((daftar?.data || []).map((k) => k.tahun_ajaran || ''))], [daftar]);
  const kelasList = (daftar?.data || []).filter((k) => (k.tahun_ajaran || '') === semester);

  function pilihSemester(s) {
    setSemester(s);
    const first = daftar.data.find((k) => (k.tahun_ajaran || '') === s);
    setKelasId(first ? first.id : null);
  }

  const batas = daftar?.batas ?? 75;
  const rows = (detail?.data || []).filter((m) => `${m.nama} ${m.nim_nip || ''}`.toLowerCase().includes(cari.trim().toLowerCase()));
  const semua = detail?.data || [];
  const berisi = semua.filter((m) => m.persen != null);
  const rata = berisi.length ? Math.round((berisi.reduce((a, m) => a + m.persen, 0) / berisi.length) * 10) / 10 : null;
  const rendah = berisi.filter((m) => m.persen < batas).length;

  return (
    <>
      <PageHead title="Rekap Kehadiran" sub="Persentase kehadiran per mahasiswa" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!daftar && !error && <p className="text-sm text-muted">Memuat...</p>}
      {daftar && daftar.data.length === 0 && <Empty>Belum ada kelas. Buat kelas dulu, lalu rekap kehadirannya muncul di sini.</Empty>}
      {daftar && daftar.data.length > 0 && (
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap gap-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Cari mahasiswa</span>
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input !pl-10" placeholder="Cari mahasiswa..." value={cari} onChange={(e) => setCari(e.target.value)} />
            </label>
            <select className="input !w-auto min-w-[190px]" aria-label="Kelas" value={kelasId ?? ''} onChange={(e) => setKelasId(Number(e.target.value))}>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_mk} · Kelas {k.nama_kelas}</option>)}
            </select>
            <select className="input !w-auto min-w-[150px]" aria-label="Semester" value={semester} onChange={(e) => pilihSemester(e.target.value)}>
              {semesterList.map((s) => <option key={s} value={s}>{s || 'Tanpa semester'}</option>)}
            </select>
            <button className="btn-ghost h-11" disabled={!detail || rows.length === 0} onClick={() => exportCsv(detail.kelas, rows, batas)}>
              <Icon name="download" size={16} /> Export
            </button>
            <Link to="/rekap/laporan" className="btn-ghost h-11">Laporan Presensi</Link>
          </div>

          {!detail && !error && <p className="text-sm text-muted">Memuat...</p>}
          {detail && (
            <>
              <div className="grid gap-[18px] md:grid-cols-3">
                <StatKartu label="Rata-rata kehadiran" value={pct(rata)} icon="trend" tint="#eaf1ff" color="#2563eb" />
                <StatKartu label={`Di bawah ${batas}%`} value={rendah} note="mahasiswa perlu perhatian" icon="warn" tint="#fef3c7" color="#d97706" />
                <StatKartu label="Total pertemuan" value={detail.kelas.total_pertemuan} icon="cal" tint="#e0f2fe" color="#0284c7" />
              </div>

              <section className="card !rounded-2xl !p-0 overflow-hidden" aria-label={namaKelas(detail.kelas)}>
                {rows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted">{semua.length === 0 ? 'Belum ada mahasiswa di kelas ini.' : 'Tidak ada mahasiswa yang cocok dengan pencarian.'}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="bg-soft text-xs font-semibold text-primary">
                          <th className="px-5 py-[13px]">NAMA</th><th className="px-3 py-[13px]">HADIR</th><th className="px-3 py-[13px]">IZIN</th>
                          <th className="px-3 py-[13px]">SAKIT</th><th className="px-3 py-[13px]">ALPA</th>
                          <th className="w-[230px] px-5 py-[13px]">PERSENTASE</th><th className="px-5 py-[13px]">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {rows.map((m) => (
                          <tr key={m.id}>
                            <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar nama={m.nama} id={m.id} /><div><p className="font-semibold">{m.nama}</p>{m.nim_nip && <p className="text-xs text-muted">{m.nim_nip}</p>}</div></div></td>
                            <td className="px-3 py-3">{m.hadir}</td><td className="px-3 py-3">{m.izin}</td><td className="px-3 py-3">{m.sakit}</td><td className="px-3 py-3">{m.alpa}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Bar nilai={m.persen} batas={batas} />
                                <span className={`w-14 shrink-0 text-right font-semibold ${m.persen != null && m.persen < batas ? 'text-[#b45309]' : ''}`}>{pct(m.persen)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3"><Status nilai={m.persen} batas={batas} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}

// Tampilan dipilih dari role. Hak akses sebenarnya tetap dicek di server (routes/rekap.js).
export default function Rekap() {
  const { user } = useAuth();
  return user.role === 'mahasiswa' ? <RekapMahasiswa /> : <RekapDosen />;
}
