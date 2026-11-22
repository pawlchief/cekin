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
