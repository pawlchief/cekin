import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Deco, PageHead } from '../components/ui.jsx';

const HARI_LABEL = {
  senin: 'Senin',
  selasa: 'Selasa',
  rabu: 'Rabu',
  kamis: 'Kamis',
  jumat: 'Jumat'
};

const HASIL_CARDS = [
  {
    key: 'JOINED',
    title: 'Berhasil bergabung',
    defaultDesc: 'Kamu akan terdaftar sebagai peserta kelas yang dicari.',
    bg: 'bg-[#dcfce7] border-[#bbf7d0]',
    iconBg: 'border border-[#16a34a] text-[#16a34a]',
    titleCls: 'text-[#15803d]',
    icon: 'check'
  },
  {
    key: 'INVALID',
    title: 'Kode tidak valid',
    defaultDesc: 'Periksa lagi kode dari dosenmu.',
    bg: 'bg-[#fee2e2] border-[#fecaca]',
    iconBg: 'border border-[#dc2626] text-[#dc2626]',
    titleCls: 'text-[#b91c1c]',
    icon: 'warn'
  },
  {
    key: 'CLOSED',
    title: 'Pendaftaran ditutup',
    defaultDesc: 'Dosen sedang menutup pendaftaran kelas ini.',
    bg: 'bg-[#fef3c7] border-[#fde68a]',
    iconBg: 'border border-[#d97706] text-[#d97706]',
    titleCls: 'text-[#b45309]',
    icon: 'lock'
  },
  {
    key: 'ALREADY_JOINED',
    title: 'Sudah terdaftar',
    defaultDesc: 'Kamu sudah menjadi peserta kelas ini.',
    bg: 'bg-[#e0f2fe] border-[#bae6fd]',
    iconBg: 'border border-[#0284c7] text-[#0284c7]',
    titleCls: 'text-[#0369a1]',
    icon: 'user'
  }
];

