
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import { Alert, ErrorList, Field, PasswordInput } from '../components/ui.jsx';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [f, setF] = useState({
    password: '',
    konfirmasi: ''
  });

  const [errors, setErrors] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    setError('');
    setBusy(true);

    try {
      const d = await api.post('/auth/reset', f);

      navigate('/login', {
        replace: true,
        state: { notice: d.message }
      });
    } catch (err) {
      setErrors(err.errors || []);
      setError(err.errors?.length ? '' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="card p-6 sm:p-9">
        <h1 className="text-2xl font-bold">
          Buat kata sandi baru
        </h1>

        <p className="mt-1 text-sm text-muted">
          Verifikasi OTP berhasil. Sekarang buat kata sandi baru untuk akunmu.
        </p>

        <div className="mt-5">
          {error && <Alert>{error}</Alert>}
          <ErrorList errors={errors} />
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field
            label="Kata sandi baru"
            id="password"
            hint="Minimal 8 karakter, memuat huruf dan angka."
          >
            <PasswordInput
              id="password"
              value={f.password}
              onChange={(e) =>
                setF({ ...f, password: e.target.value })
              }
              autoComplete="new-password"
            />
          </Field>

          <Field
            label="Ulangi kata sandi baru"
            id="konfirmasi"
          >
            <PasswordInput
              id="konfirmasi"
              value={f.konfirmasi}
              onChange={(e) =>
                setF({ ...f, konfirmasi: e.target.value })
              }
              autoComplete="new-password"
            />
          </Field>

          <button
            className="btn-primary w-full"
            disabled={busy}
          >
            {busy ? 'Menyimpan...' : 'Simpan kata sandi'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link
            className="font-semibold text-primary hover:underline"
            to="/login"
          >
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
