import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Deco, ErrorList, Field, PageHead, PasswordInput, initials } from '../components/ui.jsx';
import { ID_LABEL, ROLE_LABEL, fmtWaktu } from '../nav.js';

// Kolom yang tampil per peran. Kolom dengan awalan "_" hanya-baca; sisanya bisa diedit sendiri.
const FIELDS = {
  mahasiswa: [['nama', 'Nama lengkap'], ['_id'], ['_email'], ['no_hp', 'No. HP'], ['program_studi', 'Program studi'], ['angkatan', 'Angkatan']],
  dosen: [['nama', 'Nama lengkap'], ['_id'], ['_email'], ['no_hp', 'No. HP'], ['departemen', 'Departemen'], ['jabatan', 'Jabatan']],
  admin: [['nama', 'Nama lengkap'], ['_id'], ['_email'], ['no_hp', 'No. HP'], ['_akses'], ['_login']]
};

const Tile = ({ label, value }) => (
  <div className="flex min-w-0 flex-col gap-[3px] rounded-btn border border-line bg-field p-3">
    <span className="text-[11px] font-medium text-muted">{label}</span>
    <span className="truncate text-sm font-semibold">{value || '—'}</span>
  </div>
);

function InfoCard() {
  const { user, setUser } = useAuth();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [info, setInfo] = useState({ errors: [], ok: '' });
  const [busy, setBusy] = useState(false);

  const fixed = { _id: [ID_LABEL[user.role], user.nim_nip], _email: ['Email', user.email], _akses: ['Hak akses', ROLE_LABEL[user.role]], _login: ['Login terakhir', fmtWaktu(user.last_login_at)] };

  function mulai() {
    setForm({ ...user, angkatan: user.angkatan ?? '' });
    setInfo({ errors: [], ok: '' });
    setEdit(true);
  }
  async function simpan(e) {
    e.preventDefault();
    setBusy(true);
    setInfo({ errors: [], ok: '' });
    try {
      const d = await api.put('/profil', form);
      setUser(d.user);
      setEdit(false);
      setInfo({ errors: [], ok: d.message });
    } catch (err) { setInfo({ errors: err.errors, ok: '' }); }
    setBusy(false);
  }

  return (
    <form onSubmit={simpan} className="card min-w-0 flex-1 !rounded-2xl !p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Informasi akun</h2>
        {!edit ? (
          <button type="button" className="btn-ghost btn-sm" onClick={mulai}><Icon name="edit" className="text-primary" /> Edit profil</button>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(false)}>Batal</button>
            <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        )}
      </div>
      <div className="mt-3.5 space-y-3"><ErrorList errors={info.errors} />{info.ok && <Alert type="ok">{info.ok}</Alert>}</div>
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        {FIELDS[user.role].map(([key, label]) => {
          if (key.startsWith('_')) return <Tile key={key} label={fixed[key][0]} value={fixed[key][1]} />;
          if (!edit) return <Tile key={key} label={label} value={user[key]} />;
          return (
            <Field key={key} label={label} id={`f-${key}`}>
              <input id={`f-${key}`} className="input !h-10" value={form[key] ?? ''} maxLength={key === 'nama' ? 100 : 100}
                inputMode={key === 'angkatan' ? 'numeric' : undefined} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </Field>
          );
        })}
      </div>
      <p className="mt-3.5 text-xs text-muted">Email, {ID_LABEL[user.role]}, dan peran hanya bisa diubah administrator.</p>
    </form>
  );
}

function PasswordCard() {
  const { logout } = useAuth();
  const kosong = { lama: '', baru: '', konfirmasi: '' };
  const [pw, setPw] = useState(kosong);
  const [info, setInfo] = useState({ errors: [], ok: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setPw({ ...pw, [k]: e.target.value });

  async function ganti(e) {
    e.preventDefault();
    setInfo({ errors: [], ok: '' });
    setBusy(true);
    try {
      const d = await api.post('/profil/password', pw);
      setPw(kosong);
      setInfo({ errors: [], ok: d.message });
    } catch (err) { setInfo({ errors: err.errors, ok: '' }); }
    setBusy(false);
  }

  return (
    <form onSubmit={ganti} className="card flex w-full flex-col gap-3 !rounded-2xl !p-5 lg:w-[380px] lg:shrink-0">
      <div className="flex items-center gap-2.5">
        <span className="flex size-[34px] items-center justify-center rounded-btn bg-soft text-primary"><Icon name="lock" /></span>
        <h2 className="text-base font-semibold">Ganti password</h2>
      </div>
      <ErrorList errors={info.errors} />
      {info.ok && <Alert type="ok">{info.ok}</Alert>}
      <Field label="Password lama" id="lama"><PasswordInput id="lama" value={pw.lama} onChange={set('lama')} autoComplete="current-password" placeholder="••••••••" /></Field>
      <Field label="Password baru" id="baru"><PasswordInput id="baru" value={pw.baru} onChange={set('baru')} autoComplete="new-password" placeholder="••••••••" /></Field>
      <Field label="Konfirmasi password baru" id="konfirmasi"><PasswordInput id="konfirmasi" value={pw.konfirmasi} onChange={set('konfirmasi')} autoComplete="new-password" placeholder="••••••••" /></Field>
      <p className="text-xs text-muted">Minimal 8 karakter, kombinasi huruf dan angka.</p>
      <button className="btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan password'}</button>
      <button type="button" className="btn-danger" onClick={logout}><Icon name="logout" /> Keluar dari akun</button>
    </form>
  );
}

export default function Profil() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Profil Saya" sub="Kelola informasi akun dan keamanan" />
      <section className="overflow-hidden rounded-[20px] border border-line bg-white shadow-card">
        <div className="relative flex h-[150px] items-end gap-5 overflow-hidden bg-gradient-to-b from-primary to-royal p-5 sm:p-7">
          <Deco className="-right-[60px] -top-[90px] size-[300px]" />
          <Deco className="right-10 top-10 size-[200px]" />
          <Deco className="-left-[50px] top-20 size-[140px]" />
          <span className="relative flex size-[96px] shrink-0 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-accent to-[#f59e0b] text-[34px] font-bold text-navy">{initials(user.nama)}</span>
          <div className="relative min-w-0 pb-1">
            <p className="truncate text-xl font-bold text-white sm:text-[26px]">{user.nama}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.22] px-2.5 py-1 text-xs font-semibold text-white">{ROLE_LABEL[user.role]}</span>
              <span className="text-[13px] text-mist">{ID_LABEL[user.role]} {user.nim_nip}</span>
            </div>
          </div>
        </div>
      </section>
      <div className="flex flex-col items-start gap-[18px] lg:flex-row">
        <InfoCard />
        <PasswordCard />
      </div>
    </div>
  );
}
