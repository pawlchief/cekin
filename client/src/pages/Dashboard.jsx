import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Deco, PageHead, useConfirm } from '../components/ui.jsx';
import { ID_LABEL, fmtTanggal } from '../nav.js';

const NAMA_HARI = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']; // urutan Date.getDay()
const LABEL_HARI = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat' };

const menit = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
const sapaan = (now) => {
  const h = now.getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};
const namaDepan = (nama) => nama.replace(/^(Dr\.|Prof\.|Ir\.)\s*/i, '').split(/[\s,]+/)[0];

// Jam sekarang, diperbarui tiap menit supaya status kelas ikut berubah.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Hero({ title, text, action }) {
  return (
    <section className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[20px] bg-gradient-to-b from-primary to-royal p-7 shadow-card">
      <Deco className="-right-[60px] -top-[70px] size-[250px]" />
      <Deco className="right-[70px] top-[30px] size-[190px]" />
      <Deco className="-left-10 top-[60px] size-[110px]" />
      <div className="relative">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1.5 text-sm text-mist">{text}</p>
      </div>
      {action && <div className="relative">{action}</div>}
    </section>
  );
}

function Stat({ label, value, note, icon, tint, color }) {
  return (
    <div className="card flex flex-col gap-3 !rounded-2xl !p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className="flex size-[38px] items-center justify-center rounded-[11px]" style={{ background: tint, color }}><Icon name={icon} /></span>
      </div>
      <p className="text-[32px] font-bold leading-none">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

const STAT_GRID = 'grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4';
const pct = (p) => (p === null || p === undefined ? '—' : `${p}%`);

// ---------- Panel jadwal (dosen dan mahasiswa) ----------

function statusKelas(j, now) {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= menit(j.jam_selesai)) return ['badge-off', 'Selesai'];
  if (m >= menit(j.jam_mulai)) return ['badge-ok', 'Berlangsung'];
  return ['badge-off', 'Belum mulai'];
}

// Kelas pada hari-hari berikutnya (sampai seminggu ke depan), maksimal `maks` baris.
function jadwalBerikutnya(jadwal, now, maks) {
  const hasil = [];
  for (let i = 1; i <= 7 && hasil.length < maks; i++) {
    const hari = NAMA_HARI[(now.getDay() + i) % 7];
    for (const j of jadwal.filter((x) => x.hari === hari)) {
      if (hasil.length < maks) hasil.push({ ...j, nanti: i === 1 ? 'Besok' : LABEL_HARI[hari] });
    }
  }
  return hasil;
}

function PanelJadwal({ jadwal, now, loading }) {
  const hariIni = jadwal.filter((j) => j.hari === NAMA_HARI[now.getDay()]);
  const berikut = jadwalBerikutnya(jadwal, now, Math.max(0, 4 - hariIni.length));

  return (
    <section className="card !rounded-2xl !p-5">
      <h3 className="text-base font-semibold">Jadwal hari ini</h3>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Memuat jadwal...</p>
      ) : hariIni.length === 0 && berikut.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Belum ada jadwal kuliah.</p>
      ) : (
        <ul className="mt-3">
          {hariIni.length === 0 && <li className="rounded-xl bg-field px-3.5 py-3 text-[13px] text-muted">Tidak ada kelas hari ini.</li>}
          {hariIni.map((j) => {
            const [kelasBadge, label] = statusKelas(j, now);
            const jalan = label === 'Berlangsung';
            return (
              <li key={`${j.kelas_id}-${j.hari}`} className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 ${jalan ? 'bg-soft' : 'border-b border-line'}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{j.nama_mk} · {j.nama_kelas}</p>
                  <p className="text-xs text-muted">
                    {j.pertemuan_hari_ini ? `Pertemuan ${j.pertemuan_hari_ini} · ` : ''}{j.jam_mulai} – {j.jam_selesai} · {j.ruang}
                  </p>
                </div>
                <span className={kelasBadge}>{label}</span>
              </li>
            );
          })}
          {berikut.map((j) => (
            <li key={`${j.kelas_id}-${j.hari}-n`} className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{j.nama_mk} · {j.nama_kelas}</p>
                <p className="text-xs text-muted">{LABEL_HARI[j.hari]}, {j.jam_mulai} – {j.jam_selesai} · {j.ruang}</p>
              </div>
              <span className="badge bg-soft text-primary">{j.nanti}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Panel kehadiran per kelas / mata kuliah ----------

function PanelKehadiran({ judul, kelas, batas, loading }) {
  return (
    <section className="card !rounded-2xl !p-5">
      <h3 className="text-base font-semibold">{judul}</h3>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Memuat data...</p>
      ) : kelas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Belum ada kelas.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3.5">
          {kelas.slice(0, 6).map((k) => {
            const rendah = k.persen !== null && k.persen < batas;
            return (
              <li key={k.id}>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">{k.nama}</span>
                  <span className={`shrink-0 font-bold ${rendah ? 'text-warn' : ''}`}>{pct(k.persen)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft" role="img" aria-label={`Kehadiran ${k.nama} ${pct(k.persen)}`}>
                  <div className={`h-full rounded-full ${rendah ? 'bg-gradient-to-r from-accent to-warn' : 'bg-gradient-to-r from-primary to-[#3b82f6]'}`} style={{ width: `${k.persen ?? 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && kelas.some((k) => k.persen === null) && (
        <p className="mt-4 text-xs text-muted">Tanda "—" berarti belum ada pertemuan yang tercatat.</p>
      )}
    </section>
  );
}

// ---------- Data dashboard per peran ----------

function useDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get('/dashboard').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  return { data, error, load };
}

function AdminDashboard() {
  const { data, error: loadError, load } = useDashboard();
  const [actError, setActError] = useState('');
  const [confirm, dialog] = useConfirm();

  async function act(p, action) {
    if (action === 'tolak' && !(await confirm(`Tolak pendaftaran ${p.nama}? Akun ini tidak akan bisa masuk.`, { title: 'Tolak pendaftaran?', ok: 'Ya, tolak' }))) return;
    try { await api.post(`/admin/akun/${p.id}/${action}`); setActError(''); load(); } catch (e) { setActError(e.message); }
  }

  const s = data?.stat || { total: '–', dosen: '–', mahasiswa: '–', pending: 0, kelas: '–' };
  const pending = data?.pending || [];
  const error = actError || loadError;
  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Dashboard" sub="Ringkasan pengguna dan aktivitas sistem" />
      {error && <Alert>{error}</Alert>}
      <Hero title="Panel Administrator"
        text={s.pending ? `${s.pending} akun dosen menunggu persetujuan.` : 'Tidak ada pendaftaran dosen yang menunggu.'}
        action={<Link to={s.pending ? '/admin/akun?status=pending' : '/admin/akun'} className="btn-white">Lihat akun</Link>} />
      <div className={STAT_GRID}>
        <Stat label="Total pengguna" value={s.total} icon="users" tint="#eaf1ff" color="#2563eb" />
        <Stat label="Dosen" value={s.dosen} note={s.pending ? `${s.pending} menunggu persetujuan` : undefined} icon="book" tint="#e0f2fe" color="#0284c7" />
        <Stat label="Mahasiswa" value={s.mahasiswa} icon="users" tint="#fef3c7" color="#d97706" />
        <Stat label="Kelas aktif" value={s.kelas} icon="grid" tint="#dcfce7" color="#16a34a" />
      </div>
      <section className="card !rounded-2xl !p-5">
        <h3 className="text-base font-semibold">Menunggu persetujuan dosen</h3>
        {pending.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Semua pendaftaran sudah ditinjau.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{p.nama}</p>
                  <p className="text-[13px] text-muted">{ID_LABEL[p.role]} {p.nim_nip} · daftar {fmtTanggal(p.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-danger btn-sm" onClick={() => act(p, 'tolak')}>Tolak</button>
                  <button className="btn-primary btn-sm" onClick={() => act(p, 'setuju')}>Setujui</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}

function DosenDashboard({ user }) {
  const { data, error } = useDashboard();
  const now = useNow();
  const loading = !data && !error;
  const r = data?.ringkas;
  const jadwal = data?.jadwal || [];
  const hariIni = jadwal.filter((j) => j.hari === NAMA_HARI[now.getDay()]).length;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Dashboard" sub="Ringkasan kelas dan presensi hari ini" />
      {error && <Alert>{error}</Alert>}
      <Hero title={`${sapaan(now)}, ${namaDepan(user.nama)}`}
        text={loading ? 'Memuat ringkasan...' : hariIni ? `Hari ini kamu mengajar ${hariIni} kelas.` : 'Tidak ada jadwal mengajar hari ini.'}
        action={<Link to="/jadwal" className="btn-white">Lihat jadwal</Link>} />
      <div className={STAT_GRID}>
        <Stat label="Kelas diampu" value={r ? r.kelas : '–'} note={r?.tahun_ajaran || undefined} icon="book" tint="#eaf1ff" color="#2563eb" />
        <Stat label="Total mahasiswa" value={r ? r.mahasiswa : '–'} icon="users" tint="#e0f2fe" color="#0284c7" />
        <Stat label="Sesi hari ini" value={r ? r.sesi_hari_ini : '–'} icon="clock" tint="#fef3c7" color="#d97706" />
        <Stat label="Rata-rata kehadiran" value={r ? pct(r.rata_hadir) : '–'} note={r && r.rata_hadir === null ? 'Belum ada data presensi' : undefined} icon="trend" tint="#dcfce7" color="#16a34a" />
      </div>
      <div className="grid items-start gap-[18px] lg:grid-cols-[1.45fr_1fr]">
        <PanelJadwal jadwal={jadwal} now={now} loading={loading} />
        <PanelKehadiran judul="Kehadiran per kelas" kelas={data?.kelas || []} batas={data?.batas ?? 75} loading={loading} />
      </div>
    </div>
  );
}

function MahasiswaDashboard({ user }) {
  const { data, error } = useDashboard();
  const now = useNow();
  const loading = !data && !error;
  const r = data?.ringkas;
  const jadwal = data?.jadwal || [];
  const hariIni = jadwal.filter((j) => j.hari === NAMA_HARI[now.getDay()]).length;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Dashboard" sub="Ringkasan kuliah kamu" />
      {error && <Alert>{error}</Alert>}
      <Hero title={`Halo, ${user.nama}`}
        text={loading ? 'Memuat ringkasan...' : r && r.kelas === 0 ? 'Kamu belum bergabung ke kelas mana pun.' : hariIni ? `Kamu punya ${hariIni} kelas hari ini.` : 'Tidak ada kuliah hari ini.'}
        action={<Link to="/rekap" className="btn-white">Lihat rekap</Link>} />
      <div className={STAT_GRID}>
        <Stat label="Kelas diikuti" value={r ? r.kelas : '–'} icon="book" tint="#eaf1ff" color="#2563eb" />
        <Stat label="Rata-rata kehadiran" value={r ? pct(r.rata_hadir) : '–'} note={r && r.rata_hadir === null ? 'Belum ada pertemuan tercatat' : undefined} icon="trend" tint="#e0f2fe" color="#0284c7" />
        <Stat label="Kelas hari ini" value={loading ? '–' : hariIni} icon="clock" tint="#fef3c7" color="#d97706" />
        <Stat label="Izin / sakit" value={r ? r.izin_sakit : '–'} note="total tercatat" icon="check" tint="#dcfce7" color="#16a34a" />
      </div>
      <div className="grid items-start gap-[18px] lg:grid-cols-[1.45fr_1fr]">
        <PanelJadwal jadwal={jadwal} now={now} loading={loading} />
        <PanelKehadiran judul="Kehadiran per mata kuliah" kelas={data?.kelas || []} batas={data?.batas ?? 75} loading={loading} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  return user.role === 'dosen' ? <DosenDashboard user={user} /> : <MahasiswaDashboard user={user} />;
}