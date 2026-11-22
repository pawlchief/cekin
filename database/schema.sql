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
