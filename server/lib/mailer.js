
const nodemailer = require('nodemailer');
const { esc } = require('./helpers');

function transport() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined
  });
}

async function sendResetOtpEmail(user, otp) {
  const t = transport();

  if (!t) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP belum dikonfigurasi.');
    }

    console.log(
      `\n[EMAIL-DEV] SMTP kosong, email tidak dikirim.\n` +
      `  Ke  : ${user.email}\n` +
      `  OTP : ${otp}\n`
    );
    return;
  }

  const text = `Halo ${user.nama},

Kami menerima permintaan untuk mengatur ulang kata sandi akun Cekin kamu.

Kode OTP kamu:
${otp}

Kode ini berlaku selama 5 menit dan hanya bisa digunakan satu kali.

Jika bukan kamu yang meminta kode ini, abaikan email ini.`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f1e3c">
      <h2>Atur ulang kata sandi Cekin</h2>
      <p>Halo ${esc(user.nama)},</p>
      <p>Gunakan kode berikut untuk mengatur ulang kata sandi akunmu:</p>
      <div style="margin:24px 0;padding:18px;background:#eff6ff;border-radius:12px;text-align:center">
        <strong style="font-size:32px;letter-spacing:8px;color:#2563eb">${esc(otp)}</strong>
      </div>
      <p>Kode berlaku selama <b>5 menit</b> dan hanya bisa digunakan satu kali.</p>
      <p style="font-size:13px;color:#64748b">
        Jika bukan kamu yang meminta kode ini, abaikan email ini.
      </p>
    </div>
  `;

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Kode OTP Reset Kata Sandi Cekin',
    text,
    html
  });
}

module.exports = { sendResetOtpEmail };
