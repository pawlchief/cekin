import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

const PALET = ['#2563eb', '#d97706', '#16a34a', '#8b5cf6', '#0284c7'];
export const colorFor = (id) => PALET[Number(id) % PALET.length];
export const initials = (nama = '') => nama.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export const fmtHariIni = () => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

export function Alert({ type = 'error', children }) {
  if (!children || (Array.isArray(children) && !children.length)) return null;
  const cls = type === 'ok' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-bad';
  return (
    <div role={type === 'ok' ? 'status' : 'alert'} className={`rounded-btn px-4 py-3 text-[13px] font-medium ${cls}`}>
      {children}
    </div>
  );
}

export function ErrorList({ errors }) {
  if (!errors || !errors.length) return null;
  return (
    <Alert>
      {errors.length === 1 ? errors[0] : <ul className="list-disc space-y-1 pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Alert>
  );
}

export function Field({ label, id, hint, children }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, autoComplete, required = true, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} className="input pr-24" type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required={required} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-btn px-2 py-1 text-xs font-semibold text-primary hover:bg-soft" aria-pressed={show}>
        {show ? 'Sembunyikan' : 'Tampilkan'}
      </button>
    </div>
  );
}

// Judul halaman + tanggal hari ini (kanan atas) seperti di Figma.
export function PageHead({ title, sub }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      <div className="hidden shrink-0 items-center gap-2 rounded-btn border border-line bg-white px-3.5 py-2.5 text-[13px] font-medium text-muted sm:flex">
        <Icon name="cal" className="text-primary" /> {fmtHariIni()}
      </div>
    </div>
  );
}

// Lingkaran dekoratif putih transparan (seperti di Figma).
export const Deco = ({ className }) => <span aria-hidden="true" className={`pointer-events-none absolute rounded-full bg-white/[0.09] ${className}`} />;

export function Avatar({ nama, id, size = 32 }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: colorFor(id), fontSize: size * 0.37 }}>
      {initials(nama)}
    </span>
  );
}

// Dialog konfirmasi (Figma "Konfirmasi Hapus"):
//   const [confirm, dialog] = useConfirm();  if (await confirm('teks', { title, ok })) ...
export function useConfirm() {
  const ref = useRef(null);
  const resolver = useRef(null);
  const [state, setState] = useState({ msg: '', title: 'Konfirmasi', ok: 'Ya, lanjutkan' });
  const confirm = (msg, opts = {}) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setState({ msg, title: opts.title || 'Konfirmasi', ok: opts.ok || 'Ya, lanjutkan' });
      ref.current.showModal();
    });
  const close = (v) => {
    ref.current.close();
    if (resolver.current) resolver.current(v);
    resolver.current = null;
  };
  const dialog = (
    <dialog ref={ref} onCancel={() => close(false)} className="w-[min(92vw,420px)] rounded-[20px] border-0 p-6 text-center text-ink shadow-card backdrop:bg-ink/60">
      <span className="mx-auto flex size-[52px] items-center justify-center rounded-full bg-[#fee2e2] text-bad"><Icon name="trash" size={22} /></span>
      <h2 className="mt-3 text-lg font-bold">{state.title}</h2>
      <p className="mt-1.5 text-[13px] text-muted">{state.msg}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" className="btn-ghost" onClick={() => close(false)}>Batal</button>
        <button type="button" className="btn-danger" onClick={() => close(true)}>{state.ok}</button>
      </div>
    </dialog>
  );
  return [confirm, dialog];
}