export default function GabungKelas() {
  const navigate = useNavigate();
  const [chars, setChars] = useState(['', '', '', '', '', '']);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [kelasDitemukan, setKelasDitemukan] = useState(null);
  const [activeStatus, setActiveStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const inputRefs = useRef([]);
  const kodeGabungan = chars.join('');

  async function jalankanPencarian(kodeTarget) {
    if (kodeTarget.length < 6) {
      setKelasDitemukan(null);
      setActiveStatus('INVALID');
      setStatusMessage('Masukkan lengkap 6 karakter kode kelas dari dosenmu.');
      return;
    }

    setSearching(true);
    setActiveStatus(null);
    setStatusMessage('');
    try {
      const res = await api.get(`/kelas/cari/${kodeTarget}`);
      setKelasDitemukan(res.data);

      if (res.status_kode === 'ALREADY_JOINED') {
        setActiveStatus('ALREADY_JOINED');
        setStatusMessage('Kamu sudah menjadi peserta kelas ini.');
      } else if (res.status_kode === 'CLOSED') {
        setActiveStatus('CLOSED');
        setStatusMessage('Dosen sedang menutup pendaftaran kelas ini.');
      }
    } catch (err) {
      setKelasDitemukan(null);
      setActiveStatus(err.data?.status_kode || 'INVALID');
      setStatusMessage(err.message);
    } finally {
      setSearching(false);
    }
  }

  function handleChange(index, rawValue) {
    const clean = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      const next = [...chars];
      next[index] = '';
      setChars(next);
      return;
    }

    const next = [...chars];
    for (let i = 0; i < clean.length && index + i < 6; i++) {
      next[index + i] = clean[i];
    }
    setChars(next);

    const nextFocus = Math.min(index + clean.length, 5);
    inputRefs.current[nextFocus]?.focus();

    const kodeLengkap = next.join('');
    if (kodeLengkap.length === 6 && window.innerWidth < 768) {
      jalankanPencarian(kodeLengkap);
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      const next = [...chars];
      next[index - 1] = '';
      setChars(next);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setChars(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();

    if (pasted.length === 6 && window.innerWidth < 768) {
      jalankanPencarian(pasted);
    }
  }

  function handleSubmitCari(e) {
    e.preventDefault();
    jalankanPencarian(kodeGabungan);
  }

  async function gabungKelas() {
    if (!kelasDitemukan) return;
    setJoining(true);
    try {
      await api.post('/kelas/gabung', { kode_join: kelasDitemukan.kode_join });
      setActiveStatus('JOINED');
      setStatusMessage(
        `Kamu terdaftar di ${kelasDitemukan.nama_mk} · Kelas ${kelasDitemukan.nama_kelas}.`
      );
      setKelasDitemukan((prev) =>
        prev
          ? {
              ...prev,
              sudah_terdaftar: true,
              jumlah_peserta: Number(prev.jumlah_peserta || 0) + 1
            }
          : null
      );
    } catch (err) {
      setActiveStatus(err.data?.status_kode || 'INVALID');
      setStatusMessage(err.message);
    } finally {
      setJoining(false);
    }
  }

  function resetForm() {
    setChars(['', '', '', '', '', '']);
    setKelasDitemukan(null);
    setActiveStatus(null);
    setStatusMessage('');
    inputRefs.current[0]?.focus();
  }

  return (
    <div className="flex flex-col gap-[22px]">
      {/* ================= HEADER MOBILE (Figma M5) ================= */}
      <div className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[28px] bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#1e40af] px-5 pb-7 pt-5 text-white shadow-card md:hidden">
        <Deco className="-right-10 -top-10 size-44" />
        <Deco className="-bottom-14 left-6 size-36" />

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="relative z-10 inline-flex items-center gap-2 text-sm font-semibold text-white/95 hover:text-white"
        >
          <span aria-hidden="true" className="text-lg leading-none">&larr;</span>
          <span>Gabung Kelas</span>
        </button>

        <h1 className="relative z-10 mt-4 text-2xl font-bold tracking-tight">
          Masukkan kode kelas
        </h1>
        <p className="relative z-10 mt-1 text-xs text-blue-100">
          Kode dari dosenmu, 6 karakter huruf dan angka.
        </p>
      </div>

      {/* ================= HEADER DESKTOP (Figma 20) ================= */}
      <div className="hidden md:block">
        <PageHead title="Gabung Kelas" sub="Masukkan kode kelas dari dosenmu" />
      </div>

      {/* ================= KONTEN UTAMA ================= */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* Kolom Kiri: Form Input 6 Kotak + Preview Kelas */}
        <div className="md:rounded-2xl md:border md:border-line md:bg-white md:p-6 md:shadow-card">
          <form onSubmit={handleSubmitCari}>
            <h2 className="text-[15px] font-bold text-ink md:text-base">Kode kelas</h2>
            <p className="mt-1 hidden text-xs text-muted md:block">
              Kode terdiri dari 6 karakter huruf dan angka.
            </p>

            {/* 6 Kotak Input Karakter */}
            <div
              className="mt-3.5 grid grid-cols-6 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 md:mt-4"
              onPaste={handlePaste}
            >
              {chars.map((char, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="text"
                  maxLength={6}
                  value={char}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  aria-label={`Karakter kode ke-${idx + 1}`}
                  className="aspect-square w-full rounded-xl border border-line bg-white text-center font-mono text-xl font-bold uppercase text-ink shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 sm:text-2xl md:aspect-auto md:h-14 md:w-14 md:border-2 md:border-[#bfdbfe] md:text-primary md:shadow-none"
                />
              ))}
            </div>

            <p className="mt-2.5 text-xs text-muted md:hidden">
              Kode terdiri dari 6 karakter huruf dan angka.
            </p>

            {/* Tombol Cari Kelas */}
            <div className={`mt-5 flex flex-wrap items-center gap-2.5 ${kelasDitemukan ? 'hidden md:flex' : 'flex'}`}>
              <button
                type="submit"
                disabled={searching || kodeGabungan.length < 6}
                className="btn-primary w-full !px-5 md:w-auto"
              >
                <Icon name="search" />
                {searching ? 'Mencari...' : 'Cari kelas'}
              </button>

              {(kodeGabungan.length > 0 || kelasDitemukan) && (
                <button type="button" onClick={resetForm} className="btn-ghost !py-2.5">
                  Reset
                </button>
              )}
            </div>
          </form>

          {/* ================= PREVIEW KELAS DITEMUKAN ================= */}
          {kelasDitemukan && (
            <div className="mt-5 md:mt-6 md:border-t md:border-line md:pt-5">
              {/* VERSI MOBILE (Figma M5) */}
              <div className="space-y-4 md:hidden">
                <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                  <p className="text-xs font-bold text-ok">Kelas ditemukan</p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    {kelasDitemukan.kode_mk} · {kelasDitemukan.sks} SKS
                  </p>
                  <h3 className="mt-1 text-base font-bold text-ink">
                    {kelasDitemukan.nama_mk} · Kelas {kelasDitemukan.nama_kelas}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {kelasDitemukan.nama_dosen} · {kelasDitemukan.jumlah_peserta} peserta
                    {kelasDitemukan.hari
                      ? ` · ${HARI_LABEL[kelasDitemukan.hari] || kelasDitemukan.hari} ${kelasDitemukan.jam_mulai}`
                      : ''}
                  </p>
                </div>

                {kelasDitemukan.sudah_terdaftar ? (
                  <Link to="/kelas-saya" className="btn-primary w-full py-3.5 text-center">
                    Lihat di Kelas Saya
                  </Link>
                ) : !kelasDitemukan.is_pendaftaran_buka ? (
                  <button type="button" disabled className="btn-ghost w-full py-3.5 opacity-70">
                    Pendaftaran Ditutup
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={gabungKelas}
                    className="btn-primary w-full py-3.5 font-bold"
                  >
                    {joining ? 'Memproses...' : 'Gabung kelas ini'}
                  </button>
                )}
              </div>

              {/* VERSI DESKTOP (Figma 20) */}
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-muted">Kelas ditemukan</p>

                <div className="relative mt-2.5 flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#1e40af] p-5 text-white shadow-card">
                  <Deco className="-bottom-12 right-24 size-36" />

                  <div className="relative z-10">
                    <p className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
                      {kelasDitemukan.kode_mk} · {kelasDitemukan.sks} SKS
                    </p>
                    <h3 className="mt-1 text-lg font-bold">
                      {kelasDitemukan.nama_mk} · Kelas {kelasDitemukan.nama_kelas}
                    </h3>
                    <p className="mt-1 text-xs text-blue-100">
                      {kelasDitemukan.nama_dosen} · {kelasDitemukan.jumlah_peserta} peserta
                      {kelasDitemukan.hari
                        ? ` · ${HARI_LABEL[kelasDitemukan.hari] || kelasDitemukan.hari} ${kelasDitemukan.jam_mulai}`
                        : ''}
                    </p>
                  </div>

                  <div className="relative z-10 shrink-0">
                    {kelasDitemukan.sudah_terdaftar ? (
                      <Link to="/kelas-saya" className="btn-white !py-2.5">
                        Lihat di Kelas Saya
                      </Link>
                    ) : !kelasDitemukan.is_pendaftaran_buka ? (
                      <button type="button" disabled className="btn-white !py-2.5 opacity-70">
                        Pendaftaran Ditutup
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={joining}
                        onClick={gabungKelas}
                        className="btn-white !py-2.5 font-bold"
                      >
                        {joining ? 'Memproses...' : 'Gabung kelas ini'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Status di Mobile saat error / berhasil */}
          {activeStatus && statusMessage && (
            <div className="mt-4 md:hidden">
              {(() => {
                const info = HASIL_CARDS.find((h) => h.key === activeStatus);
                if (!info) return null;
                return (
                  <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${info.bg}`}>
                    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${info.iconBg}`}>
                      <Icon name={info.icon} size={13} />
                    </span>
                    <div>
                      <p className={`text-xs font-bold ${info.titleCls}`}>{info.title}</p>
                      <p className="mt-0.5 text-xs text-ink/80">{statusMessage}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ================= PANEL KANAN: KEMUNGKINAN HASIL (Desktop) ================= */}
        <div className="hidden rounded-2xl border border-line bg-white p-6 shadow-card md:block">
          <h2 className="text-base font-bold text-ink">Kemungkinan hasil</h2>
          <div className="mt-4 space-y-3">
            {HASIL_CARDS.map((item) => {
              const isCurrent = activeStatus === item.key;
              const isDimmed = activeStatus && !isCurrent;
              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${item.bg} ${
                    isCurrent
                      ? 'ring-2 ring-primary ring-offset-1'
                      : isDimmed
                        ? 'opacity-45'
                        : 'opacity-95'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${item.iconBg}`}
                  >
                    <Icon name={item.icon} size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${item.titleCls}`}>{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink/80">
                      {isCurrent && statusMessage ? statusMessage : item.defaultDesc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}