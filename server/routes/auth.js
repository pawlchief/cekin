
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool, q, one } = require('../config/db');
const { USER_COLS } = require('../middleware/auth');
const V = require('../lib/validate');
const { publicUser, newCsrf, sha256 } = require('../lib/helpers');
const { killUserSessions } = require('../lib/sessions');
const { sendResetOtpEmail } = require('../lib/mailer');
const crypto = require('crypto');

const COST = 12;
const DUMMY_HASH = bcrypt.hashSync('tidak-dipakai-1', COST);

const regenerate = (req) =>
  new Promise((ok, no) =>
    req.session.regenerate((e) => (e ? no(e) : ok()))
  );

const limiter = (windowMs, limit, error, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error })
  });

const loginLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
  true
);

const registerLimiter = limiter(
  60 * 60 * 1000,
  10,
  'Terlalu banyak pendaftaran dari alamat ini. Coba lagi nanti.'
);

const forgotLimiter = limiter(
  60 * 60 * 1000,
  5,
  'Terlalu banyak permintaan. Coba lagi dalam 1 jam.'
);

const verifyOtpLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Terlalu banyak percobaan OTP. Coba lagi dalam 15 menit.'
);

const resetLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'
);

router.get('/csrf', (req, res) =>
  res.json({ csrfToken: req.session.csrf })
);

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Belum masuk.' });
  }

  res.json({ user: publicUser(req.user) });
});

// LOGIN
router.post('/login', loginLimiter, async (req, res) => {
  const ident = V.str(req.body.identifier ?? req.body.email, {
    min: 3,
    max: 150
  });

  const password =
    typeof req.body.password === 'string' ? req.body.password : '';

  const bad = () =>
    res.status(401).json({
      error: 'NIM / NIP / username atau kata sandi salah.'
    });

  if (!ident || !password || password.length > 72) {
    return bad();
  }

  const u = await one(
    'SELECT * FROM users WHERE email = ? OR nim_nip = ? LIMIT 1',
    [ident.toLowerCase(), ident]
  );

  const match = await bcrypt.compare(
    password,
    u ? u.password_hash : DUMMY_HASH
  );

  if (!u || !match) return bad();

  if (u.status === 'pending') {
    return res.status(403).json({
      code: 'PENDING',
      error: 'Akun menunggu persetujuan administrator.',
      nama: u.nama,
      nim_nip: u.nim_nip,
      role: u.role,
      created_at: u.created_at
    });
  }

  if (u.status === 'ditolak') {
    return res.status(403).json({
      code: 'DITOLAK',
      error: 'Pendaftaran akun ini ditolak. Hubungi administrator.'
    });
  }

  if (u.status === 'nonaktif') {
    return res.status(403).json({
      code: 'NONAKTIF',
      error: 'Akun dinonaktifkan. Hubungi administrator.'
    });
  }

  await q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [u.id]);

  const fresh = await one(
    `SELECT ${USER_COLS} FROM users WHERE id = ?`,
    [u.id]
  );

  await regenerate(req);

  req.session.userId = u.id;
  req.session.csrf = newCsrf();

  await killUserSessions(u.id, req.sessionID);

  res.json({
    user: publicUser(fresh),
    csrfToken: req.session.csrf
  });
});

// LOGOUT
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('APP_SESSION', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.COOKIE_SECURE === 'true'
    });

    res.json({ ok: true });
  });
});

// REGISTER
router.post('/register', registerLimiter, async (req, res) => {
  const b = req.body;
  const errors = [];

  const nama = V.str(b.nama, { min: 2, max: 100 });
  const email = V.email(b.email);
  const role = V.oneOf(b.role, ['dosen', 'mahasiswa']);
  const nimNip = V.nimNip(b.nim_nip);
  const pwErr = V.passwordError(b.password);

  if (!nama) {
    errors.push('Nama lengkap wajib diisi (2-100 karakter).');
  }

  if (!email) {
    errors.push('Format email tidak valid.');
  }

  if (!role) {
    errors.push('Pilih peran: dosen atau mahasiswa.');
  }

  if (!nimNip) {
    errors.push(
      `${role === 'dosen' ? 'NIP' : 'NIM'} wajib diisi (huruf, angka, titik, atau strip).`
    );
  }

  if (pwErr) {
    errors.push(pwErr);
  } else if (
    b.konfirmasi !== undefined &&
    b.password !== b.konfirmasi
  ) {
    errors.push('Konfirmasi kata sandi tidak sama.');
  }

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  try {
    const hash = await bcrypt.hash(b.password, COST);

    await q(
      'INSERT INTO users (nama, email, nim_nip, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [
        nama,
        email,
        nimNip,
        hash,
        role,
        role === 'dosen' ? 'pending' : 'aktif'
      ]
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_ENTRY') throw e;

    return res.status(409).json({
      errors: [
        /nim_nip/.test(e.message)
          ? 'NIM/NIP sudah terdaftar.'
          : 'Email sudah terdaftar.'
      ]
    });
  }

  const baru = await one(
    'SELECT created_at FROM users WHERE email = ?',
    [email]
  );

  res.status(201).json({
    status: role === 'dosen' ? 'pending' : 'aktif',
    nama,
    nim_nip: nimNip,
    role,
    created_at: baru.created_at
  });
});

// ---- LUPA PASSWORD: KIRIM OTP ----

const GENERIC =
  'Jika email terdaftar, kode OTP sudah dikirim. Periksa kotak masuk dan folder spam.';

