import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Pending from '../components/Pending.jsx';
import { Alert, Field, PasswordInput } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const loc = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={loc.state?.from || '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      if (err.code === 'PENDING') setPending(err.data);
      else setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell variant={pending ? 'compact' : 'login'}>
      {pending ? (
        <Pending data={pending} />
      ) : (
        <div className="card p-6 sm:p-9">
          <h1 className="text-[28px] font-bold leading-tight">Selamat datang</h1>
          <p className="mt-2 text-sm text-muted">Masuk dengan NIM / NIP / username kamu.</p>
          <div className="mt-4 space-y-3">
            {loc.state?.notice && <Alert type="ok">{loc.state.notice}</Alert>}
            {error && <Alert>{error}</Alert>}
          </div>
          <form onSubmit={submit} className="mt-[18px] space-y-[18px]">
            <Field label="NIM / NIP / Username" id="identifier">
              <input id="identifier" className="input !h-[46px]" placeholder="Contoh: 2210010001" autoComplete="username" required autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </Field>
            <Field label="Password" id="password">
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
            </Field>
            <div className="text-right">
              <Link to="/lupa-password" className="text-[13px] font-semibold text-primary hover:underline">Lupa kata sandi?</Link>
            </div>
            <button className="btn-primary w-full !py-3.5" disabled={busy}>{busy ? 'Memproses...' : 'Masuk'}</button>
          </form>
          <p className="mt-[18px] text-center text-[13px] text-muted">
            Belum punya akun? <Link className="font-semibold text-primary hover:underline" to="/daftar">Daftar</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
