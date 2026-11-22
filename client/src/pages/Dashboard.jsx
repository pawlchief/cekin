import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Deco, PageHead, useConfirm } from '../components/ui.jsx';
import { ID_LABEL, ROLE_LABEL, fmtTanggal } from '../nav.js';

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

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirm, dialog] = useConfirm();
  const load = () => api.get('/dashboard').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(p, action) {
    if (action === 'tolak' && !(await confirm(`Tolak pendaftaran ${p.nama}? Akun ini tidak akan bisa masuk.`, { title: 'Tolak pendaftaran?', ok: 'Ya, tolak' }))) return;
    try { await api.post(`/admin/akun/${p.id}/${action}`); load(); } catch (e) { setError(e.message); }
  }

  const s = data?.stat || { total: '–', dosen: '–', mahasiswa: '–', pending: 0 };
  const pending = data?.pending || [];
  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Dashboard" sub="Ringkasan pengguna dan aktivitas sistem" />
      {error && <Alert>{error}</Alert>}
      <Hero title="Panel Administrator"
        text={s.pending ? `${s.pending} akun dosen menunggu persetujuan.` : 'Tidak ada pendaftaran dosen yang menunggu.'}
        action={<Link to={s.pending ? '/admin/akun?status=pending' : '/admin/akun'} className="btn-white">Lihat akun</Link>} />
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total pengguna" value={s.total} icon="users" tint="#eaf1ff" color="#2563eb" />
        <Stat label="Dosen" value={s.dosen} note={s.pending ? `${s.pending} menunggu persetujuan` : undefined} icon="book" tint="#e0f2fe" color="#0284c7" />
        <Stat label="Mahasiswa" value={s.mahasiswa} icon="users" tint="#fef3c7" color="#d97706" />
        <Stat label="Kelas aktif" value="—" note="Muncul setelah modul kelas terpasang" icon="grid" tint="#dcfce7" color="#16a34a" />
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

function MemberDashboard({ user }) {
  const first = user.nama.replace(/^(Dr\.|Prof\.|Ir\.)\s*/i, '').split(/[\s,]+/)[0];
  const dosen = user.role === 'dosen';
  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Dashboard" sub={dosen ? 'Ringkasan kelas yang kamu ampu' : 'Ringkasan kuliah kamu'} />
      <Hero title={`Halo, ${first}`} text="Akun kamu sudah aktif dan siap dipakai." action={<Link to="/profil" className="btn-white">Lihat profil</Link>} />
      <section className="card !rounded-2xl !p-5">
        <h3 className="text-base font-semibold">Yang bisa kamu lakukan sekarang</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm marker:text-primary">
          <li>Lengkapi data profil dan nomor HP.</li>
          <li>Ganti password dari halaman profil.</li>
          <li>{dosen ? 'Kelas, jadwal, dan sesi presensi akan muncul di menu setelah modulnya terpasang.' : 'Gabung kelas dan isi presensi akan muncul di menu setelah modulnya terpasang.'}</li>
        </ul>
        <p className="mt-4 text-xs text-muted">Masuk sebagai {ROLE_LABEL[user.role]}.</p>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminDashboard /> : <MemberDashboard user={user} />;
}
