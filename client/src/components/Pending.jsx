// Layar "Menunggu Persetujuan" (Figma): tampil setelah dosen mendaftar, atau saat login akun yang belum disetujui.
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { fmtTanggal, ID_LABEL } from '../nav.js';

export default function Pending({ data }) {
  const row = (k, v) => (
    <div className="flex items-center justify-between gap-4 text-xs"><span className="text-muted">{k}</span><span className="text-right font-bold">{v}</span></div>
  );
  return (
    <div className="card flex flex-col items-center p-6 text-center sm:p-9">
      <span className="flex size-[70px] items-center justify-center rounded-full bg-[#fef3c7] text-warn"><Icon name="clock" size={32} /></span>
      <span className="mt-3 rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-medium text-[#b45309]">Menunggu persetujuan</span>
      <h1 className="mt-3.5 text-xl font-bold">Akun kamu sedang ditinjau</h1>
      <p className="mt-2 text-[13px] text-muted">Administrator akan memeriksa pendaftaran akun dosen kamu. Kamu bisa masuk setelah akun disetujui.</p>
      <div className="mt-4 flex w-full flex-col gap-2 rounded-xl border border-line bg-field p-3">
        {row('Nama', data.nama)}
        {row(ID_LABEL[data.role] || 'NIP', data.nim_nip || '-')}
        {row('Didaftarkan', fmtTanggal(data.created_at))}
      </div>
      <Link to="/login" className="btn-ghost mt-3.5 w-full">Kembali ke halaman masuk</Link>
    </div>
  );
}
