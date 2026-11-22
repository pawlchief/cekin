import Logo, { Lockup } from './Logo.jsx';
import { Deco } from './ui.jsx';

// Halaman masuk/daftar (Figma): hero gradien biru di kiri, form di kanan.
// variant "login" = hero besar; "compact" = hero ringkas (Daftar, Menunggu Persetujuan).
export default function AuthShell({ children, variant = 'login' }) {
  const login = variant === 'login';
  return (
    <div className="flex min-h-screen">
      <aside aria-hidden="true" className={`relative hidden shrink-0 flex-col justify-center gap-[18px] overflow-hidden lg:flex ${login ? 'w-[53%] p-20' : 'w-[42%] p-[70px]'}`}
        style={{ backgroundImage: `linear-gradient(${login ? 130 : 124}deg, #2563eb 14%, #0b1f5c 86%)` }}>
        <Deco className="-right-[130px] -top-[140px] size-[440px]" />
        <Deco className="-bottom-[120px] -left-[120px] size-[380px]" />
        <Deco className="-right-5 bottom-[120px] size-[210px]" />
        {login && <Deco className="left-[300px] top-[300px] size-[90px]" />}
        <div className="relative flex flex-col gap-[18px]">
          <Lockup size={login ? 72 : 64} gap={login ? 'gap-4' : 'gap-3.5'} textClass={login ? 'text-[48px] text-white' : 'text-[42px] text-white'} />
          <p className="text-[17px] font-medium text-pale">Presensi kampus, tanpa ribet.</p>
          {login ? (
            <>
              <span className="mt-9 w-fit rounded-full bg-white/[0.16] px-3.5 py-1.5 text-xs font-bold tracking-[1px] text-white">KELOMPOK A5</span>
              <p className="max-w-[600px] text-[46px] font-bold leading-[1.15] text-white">Sistem Presensi Perkuliahan</p>
              <p className="max-w-[540px] text-lg text-mist">Aplikasi pencatatan dan rekapitulasi kehadiran mahasiswa.</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {['Gabung kelas pakai kode', 'Presensi sesuai waktu', 'Rekap otomatis'].map((t) => (
                  <span key={t} className="rounded-full bg-white/[0.14] px-3.5 py-2 text-[13px] font-medium text-white">{t}</span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-7 max-w-[460px] text-[34px] font-bold leading-[1.2] text-white">Gabung dan catat kehadiran kuliahmu dengan mudah.</p>
          )}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-8 lg:p-[50px]" style={{ backgroundImage: 'linear-gradient(130deg, #ffffff 14%, #dbe8ff 86%)' }}>
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo size={44} />
            <div>
              <p className="text-2xl font-bold leading-none tracking-[-1px]">Cekin</p>
              <p className="mt-1 text-xs text-muted">Presensi kampus, tanpa ribet.</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