router.post('/forgot', forgotLimiter, async (req, res) => {
  const email = V.email(req.body.email);

  if (!email) {
    return res.status(400).json({
      error: 'Format email tidak valid.'
    });
  }

  const u = await one(
    'SELECT id, nama, email, status FROM users WHERE email = ?',
    [email]
  );

  if (!u || u.status !== 'aktif') {
    return res.json({ message: GENERIC });
  }

  try {
    // Cegah pengiriman OTP berulang dalam 60 detik.
    const recent = await one(
      `SELECT 1 AS x FROM password_resets
       WHERE user_id = ?
       AND created_at > (NOW() - INTERVAL 60 SECOND)`,
      [u.id]
    );

    if (recent) {
      return res.json({ message: GENERIC });
    }

    // OTP terdiri dari 6 angka.
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Hanguskan semua OTP sebelumnya.
    await q(
      `UPDATE password_resets
       SET used_at = NOW()
       WHERE user_id = ? AND used_at IS NULL`,
      [u.id]
    );

    // Simpan hash OTP, bukan kode aslinya.
    await q(
      `INSERT INTO password_resets
       (user_id, token_hash, expires_at, attempts, verified_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, NULL)`,
      [u.id, sha256(otp)]
    );

    await sendResetOtpEmail(u, otp);

    return res.json({ message: GENERIC });
  } catch (e) {
    console.error('Gagal mengirim OTP:', e.message);
    return res.json({ message: GENERIC });
  }
});

// ---- VERIFIKASI OTP ----

router.post('/forgot/verify', verifyOtpLimiter, async (req, res) => {
  const email = V.email(req.body.email);
  const otp = String(req.body.otp || '');

  if (!email || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      error: 'Email atau kode OTP tidak valid.'
    });
  }

  const reset = await one(
    `SELECT pr.id, pr.user_id, pr.token_hash, pr.attempts
     FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE u.email = ?
       AND u.status = 'aktif'
       AND pr.used_at IS NULL
       AND pr.verified_at IS NULL
       AND pr.expires_at > NOW()
       AND pr.attempts < 5
     ORDER BY pr.created_at DESC, pr.id DESC
     LIMIT 1`,
    [email]
  );

  if (!reset) {
    return res.status(400).json({
      error: 'OTP tidak valid, sudah kedaluwarsa, atau batas percobaan habis. Silakan minta kode baru.'
    });
  }

  const inputHash = Buffer.from(sha256(otp), 'hex');
  const savedHash = Buffer.from(reset.token_hash, 'hex');

  const match =
    inputHash.length === savedHash.length &&
    crypto.timingSafeEqual(inputHash, savedHash);

  if (!match) {
    await q(
      `UPDATE password_resets
       SET attempts = attempts + 1,
           used_at = IF(attempts + 1 >= 5, NOW(), used_at)
       WHERE id = ?
         AND used_at IS NULL
         AND verified_at IS NULL
         AND attempts < 5
         AND expires_at > NOW()`,
      [reset.id]
    );

    return res.status(400).json({
      error: 'Kode OTP salah. Periksa kembali kode yang dikirim ke email.'
    });
  }

  const mark = await q(
    `UPDATE password_resets
     SET verified_at = NOW()
     WHERE id = ?
       AND used_at IS NULL
       AND verified_at IS NULL
       AND attempts < 5
       AND expires_at > NOW()`,
    [reset.id]
  );

  if (mark.affectedRows !== 1) {
    return res.status(400).json({
      error: 'OTP tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.'
    });
  }

  // Buat session baru agar verifikasi OTP terikat pada browser ini.
  await regenerate(req);

  req.session.passwordResetId = reset.id;
  req.session.csrf = newCsrf();

  res.json({
    message: 'OTP berhasil diverifikasi. Silakan buat kata sandi baru.',
    csrfToken: req.session.csrf
  });
});

// ---- SIMPAN PASSWORD BARU ----

router.post('/reset', resetLimiter, async (req, res) => {
  const resetId = req.session.passwordResetId;

  if (!resetId) {
    return res.status(400).json({
      error: 'Verifikasi OTP terlebih dahulu sebelum mengganti kata sandi.'
    });
  }

  const pwErr = V.passwordError(req.body.password);

  if (pwErr) {
    return res.status(400).json({ errors: [pwErr] });
  }

  if (req.body.password !== req.body.konfirmasi) {
    return res.status(400).json({
      errors: ['Konfirmasi kata sandi tidak sama.']
    });
  }

  const passwordHash = await bcrypt.hash(req.body.password, COST);
  const conn = await pool.getConnection();

  let userId;

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT pr.id, pr.user_id
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.id = ?
         AND pr.verified_at IS NOT NULL
         AND pr.used_at IS NULL
         AND pr.expires_at > NOW()
         AND pr.attempts < 5
         AND u.status = 'aktif'
       FOR UPDATE`,
      [resetId]
    );

    const reset = rows[0];

    if (!reset) {
      await conn.rollback();

      delete req.session.passwordResetId;

      return res.status(400).json({
        error: 'Verifikasi OTP sudah kedaluwarsa atau sudah digunakan. Silakan ulangi proses lupa password.'
      });
    }

    userId = reset.user_id;

    // Tandai OTP sudah digunakan.
    await conn.execute(
      'UPDATE password_resets SET used_at = NOW() WHERE id = ?',
      [reset.id]
    );

    // Simpan password baru.
    await conn.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId]
    );

    // Hanguskan OTP lain milik akun tersebut.
    await conn.execute(
      `UPDATE password_resets
       SET used_at = NOW()
       WHERE user_id = ?
         AND used_at IS NULL`,
      [userId]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  delete req.session.passwordResetId;

  // Keluarkan semua sesi login akun tersebut.
  await killUserSessions(userId);

  res.json({
    message: 'Kata sandi berhasil diganti. Silakan masuk dengan kata sandi baru.'
  });
});

module.exports = router;
