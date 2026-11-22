import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

function Box({ code, icon, title, text }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="flex size-[84px] items-center justify-center rounded-full bg-gradient-to-b from-mist to-latar text-primary"><Icon name={icon} size={36} /></span>
      <p className="mt-4 text-[72px] font-bold leading-none text-primary">{code}</p>
      <h1 className="mt-5 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <Link to="/" className="btn-primary mt-6">Kembali ke dashboard</Link>
    </div>
  );
}
export const Forbidden = () => <Box code="403" icon="lock" title="Kamu tidak punya akses" text="Halaman ini hanya untuk role lain. Silakan kembali ke dashboard kamu." />;
export const NotFound = () => <Box code="404" icon="search" title="Halaman tidak ditemukan" text="Alamat yang kamu buka tidak ada atau sudah dipindahkan." />;
