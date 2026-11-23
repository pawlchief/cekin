-- Cekin: skema sub-issue #1 (Authentication). MySQL 8
-- Anggota lain menambahkan tabel modulnya sendiri di file ini (atau file terpisah).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  nim_nip       VARCHAR(30)  NULL COMMENT 'NIM (mahasiswa) / NIP (dosen) / username (admin)',
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin','dosen','mahasiswa') NOT NULL,
  status        ENUM('pending','aktif','ditolak','nonaktif') NOT NULL DEFAULT 'pending',
  no_hp         VARCHAR(20)  NULL,
  program_studi VARCHAR(100) NULL,
  angkatan      SMALLINT UNSIGNED NULL,
  departemen    VARCHAR(100) NULL,
  jabatan       VARCHAR(100) NULL,
  last_login_at DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nim_nip (nim_nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OTP lupa kata sandi. Yang disimpan hanya hash SHA-256.
CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabel session (dipakai express-mysql-session)
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
) ENGINE=InnoDB;


-- ==========================================
-- Modul CRUD Mata Kuliah & Kelas (Issue #11)
-- ==========================================

CREATE TABLE IF NOT EXISTS mata_kuliah (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode_mk    VARCHAR(20)  NOT NULL,
  nama_mk    VARCHAR(150) NOT NULL,
  sks        TINYINT UNSIGNED NOT NULL DEFAULT 2,
  semester   TINYINT UNSIGNED NULL,
  dosen_id   INT UNSIGNED NOT NULL COMMENT 'Pemilik/pembuat mata kuliah (role dosen)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kode_mk_dosen (kode_mk, dosen_id),
  KEY idx_mk_dosen (dosen_id),
  CONSTRAINT fk_mk_dosen FOREIGN KEY (dosen_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kelas (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mata_kuliah_id      INT UNSIGNED NOT NULL,
  nama_kelas          VARCHAR(50)  NOT NULL COMMENT 'Contoh: A, B, IF-4A',
  tahun_ajaran        VARCHAR(20)  NULL COMMENT 'Contoh: 2026/2027 Ganjil',
  kode_join           VARCHAR(12)  NOT NULL COMMENT 'Kode acak unik untuk mahasiswa join',
  is_pendaftaran_buka BOOLEAN      NOT NULL DEFAULT TRUE COMMENT 'Status buka/tutup pendaftaran (#15)',
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kelas_kode_join (kode_join),
  KEY idx_kelas_mk (mata_kuliah_id),
  CONSTRAINT fk_kelas_mk FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- Modul Rekap Kehadiran & Laporan Presensi (Issue #41)
-- SEMENTARA: kelas_mahasiswa, sesi_pertemuan, dan presensi belum
-- dibuat anggota lain. Samakan nama kolomnya bila modul join kelas
-- dan presensi sudah ada.
-- ==========================================================

-- Mahasiswa yang terdaftar di sebuah kelas.
CREATE TABLE IF NOT EXISTS kelas_mahasiswa (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kelas_id     INT UNSIGNED NOT NULL,
  mahasiswa_id INT UNSIGNED NOT NULL,
  joined_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kelas_mhs (kelas_id, mahasiswa_id),
  KEY idx_km_mhs (mahasiswa_id),
  CONSTRAINT fk_km_kelas FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
  CONSTRAINT fk_km_mhs FOREIGN KEY (mahasiswa_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Satu baris = satu pertemuan yang sudah/akan dilaksanakan di sebuah kelas.
CREATE TABLE IF NOT EXISTS sesi_pertemuan (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kelas_id     INT UNSIGNED NOT NULL,
  pertemuan_ke SMALLINT UNSIGNED NOT NULL,
  tanggal      DATE NOT NULL,
  topik        VARCHAR(150) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sesi_kelas_ke (kelas_id, pertemuan_ke),
  CONSTRAINT fk_sesi_kelas FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Satu baris = status satu mahasiswa di satu pertemuan.
-- Mahasiswa tanpa baris di sini untuk suatu pertemuan dianggap alpa.
CREATE TABLE IF NOT EXISTS presensi (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sesi_id      INT UNSIGNED NOT NULL,
  mahasiswa_id INT UNSIGNED NOT NULL,
  status       ENUM('hadir','izin','sakit','alpa') NOT NULL DEFAULT 'hadir',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_presensi (sesi_id, mahasiswa_id),
  KEY idx_presensi_mhs (mahasiswa_id),
  CONSTRAINT fk_presensi_sesi FOREIGN KEY (sesi_id) REFERENCES sesi_pertemuan(id) ON DELETE CASCADE,
  CONSTRAINT fk_presensi_mhs FOREIGN KEY (mahasiswa_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
