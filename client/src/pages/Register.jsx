import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Icon from '../components/Icon.jsx';
import Pending from '../components/Pending.jsx';
import { ErrorList, Field, PasswordInput } from '../components/ui.jsx';

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ role: 'mahasiswa', nama: '', nim_nip: '', email: '', password: '' });
  const [errors, setErrors] = useState([]);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      const d = await api.post('/auth/register', f);
      if (d.status === 'pending') setDone(d); // dosen: tunggu persetujuan admin
      else navigate('/login', { replace: true, state: { notice: 'Pendaftaran berhasil. Silakan masuk.' } });
    } catch (err) {
      setErrors(err.errors);
      setBusy(false);
    }
  }

  const peran = (value, label, icon) => (
    <button type="button" role="radio" aria-checked={f.role === value} onClick={() => setF({ ...f, role: value })}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${f.role === value ? 'border-2 border-primary bg-soft text-primary' : 'border border-line bg-white text-muted hover:text-ink'}`}>
      <Icon name={icon} /> {label}
    </button>
  );

  return (
    <AuthShell variant="compact">
      {done ? (
        <Pending data={done} />
      ) : (
        <div className="card p-6 sm:p-9">
          <h1 className="text-[26px] font-bold leading-tight">Buat akun baru</h1>
          <p className="mt-2 text-sm text-muted">Pilih peran, lalu isi data diri.</p>
          <div className="mt-3.5"><ErrorList errors={errors} /></div>
          <form onSubmit={submit} className="mt-3.5 space-y-3.5">
            <div className="flex gap-2.5" role="radiogroup" aria-label="Daftar sebagai">{peran('mahasiswa', 'Mahasiswa', 'user')}{peran('dosen', 'Dosen', 'book')}</div>
            <Field label="Nama lengkap" id="nama"><input id="nama" className="input" required maxLength={100} autoComplete="name" value={f.nama} onChange={set('nama')} /></Field>
            <Field label={f.role === 'dosen' ? 'NIP' : 'NIM'} id="nim"><input id="nim" className="input" required maxLength={30} value={f.nim_nip} onChange={set('nim_nip')} /></Field>
            <Field label="Email" id="email"><input id="email" className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Password" id="password" hint="Minimal 8 karakter, kombinasi huruf dan angka.">
              <PasswordInput id="password" value={f.password} onChange={set('password')} autoComplete="new-password" />
            </Field>
            <div className="flex items-start gap-2.5 rounded-btn bg-soft p-3 text-xs text-muted">
              <Icon name="clock" className="mt-0.5 text-primary" />
              <p>Akun dosen perlu disetujui administrator sebelum bisa digunakan.</p>
            </div>
            <button className="btn-primary w-full !py-3.5" disabled={busy}>{busy ? 'Memproses...' : 'Daftar'}</button>
          </form>
          <p className="mt-3.5 text-center text-[13px] text-muted">
            Sudah punya akun? <Link className="font-semibold text-primary hover:underline" to="/login">Masuk</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
