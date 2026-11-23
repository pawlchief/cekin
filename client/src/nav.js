// Menu sidebar per role. Anggota lain tinggal menambah item modulnya di sini
// (icon: grid, users, book, cal, user — lihat components/Icon.jsx). Profil sudah ada di kartu pengguna sidebar.
export const NAV = {
  admin: [
    { to: '/', label: 'Dashboard', icon: 'grid', end: true },
    { to: '/admin/akun', label: 'Kelola Akun', icon: 'users' },
    { to: '/mata-kuliah', label: 'Mata Kuliah', icon: 'book' }
  ],
  dosen: [
    { to: '/', label: 'Dashboard', icon: 'grid', end: true },
    { to: '/mata-kuliah', label: 'Mata Kuliah', icon: 'book' }
  ],
  mahasiswa: [{ to: '/', label: 'Dashboard', icon: 'grid', end: true }]
};

export const ROLE_LABEL = { admin: 'Administrator', dosen: 'Dosen', mahasiswa: 'Mahasiswa' };
export const ID_LABEL = { admin: 'Username', dosen: 'NIP', mahasiswa: 'NIM' };
export const STATUS_BADGE = {
  aktif: ['badge-ok', 'Aktif'],
  pending: ['badge-warn', 'Menunggu'],
  ditolak: ['badge-bad', 'Ditolak'],
  nonaktif: ['badge-off', 'Nonaktif']
};

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const fmtTanggal = (s) => (s ? `${Number(s.slice(8, 10))} ${BULAN[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}` : '-');
export const fmtWaktu = (s) => (s ? `${fmtTanggal(s)}, ${s.slice(11, 16)}` : '-');
