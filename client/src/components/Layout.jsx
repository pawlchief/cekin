import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { NAV, ROLE_LABEL } from '../nav.js';
import Icon from './Icon.jsx';
import { Lockup } from './Logo.jsx';
import { Deco, initials } from './ui.jsx';

// Kerangka aplikasi sesuai Figma: sidebar navy (desktop) dan tab bawah (mobile).
export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const items = NAV[user.role] || [];
  const onProfile = pathname.startsWith('/profil');
  const tabs = [...items.map((i) => ({ ...i, short: i.to === '/' ? 'Beranda' : i.label.split(' ')[0] })), { to: '/profil', label: 'Profil', short: 'Profil', icon: 'user' }];

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-latar to-field">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1.5 overflow-hidden bg-gradient-to-b from-navy to-royal px-5 py-6 lg:flex print:!hidden">
        <Deco className="-top-[70px] left-[110px] size-[230px]" />
        <Deco className="-bottom-[60px] -left-[90px] size-[250px]" />
        <div className="relative"><Lockup size={36} /></div>
        <p className="relative mt-[22px] text-[11px] font-bold tracking-[1px] text-pale">MENU</p>
        <nav className="relative mt-0.5 flex flex-col gap-1.5" aria-label="Menu utama">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
              className={({ isActive }) => `flex items-center gap-3 rounded-btn px-3 py-[11px] text-sm transition-colors ${isActive ? 'bg-white/[0.16] font-semibold text-white' : 'font-medium text-pale hover:bg-white/10'}`}>
              <Icon name={it.icon} /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 ${onProfile ? 'border-white bg-white/[0.18]' : 'border-transparent bg-white/10'}`}>
          <NavLink to="/profil" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Buka profil saya">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-navy">{initials(user.nama)}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-white">{user.nama}</span>
              <span className="block text-xs text-pale">{ROLE_LABEL[user.role]}</span>
            </span>
          </NavLink>
          {onProfile
            ? <Icon name="user" size={16} className="text-white" />
            : <button type="button" onClick={logout} className="flex size-7 items-center justify-center rounded-lg bg-white/[0.14] text-white hover:bg-white/25" aria-label="Keluar"><Icon name="logout" /></button>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 pb-28 lg:p-9 print:p-0">
        <div className="mx-auto max-w-[1180px]"><Outlet /></div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white lg:hidden print:!hidden" aria-label="Menu utama">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted">
            {({ isActive }) => (
              <>
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? 'bg-soft text-primary' : ''}`}><Icon name={t.icon} size={20} /></span>
                <span className={isActive ? 'font-bold text-primary' : ''}>{t.short}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
