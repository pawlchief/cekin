import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AdminAkun from './pages/AdminAkun.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Login from './pages/Login.jsx';
import Profil from './pages/Profil.jsx';
import Register from './pages/Register.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import { Forbidden, NotFound } from './pages/Status.jsx';

// Pelindung halaman. Ini hanya untuk UX; hak akses yang sebenarnya dicek di server (requireRole).
function RequireAuth({ roles }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return <p className="p-10 text-sm text-muted">Memuat...</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (roles && !roles.includes(user.role)) return <Forbidden />;
  return <Outlet />;
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
          {/* Anggota lain: tambahkan <Route path="kelas" element={<Kelas />} /> di sini. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
