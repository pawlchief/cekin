# Cekin: Sistem Presensi Perkuliahan (Kelompok A5)

Sub-issue **#1 Authentication**. Stack: **React (Vite) + Tailwind CSS**, **Node.js/Express** (API), **MySQL (port 3308)**.
Tampilan mengikuti file Figma (warna, font Inter, radius, layar Login/Daftar/Menunggu Persetujuan/Kelola Akun/Profil/Error).

## Menjalankan di VS Code

Butuh Node.js 20+ dan MySQL 8 di port **3308**.

```powershell
npm install
Copy-Item .env.example .env     # lalu isi .env (lihat di bawah)
npm run db:init                 # membuat tabel
npm run db:seed                 # akun demo (admin, dosen, mahasiswa); kata sandi acak tampil sekali di terminal
npm run dev                     # API :3001 + React :5174
```

Buka **http://localhost:5174** (bukan :3001). Vite meneruskan `/api` ke Express, jadi cookie session tetap satu origin.

> Windows: jika `npm` diblokir PowerShell ("running scripts is disabled"), jalankan sekali
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, lalu buka terminal baru.

### Isi `.env`
- `SESSION_SECRET`: wajib, 32+ karakter. Buat: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DB_PORT=3308`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: harus sama dengan MySQL-mu.
- `APP_URL=http://localhost:5174`: dipakai membuat tautan di email lupa kata sandi.
- Punya `.env` dari versi lama? Ubah `DB_PORT` jadi 3308 dan tambahkan `APP_URL` serta `SMTP_*`.

### Port yang dipakai
| Layanan | Port | Ubah di |
|---|---|---|
| API Express | 3001 | `PORT` di `.env` |
| React (Vite, dev) | 5174 | `client/vite.config.mjs` (+ `APP_URL` di `.env`) |
| MySQL | 3308 | `DB_PORT` di `.env` |

Port API dan React sengaja dibedakan (3001/5174) agar bisa jalan berdampingan dengan versi lain yang memakai 3000/5173. Kalau dua proyek sama-sama memakai MySQL di 3308, jalankan salah satunya saja atau ubah `DB_PORT` (di `.env` dan `compose.yaml`).

### MySQL di port 3308
- **Docker**: `docker compose up -d db` (sudah memetakan 127.0.0.1:3308). Isi `DB_PASSWORD` dan `DB_ROOT_PASSWORD` di `.env` dulu.
- **MySQL terpasang di Windows**: ubah `port=3308` di `my.ini` lalu restart service, atau pilih port itu saat instalasi. Buat database dan user:
  ```sql
  CREATE DATABASE cekin CHARACTER SET utf8mb4;
  CREATE USER 'cekin'@'%' IDENTIFIED BY 'passwordmu';
  GRANT ALL ON cekin.* TO 'cekin'@'%';
  ```

## Lupa kata sandi lewat email

Alur: `/lupa-password` (isi email) → email berisi tautan → `/reset-password?token=...` (kata sandi baru) → masuk lagi.

- Tautan berlaku **30 menit**, hanya bisa dipakai **sekali**; meminta tautan baru menghanguskan yang lama.
- Di database hanya tersimpan **hash SHA-256** token (tabel `password_resets`), token asli hanya ada di email.
- Pesan balasan selalu sama, email terdaftar atau tidak (cegah penebakan email). Hanya akun **aktif** yang dikirimi email.
- Jeda 60 detik per akun, dan rate limit 5 permintaan/jam per IP.
- Setelah reset, semua sesi login akun itu dikeluarkan.

**Saat pengembangan** biarkan `SMTP_HOST` kosong: email tidak dikirim, tautannya dicetak di terminal server (`[EMAIL-DEV]`).

