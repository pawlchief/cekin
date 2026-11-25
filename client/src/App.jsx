import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AdminAkun from './pages/AdminAkun.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import GabungKelas from './pages/GabungKelas.jsx';
import Jadwal from './pages/Jadwal.jsx';
import JadwalKuliah from './pages/JadwalKuliah.jsx';
import KelasSaya from './pages/KelasSaya.jsx';
import Laporan from './pages/Laporan.jsx';
import Login from './pages/Login.jsx';
import MataKuliah from './pages/MataKuliah.jsx';
import Profil from './pages/Profil.jsx';
import Register from './pages/Register.jsx';
import Rekap from './pages/Rekap.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import { Forbidden, NotFound } from './pages/Status.jsx';

// Pelindung halaman. Hak akses sebenarnya dicek di server.
function RequireAuth({ roles }) {
  const { user } = useAuth();
  const loc = useLocation();

  if (user === undefined) {
    return <p className="p-10 text-sm text-muted">Memuat...</p>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: loc.pathname + loc.search }}
        replace
      />
    );
  }

  if (roles && !roles.includes(user.role)) {
    return <Forbidden />;
  }

  return <Outlet />;
}

function JadwalRoute() {
  const { user } = useAuth();
  return user.role === 'mahasiswa' ? <JadwalKuliah /> : <Jadwal />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/daftar" element={<Register />} />
      <Route path="/lupa-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="profil" element={<Profil />} />

          <Route element={<RequireAuth roles={['admin']} />}>
            <Route path="admin/akun" element={<AdminAkun />} />
          </Route>

          <Route element={<RequireAuth roles={['dosen', 'admin']} />}>
            <Route path="mata-kuliah" element={<MataKuliah />} />
          </Route>

          <Route element={<RequireAuth roles={['mahasiswa']} />}>
            <Route path="kelas-saya" element={<KelasSaya />} />
            <Route path="gabung-kelas" element={<GabungKelas />} />
          </Route>

          <Route element={<RequireAuth roles={['dosen', 'mahasiswa']} />}>
            <Route path="jadwal" element={<JadwalRoute />} />
            <Route path="rekap" element={<Rekap />} />
          </Route>

          <Route element={<RequireAuth roles={['dosen']} />}>
            <Route path="rekap/laporan" element={<Laporan />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}