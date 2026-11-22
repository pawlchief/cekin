
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);

    try {
      const d = await api.post('/auth/forgot', { email });
      setMessage(d.message);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const d = await api.post('/auth/forgot/verify', {
        email,
        otp
      });

      api.setCsrf(d.csrfToken);
      navigate('/reset-password', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="card p-6 sm:p-9">
        <h1 className="text-2xl font-bold">Lupa kata sandi</h1>

        {step === 1 ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Masukkan email akunmu. Kami akan mengirimkan kode OTP untuk mengatur ulang kata sandi.
            </p>

            <form onSubmit={sendOtp} className="mt-6 space-y-4">
              {error && <Alert>{error}</Alert>}

              <Field label="Email" id="email">
                <input
                  id="email"
                  className="input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <button className="btn-primary w-full" disabled={busy}>
                {busy ? 'Mengirim OTP...' : 'Kirim kode OTP'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Masukkan kode OTP 6 digit yang dikirim ke email:
              <strong className="block mt-1">{email}</strong>
            </p>

            {message && (
              <div className="mt-4">
                <Alert type="ok">{message}</Alert>
              </div>
            )}

            <form onSubmit={verifyOtp} className="mt-6 space-y-4">
              {error && <Alert>{error}</Alert>}

              <Field label="Kode OTP" id="otp">
                <input
                  id="otp"
                  className="input text-center tracking-[0.5em] text-xl"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
              </Field>

              <button className="btn-primary w-full" disabled={busy}>
                {busy ? 'Memverifikasi...' : 'Verifikasi OTP'}
              </button>

              <button
                type="button"
                className="btn-ghost w-full"
                disabled={busy}
                onClick={() => {
                  setStep(1);
                  setOtp('');
                  setError('');
                  setMessage('');
                }}
              >
                Ganti email
              </button>
            </form>
          </>
        )}

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
