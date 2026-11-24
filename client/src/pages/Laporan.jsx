import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Alert, Avatar, PageHead } from '../components/ui.jsx';
import { cetakPdf, namaFile, unduhCsv, unduhXlsx } from '../ekspor.js';
import { fmtTanggal } from '../nav.js';
import { Bar, pct } from './Rekap.jsx';

const TABS = [['sesi', 'Per sesi'], ['kelas', 'Per kelas'], ['periode', 'Per periode']];
const STATUS = [['semua', 'Semua'], ['hadir', 'Hadir'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['alpa', 'Alpa']];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const fmtBulan = (s) => {
  if (!s || typeof s !== 'string') return '–';
  return `${BULAN[Number(s.slice(5, 7)) - 1] || ''} ${s.slice(0, 4)}`;
};
const hariIni = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, zona waktu lokal

const KOLOM = {
  sesi: [['Tanggal', (r) => fmtTanggal(r.tanggal)], ['Pertemuan', (r) => `Pertemuan ${r.pertemuan_ke}`]],
  kelas: [['Mahasiswa', (r) => r.nama]],
  periode: [['Periode', (r) => fmtBulan(r.periode)], ['Pertemuan', (r) => r.pertemuan]]
};
const SATUAN = { sesi: 'sesi', kelas: 'mahasiswa', periode: 'periode' };

// Kolom awal khusus export (tab "kelas" menambah kolom NIM).
const DEPAN = {
  sesi: [['Tanggal', (r) => fmtTanggal(r.tanggal)], ['Pertemuan', (r) => `Pertemuan ${r.pertemuan_ke}`]],
  kelas: [['Nama', (r) => r.nama], ['NIM', (r) => r.nim_nip || '']],
  periode: [['Periode', (r) => fmtBulan(r.periode)], ['Pertemuan', (r) => r.pertemuan]]
};

// Isi export = isi tabel di layar: status yang tidak dipilih ditulis "–".
function tabelExport(res, tab) {
  const tampil = (r, k) => (res.status === 'semua' || res.status === k ? r[k] : '–');
  const kepala = [...DEPAN[tab].map(([h]) => h), 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Persentase (%)'];
  const baris = res.rows.map((r) => [...DEPAN[tab].map(([, f]) => f(r)), ...['hadir', 'izin', 'sakit', 'alpa'].map((k) => tampil(r, k)), r.persen ?? '']);
  return { kepala, baris };
}

export default function Laporan() {
  const [daftar, setDaftar] = useState(null);
  const [form, setForm] = useState({ kelasId: '', dari: '', sampai: hariIni(), status: 'semua' });
  const [applied, setApplied] = useState(null);
  const [tab, setTab] = useState('sesi');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/rekap/kelas').then((r) => {
      setDaftar(r.data);
      if (r.data[0]) {
        const f = { kelasId: String(r.data[0].id), dari: '', sampai: hariIni(), status: 'semua' };
        setForm(f);
        setApplied(f);
      }
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!applied) return;
    const qs = new URLSearchParams({ kelas_id: applied.kelasId, tab, status: applied.status });
    if (applied.dari) qs.set('dari', applied.dari);
    if (applied.sampai) qs.set('sampai', applied.sampai);
    setRes(null);
    setError('');
    api.get(`/rekap/laporan?${qs}`).then(setRes).catch((e) => setError(e.message));
  }, [applied, tab]);

  const labelTab = TABS.find(([k]) => k === tab)[1];
  const rentang = [applied?.dari && fmtTanggal(applied.dari), applied?.sampai && fmtTanggal(applied.sampai)].filter(Boolean).join(' – ');

  async function ekspor(format) {
    const nama = namaFile('laporan', res.kelas.kode_mk, res.kelas.nama_kelas, tab);
    const { kepala, baris } = tabelExport(res, tab);
    if (format === 'pdf') return cetakPdf(nama);
    if (format === 'csv') return unduhCsv(nama, kepala, baris);
    setSibuk(true);
    try { await unduhXlsx(nama, `Laporan ${labelTab}`, kepala, baris); }
    catch { setError('Gagal membuat file Excel. Coba lagi.'); }
    finally { setSibuk(false); }
  }

  const status = res?.status ?? 'semua';
  const tampil = (r, k) => (status === 'semua' || status === k ? r[k] : '–');
  const batasBar = status === 'semua' || status === 'hadir' ? res?.batas ?? 75 : 0; // persen status lain tidak diberi warna peringatan

  return (
    <>
      <PageHead title="Laporan Presensi" sub="Filter dan export laporan kehadiran" />
      <div className="flex flex-col gap-[18px] [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link to="/rekap" className="btn-ghost btn-sm">← Rekap Kehadiran</Link>
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'btn-primary btn-sm' : 'btn-ghost btn-sm !rounded-full'} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {daftar && daftar.length === 0 && <p className="card !rounded-2xl py-12 text-center text-sm text-muted">Belum ada kelas. Buat kelas dulu, lalu laporannya muncul di sini.</p>}
        {!daftar && !error && <p className="text-sm text-muted">Memuat...</p>}

        {daftar && daftar.length > 0 && (
          <>
            <form className="card grid print:hidden items-end gap-4 !rounded-2xl !p-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); setApplied(form); }}>
              <div><label className="label" htmlFor="lp-kelas">Kelas</label>
                <select id="lp-kelas" className="input" value={form.kelasId} onChange={set('kelasId')}>
                  {daftar.map((k) => <option key={k.id} value={k.id}>{k.nama_mk} · Kelas {k.nama_kelas}</option>)}
                </select></div>
              <div><label className="label" htmlFor="lp-dari">Dari tanggal</label><input id="lp-dari" type="date" className="input" value={form.dari} onChange={set('dari')} /></div>
              <div><label className="label" htmlFor="lp-sampai">Sampai tanggal</label><input id="lp-sampai" type="date" className="input" value={form.sampai} onChange={set('sampai')} /></div>
              <div><label className="label" htmlFor="lp-status">Status</label>
                <select id="lp-status" className="input" value={form.status} onChange={set('status')}>
                  {STATUS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select></div>
              <button type="submit" className="btn-primary h-11">Terapkan</button>
            </form>

            {error && <Alert>{error}</Alert>}
            {!res && !error && <p className="text-sm text-muted">Memuat...</p>}
            {res && (
              <>
                <div className="hidden print:block">
                  <p className="text-lg font-bold">{res.kelas.nama_mk} · Kelas {res.kelas.nama_kelas}</p>
                  <p className="text-sm">Laporan presensi {labelTab.toLowerCase()}{rentang ? ` · ${rentang}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">{res.rows.length} {SATUAN[tab]} ditemukan</p>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    {[['pdf', 'PDF'], ['excel', 'Excel'], ['csv', 'CSV']].map(([f, label]) => (
                      <button key={f} type="button" className="btn-ghost btn-sm" disabled={res.rows.length === 0 || sibuk} onClick={() => ekspor(f)}>
                        <Icon name="download" size={14} /> Export {label}
                      </button>
                    ))}
                  </div>
                </div>

                <section className="card !rounded-2xl !p-0 overflow-hidden">
                  {res.rows.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted">Tidak ada data pada rentang tanggal ini.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm print:min-w-0">
                        <thead>
                          <tr className="bg-soft text-xs font-semibold text-primary">
                            {KOLOM[tab].map(([h]) => <th key={h} className="px-5 py-[13px]">{h.toUpperCase()}</th>)}
                            {['HADIR', 'IZIN', 'SAKIT', 'ALPA'].map((h) => <th key={h} className="px-3 py-[13px]">{h}</th>)}
                            <th className="w-[240px] px-5 py-[13px]">PERSENTASE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {res.rows.map((r) => (
                            <tr key={r.id ?? r.periode}>
                              {KOLOM[tab].map(([h, f], i) => (
                                <td key={h} className={`px-5 py-3 ${i === 0 ? 'font-semibold' : ''}`}>
                                  {tab === 'kelas' ? <div className="flex items-center gap-2.5"><Avatar nama={r.nama} id={r.id} /><div><p className="font-semibold">{r.nama}</p>{r.nim_nip && <p className="text-xs font-normal text-muted">{r.nim_nip}</p>}</div></div> : f(r)}
                                </td>
                              ))}
                              {['hadir', 'izin', 'sakit', 'alpa'].map((k) => <td key={k} className="px-3 py-3">{tampil(r, k)}</td>)}
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <Bar nilai={r.persen} batas={batasBar} />
                                  <span className={`w-14 shrink-0 text-right font-semibold ${r.persen != null && batasBar && r.persen < batasBar ? 'text-[#b45309]' : ''}`}>{pct(r.persen)}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