**Mengirim email sungguhan** (isi di `.env`), contoh Gmail:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=emailkamu@gmail.com
SMTP_PASS=<App Password 16 karakter>
MAIL_FROM="Cekin <emailkamu@gmail.com>"
```
App Password dibuat di akun Google (wajib aktifkan verifikasi 2 langkah, lalu menu "App passwords"). Jangan pakai kata sandi Gmail biasa. Untuk demo tanpa mengirim ke inbox sungguhan, pakai Mailtrap/Ethereal.
Di produksi `SMTP_HOST` wajib diisi, kalau kosong permintaan reset gagal dicatat di log server.

## Checklist sub-issue #1

| Checklist | Di mana |
|---|---|
| Register/login dengan role (dosen & mahasiswa) | `server/routes/auth.js`, `client/src/pages/Login.jsx`, `Register.jsx` |
| Logout | `POST /api/auth/logout` (hapus session di server + cookie `APP_SESSION`) |
| Hash password dan session login | bcrypt cost 12; session di tabel `sessions` (MySQL) |
| Middleware cek login dan cek role | `server/middleware/auth.js` (`requireLogin`, `requireRole`) |
| Manajemen akun oleh admin | `server/routes/admin.js`, `client/src/pages/AdminAkun.jsx` (setujui/tolak, nonaktifkan, reset, tambah, hapus) |
| View profile dan ganti password | `server/routes/profil.js`, `client/src/pages/Profil.jsx` (lihat, edit, ganti password) |
| Lupa kata sandi (tambahan) | `server/routes/auth.js` (`/forgot`, `/reset`), `ForgotPassword.jsx`, `ResetPassword.jsx` |

**Alur akun** (sesuai Figma):
- **Login** memakai **NIM / NIP / username** (email tetap diterima). Admin demo masuk dengan username `admin`.
- **Mahasiswa**: daftar → langsung aktif → masuk.
- **Dosen**: daftar → status `pending` (layar "Menunggu Persetujuan") → admin menyetujui di **Kelola Akun** → baru bisa masuk.
- Admin bisa **Setujui / Tolak**, **Nonaktifkan / Aktifkan**, **Reset password** (password sementara tampil sekali), **Tambah akun**, dan **Hapus** akun.
- Profil: data diri + edit (nama, No. HP, program studi/angkatan untuk mahasiswa, departemen/jabatan untuk dosen) dan ganti password. Email, NIM/NIP/username, dan peran hanya diubah admin.

**Database lama?** Jalankan `npm run db:init` lagi: skrip menambah kolom profil dan status `nonaktif` secara otomatis. Lalu `npm run db:seed` agar admin lama mendapat username `admin`.

## Keamanan

- Cookie `APP_SESSION`: `httpOnly`, `sameSite=strict`, 24 jam, `secure` jika `COOKIE_SECURE=true` (wajib true di produksi/HTTPS).
- Satu akun, satu sesi. Ganti/reset password, tolak, dan hapus akun juga mengeluarkan semua sesi.
- Session baru dibuat setelah login (cegah session fixation). Token CSRF di header `X-CSRF-Token` untuk semua POST/PUT.
- Rate limit login/daftar/lupa/reset. Semua query parameterized. Validasi input di backend (`server/lib/validate.js`).
- Pesan login sama untuk akun salah dan sandi salah; waktu respons disamakan.
- User dimuat dari database tiap request: akun yang dihapus/ditolak/dinonaktifkan langsung kehilangan akses.
- Rahasia hanya dari `.env` (jangan di-commit). Server menolak start jika `SESSION_SECRET` < 32 karakter.
- Pelindung halaman di React hanya untuk UX; hak akses sebenarnya dicek di server.

## Produksi

```bash
npm run build      # React -> client/dist
npm start          # Express melayani API dan React di satu port (3001)
```
Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true` (di belakang Caddy/Nginx), `APP_URL=https://domainmu`, dan SMTP.

## Cara anggota lain memasang modulnya

1. Tambah tabel di `database/schema.sql`, jalankan `npm run db:init`.
2. API: buat `server/routes/<modul>.js` (pakai `req.user` dan `requireRole('dosen')`), pasang di `server/index.js` di bawah komentar "Anggota lain" (otomatis wajib login).
3. UI: buat halaman di `client/src/pages/`, tambah `<Route>` di `client/src/App.jsx`, tambah menu di `client/src/nav.js`.
4. Panggil API lewat `import { api } from '../api.js'` (`api.get/post/put`; CSRF diurus otomatis). Untuk dialog konfirmasi hapus pakai `useConfirm()` dari `components/ui.jsx`.

## Struktur

```
database/schema.sql        users (+ profil, status), password_resets, sessions
scripts/                   migrate.js, seed.js
server/                    API Express (index.js, routes/, middleware/, lib/, config/)
client/                    React + Vite + Tailwind (src/pages, src/components, nav.js, api.js). Logo dan ikon dari Figma: components/Logo.jsx, Icon.jsx
compose.yaml               MySQL dev di port 3308
```

## Tentang `npm audit`
Paket yang berjalan di server (nodemailer, mysql2) dan React Router sudah dipakai di versi yang tidak ditandai rentan.
Sisa peringatan ada di **Vite/esbuild**, yang hanya dipakai saat `npm run dev` di laptop (tidak ikut berjalan di produksi). Jangan jalankan server dev ke jaringan umum.
Jangan pakai `npm audit fix --force`: itu menaikkan Vite ke versi yang butuh Node 20.19+ dan bisa merusak proyek. Kalau Node kamu 20.19+ atau 22.12+, boleh naikkan `vite` dan `@vitejs/plugin-react` secara terpisah.

## Catatan
- Font Inter dimuat dari Google Fonts (CSP sudah mengizinkan).
- Belum ada "ingat saya". Dashboard dosen/mahasiswa dibuat minimal; kartu statistik kelas menyusul setelah modul anggota lain terpasang.
