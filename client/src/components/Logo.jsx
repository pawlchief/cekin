import { useId } from 'react';

// Logo Cekin (diekspor dari Figma): lingkaran "C" = kelas, centang kuning = hadir.
export default function Logo({ size = 40 }) {
  const gid = 'lg' + useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" role="img" aria-label="Logo Cekin" className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="6.75" y1="0" x2="65.25" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <path d="M50.625 1.125H21.375C10.1912 1.125 1.125 10.1912 1.125 21.375V50.625C1.125 61.8088 10.1912 70.875 21.375 70.875H50.625C61.8088 70.875 70.875 61.8088 70.875 50.625V21.375C70.875 10.1912 61.8088 1.125 50.625 1.125Z" fill={`url(#${gid})`} strokeWidth="2.25" stroke="white" strokeOpacity="0.35" />
      <path d="M48.375 24.1875C46.0286 21.7937 43.0226 20.153 39.74 19.4744C36.4575 18.7958 33.0473 19.1102 29.9441 20.3774C26.8409 21.6447 24.1855 23.8073 22.3163 26.5897C20.4471 29.3721 19.4488 32.6481 19.4488 36C19.4488 39.3519 20.4471 42.6279 22.3163 45.4103C24.1855 48.1927 26.8409 50.3553 29.9441 51.6226C33.0473 52.8898 36.4575 53.2042 39.74 52.5256C43.0226 51.847 46.0286 50.2063 48.375 47.8125" strokeWidth="6.75" strokeLinecap="round" stroke="white" />
      <path d="M29.25 37.6875L36 44.4375L52.875 27" strokeWidth="6.75" strokeLinecap="round" strokeLinejoin="round" stroke="#FBBF24" />
    </svg>
  );
}

export function Lockup({ size = 36, textClass = 'text-2xl text-white', gap = 'gap-2' }) {
  return (
    <div className={`flex items-center ${gap}`}>
      <Logo size={size} />
      <span className={`font-bold leading-none tracking-[-1px] ${textClass}`}>Cekin</span>
    </div>
  );
}
