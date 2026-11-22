import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Avatar, ErrorList, Field, PageHead, useConfirm } from '../components/ui.jsx';
import { ROLE_LABEL, STATUS_BADGE } from '../nav.js';

const EMPTY_FORM = { nama: '', email: '', nim_nip: '', role: 'mahasiswa', password: '' };
const CHIPS = [['all', 'Semua'], ['dosen', 'Dosen'], ['mahasiswa', 'Mahasiswa'], ['pending', 'Menunggu persetujuan']];

export default function AdminAkun() {
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const role = params.get('role') || '';
  const q = params.get('q') || '';
  const [cari, setCari] = useState(q);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [temp, setTemp] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState([]);
  const [confirm, dialog] = useConfirm();
  const formDialog = useRef(null);

  const active = status === 'pending' ? 'pending' : role || 'all';

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (status) sp.set('status', status);
    if (role) sp.set('role', role);
    if (q) sp.set('q', q);
    try { setRows((await api.get(`/admin/akun?${sp}`)).rows); setError(''); } catch (e) { setError(e.message); }
    setLoading(false);
  }, [status, role, q]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (patch) => {
    const next = Object.fromEntries(params);
    Object.entries(patch).forEach(([k, v]) => (v ? (next[k] = v) : delete next[k]));
    setParams(next);
  };
  const pilihChip = (v) => setFilter({ status: v === 'pending' ? 'pending' : '', role: v === 'dosen' || v === 'mahasiswa' ? v : '' });

  // Pencarian langsung (tunda 300 ms agar tidak menembak server di tiap ketukan).
  useEffect(() => {
    const t = setTimeout(() => { if (cari.trim() !== q) setFilter({ q: cari.trim() }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari]);

  async function act(row, action, msg, opts) {
    if (msg && !(await confirm(msg, opts))) return;
    setNotice(''); setTemp(null); setError('');
    try {
      const d = await api.post(`/admin/akun/${row.id}/${action}`);
      setNotice(d.message);
      if (d.tempPassword) setTemp({ nama: d.nama, pw: d.tempPassword });
      load();
    } catch (e) { setError(e.message); }
  }

  async function buat(e) {
    e.preventDefault();
    setFormErrors([]); setNotice(''); setTemp(null);
    try {
      const d = await api.post('/admin/akun', form);
      setNotice(d.message);
      setForm(EMPTY_FORM);
      formDialog.current.close();
      load();
    } catch (err) { setFormErrors(err.errors); }
  }
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const Aksi = ({ r }) => {
    const diriSendiri = r.id === me.id;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {r.status === 'pending' && <>
          <button className="btn-danger btn-sm" onClick={() => act(r, 'tolak', `Tolak pendaftaran ${r.nama}? Akun ini tidak akan bisa masuk.`, { title: 'Tolak pendaftaran?', ok: 'Ya, tolak' })}>Tolak</button>
          <button className="btn-primary btn-sm" onClick={() => act(r, 'setuju')}>Setujui</button>
        </>}
        {r.status === 'ditolak' && <button className="btn-primary btn-sm" onClick={() => act(r, 'setuju')}>Setujui</button>}
        {r.status === 'nonaktif' && <button className="btn-primary btn-sm" onClick={() => act(r, 'aktifkan')}>Aktifkan</button>}
        {r.status === 'aktif' && <>
          <button className="btn-ghost btn-sm" onClick={() => act(r, 'reset', `Buat kata sandi sementara baru untuk ${r.nama}? Sesi aktifnya akan dikeluarkan.`, { title: 'Reset password?', ok: 'Ya, reset' })}>Reset password</button>
          {!diriSendiri && <button className="btn-ghost btn-sm" onClick={() => act(r, 'nonaktif', `Nonaktifkan akun ${r.nama}? Ia tidak bisa masuk sampai diaktifkan lagi.`, { title: 'Nonaktifkan akun?', ok: 'Ya, nonaktifkan' })}>Nonaktifkan</button>}
        </>}
        {!diriSendiri && (
          <button className="flex size-8 items-center justify-center rounded-btn text-muted hover:bg-[#fee2e2] hover:text-bad" aria-label={`Hapus akun ${r.nama}`}
            onClick={() => act(r, 'hapus', `Akun ${r.nama} akan dihapus permanen dan tidak bisa masuk lagi.`, { title: 'Hapus akun ini?', ok: 'Ya, hapus' })}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Kelola Akun" sub="Kelola akun pengguna dan setujui pendaftaran dosen" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter akun">
          {CHIPS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={active === v} onClick={() => pilihChip(v)}
              className={`rounded-btn px-4 py-[9px] text-sm transition-colors ${active === v ? 'bg-gradient-to-r from-primary to-royal font-semibold text-white' : 'border border-line bg-white font-medium text-muted hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label className="flex h-[42px] flex-1 items-center gap-2 rounded-btn border border-line bg-white px-3.5 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 sm:w-[300px] sm:flex-none">
            <Icon name="search" />
            <input className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none" placeholder="Cari nama atau NIM / NIP..." value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari akun" />
          </label>
          <button className="btn-primary !py-2.5" onClick={() => { setFormErrors([]); formDialog.current.showModal(); }}>Tambah akun</button>
        </div>
      </div>

      <div className="space-y-3">
        {notice && <Alert type="ok">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
        {temp && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-btn bg-[#fef3c7] px-4 py-3 text-[13px] text-[#78350f]">
            <span>Password sementara untuk <b>{temp.nama}</b>:</span>
            <code className="rounded bg-white px-2 py-1 font-mono text-sm font-bold">{temp.pw}</code>
            <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(temp.pw)}>Salin</button>
            <span className="text-xs">Catat sekarang, tidak ditampilkan lagi.</span>
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-white shadow-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Daftar akun</caption>
            <thead>
              <tr className="bg-soft text-xs font-semibold tracking-[0.5px] text-primary">
                <th className="w-[300px] px-5 py-[13px]">NAMA</th><th className="w-[190px] px-5 py-[13px]">NIM / NIP</th>
                <th className="w-[150px] px-5 py-[13px]">ROLE</th><th className="w-[130px] px-5 py-[13px]">STATUS</th><th className="px-5 py-[13px]">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="odd:bg-white even:bg-[#f8faff]">
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar nama={r.nama} id={r.id} /><div><p className="font-semibold">{r.nama}</p><p className="text-xs text-muted">{r.email}</p></div></div></td>
                  <td className="px-5 py-3">{r.nim_nip || '-'}</td>
                  <td className="px-5 py-3">{ROLE_LABEL[r.role]}</td>
                  <td className="px-5 py-3"><span className={STATUS_BADGE[r.status][0]}>{STATUS_BADGE[r.status][1]}</span></td>
                  <td className="px-5 py-3"><Aksi r={r} /></td>
                </tr>
              ))}
              {loading && <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">Memuat...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">Tidak ada akun yang cocok. Ubah filter atau kata kunci pencarian.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="card flex flex-col gap-3 !rounded-2xl !p-4">
            <div className="flex items-center gap-3">
              <Avatar nama={r.nama} id={r.id} size={40} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.nama}</p><p className="truncate text-xs text-muted">{r.nim_nip || '-'} · {ROLE_LABEL[r.role]}</p></div>
              <span className={STATUS_BADGE[r.status][0]}>{STATUS_BADGE[r.status][1]}</span>
            </div>
            <Aksi r={r} />
          </li>
        ))}
        {!loading && rows.length === 0 && <li className="py-10 text-center text-sm text-muted">Tidak ada akun yang cocok.</li>}
      </ul>

      <dialog ref={formDialog} className="w-[min(92vw,480px)] rounded-[20px] border-0 p-6 text-ink shadow-card backdrop:bg-ink/60">
        <h2 className="text-lg font-bold">Tambah akun</h2>
        <p className="mt-1 text-[13px] text-muted">Akun yang dibuat admin langsung aktif.</p>
        <div className="mt-4"><ErrorList errors={formErrors} /></div>
        <form onSubmit={buat} className="mt-4 space-y-3.5">
          <Field label="Nama lengkap" id="n-nama"><input id="n-nama" className="input" required maxLength={100} value={form.nama} onChange={f('nama')} /></Field>
          <Field label="Email" id="n-email"><input id="n-email" className="input" type="email" required value={form.email} onChange={f('email')} /></Field>
          <Field label="NIM / NIP / Username" id="n-nim"><input id="n-nim" className="input" maxLength={30} value={form.nim_nip} onChange={f('nim_nip')} /></Field>
          <Field label="Peran" id="n-role">
            <select id="n-role" className="input" value={form.role} onChange={f('role')}>
              {['mahasiswa', 'dosen', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="Password awal" id="n-pw" hint="Minimal 8 karakter, kombinasi huruf dan angka.">
            <input id="n-pw" className="input" type="password" required autoComplete="new-password" value={form.password} onChange={f('password')} />
          </Field>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" className="btn-ghost" onClick={() => formDialog.current.close()}>Batal</button>
            <button className="btn-primary">Simpan akun</button>
          </div>
        </form>
      </dialog>
      {dialog}
    </div>
  );
}
