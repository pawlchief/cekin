import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Field, PageHead, useConfirm } from '../components/ui.jsx';

const EMPTY_MK = { id: null, kode_mk: '', nama_mk: '', sks: 3, semester: '' };
const EMPTY_KELAS = { id: null, mata_kuliah_id: null, nama_kelas: '', tahun_ajaran: 'Ganjil 2026/2027' };
const PER_PAGE = 5;

export default function MataKuliah() {
  const { user } = useAuth();
  const isDosen = user?.role === 'dosen';

  const [listMk, setListMk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Filter, Search & Pagination
  const [cari, setCari] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [urutkan, setUrutkan] = useState('terbaru');
  const [page, setPage] = useState(1);

  // Detail Kelas per Mata Kuliah
  const [selectedMk, setSelectedMk] = useState(null);
  const [detailMk, setDetailMk] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copiedKode, setCopiedKode] = useState('');

  // Daftar Peserta per Kelas (#26 & #27)
  const [kelasPeserta, setKelasPeserta] = useState(null);
  const [listPeserta, setListPeserta] = useState([]);
  const [loadingPeserta, setLoadingPeserta] = useState(false);

  // Form Modal
  const [formMk, setFormMk] = useState(EMPTY_MK);
  const [formKelas, setFormKelas] = useState(EMPTY_KELAS);
  const [modalErr, setModalErr] = useState('');

  const mkDialog = useRef(null);
  const kelasDialog = useRef(null);
  const [confirm, dialog] = useConfirm();

  const loadMatkul = useCallback(async () => {
    try {
      const res = await api.get('/mata-kuliah');
      setListMk(res.data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatkul();
  }, [loadMatkul]);

  const loadDetailKelas = useCallback(async (mkId) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/mata-kuliah/${mkId}`);
      setDetailMk(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  async function bukaPanelKelas(mk) {
    if (selectedMk?.id === mk.id) {
      setSelectedMk(null);
      setDetailMk(null);
      setKelasPeserta(null);
      setListPeserta([]);
      return;
    }
    setSelectedMk(mk);
    setKelasPeserta(null);
    setListPeserta([]);
    await loadDetailKelas(mk.id);
  }

  // Daftar semester unik untuk dropdown filter
  const daftarSemester = useMemo(() => {
    const sems = new Set(listMk.map((m) => m.semester).filter(Boolean));
    return Array.from(sems).sort((a, b) => Number(a) - Number(b));
  }, [listMk]);

  // Hasil filter + pencarian + pengurutan
  const filteredMk = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return listMk
      .filter((mk) => {
        const cocokCari =
          !q ||
          mk.kode_mk.toLowerCase().includes(q) ||
          mk.nama_mk.toLowerCase().includes(q) ||
          (mk.nama_dosen && mk.nama_dosen.toLowerCase().includes(q));
        const cocokSem = !filterSemester || String(mk.semester || '') === filterSemester;
        return cocokCari && cocokSem;
      })
      .sort((a, b) => {
        if (urutkan === 'terlama') return a.id - b.id;
        if (urutkan === 'nama') return a.nama_mk.localeCompare(b.nama_mk);
        return b.id - a.id;
      });
  }, [listMk, cari, filterSemester, urutkan]);

  useEffect(() => {
    setPage(1);
  }, [cari, filterSemester, urutkan]);

  const totalPages = Math.max(1, Math.ceil(filteredMk.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedMk = filteredMk.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // --- CRUD MATA KULIAH ---
  function bukaModalMk(mk = null) {
    setModalErr('');
    setFormMk(
      mk
        ? { id: mk.id, kode_mk: mk.kode_mk, nama_mk: mk.nama_mk, sks: mk.sks, semester: mk.semester || '' }
        : EMPTY_MK
    );
    mkDialog.current.showModal();
  }

  async function simpanMk(e) {
    e.preventDefault();
    setModalErr('');
    setNotice('');
    try {
      const payload = {
        kode_mk: formMk.kode_mk,
        nama_mk: formMk.nama_mk,
        sks: Number(formMk.sks),
        semester: formMk.semester ? Number(formMk.semester) : null
      };
      const res = formMk.id
        ? await api.put(`/mata-kuliah/${formMk.id}`, payload)
        : await api.post('/mata-kuliah', payload);
      setNotice(res.message);
      mkDialog.current.close();
      await loadMatkul();
      if (selectedMk?.id === formMk.id) await loadDetailKelas(formMk.id);
    } catch (e) {
      setModalErr(e.message);
    }
  }

  async function hapusMk(mk) {
    const ok = await confirm(
      `${mk.kode_mk} · ${mk.nama_mk} beserta seluruh kelas di dalamnya akan dihapus permanen.`,
      { title: 'Hapus mata kuliah ini?', ok: 'Ya, hapus' }
    );
    if (!ok) return;
    setNotice('');
    setError('');
    try {
      const res = await api.del(`/mata-kuliah/${mk.id}`);
      setNotice(res.message);
      if (selectedMk?.id === mk.id) {
        setSelectedMk(null);
        setDetailMk(null);
        setKelasPeserta(null);
        setListPeserta([]);
      }
      await loadMatkul();
    } catch (e) {
      setError(e.message);
    }
  }

  // --- CRUD KELAS & KODE JOIN ---
  function bukaModalKelas(mk, kls = null) {
    setModalErr('');
    setFormKelas(
      kls
        ? { id: kls.id, mata_kuliah_id: mk.id, nama_kelas: kls.nama_kelas, tahun_ajaran: kls.tahun_ajaran || '' }
        : { ...EMPTY_KELAS, mata_kuliah_id: mk.id }
    );
    kelasDialog.current.showModal();
  }

  async function simpanKelas(e) {
    e.preventDefault();
    setModalErr('');
    setNotice('');
    try {
      const res = formKelas.id
        ? await api.put(`/kelas/${formKelas.id}`, {
            nama_kelas: formKelas.nama_kelas,
            tahun_ajaran: formKelas.tahun_ajaran
          })
        : await api.post('/kelas', {
            mata_kuliah_id: formKelas.mata_kuliah_id,
            nama_kelas: formKelas.nama_kelas,
            tahun_ajaran: formKelas.tahun_ajaran
          });
      setNotice(res.message);
      kelasDialog.current.close();
      await loadMatkul();
      if (selectedMk?.id === formKelas.mata_kuliah_id) {
        await loadDetailKelas(formKelas.mata_kuliah_id);
      } else {
        const target = listMk.find((m) => m.id === formKelas.mata_kuliah_id);
        if (target) {
          setSelectedMk(target);
          await loadDetailKelas(target.id);
        }
      }
    } catch (e) {
      setModalErr(e.message);
    }
  }

  async function regenerateKode(kls, mkId) {
    const ok = await confirm(
      `Kode join lama (${kls.kode_join}) tidak akan berlaku lagi dan diganti dengan kode acak baru.`,
      { title: 'Generate ulang kode join?', ok: 'Ya, perbarui' }
    );
    if (!ok) return;
    setNotice('');
    try {
      const res = await api.patch(`/kelas/${kls.id}/regenerate-kode`);
      setNotice(`${res.message} Kode baru: ${res.kode_join}`);
      await loadDetailKelas(mkId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function togglePendaftaran(kls, mkId) {
    setNotice('');
    try {
      const res = await api.patch(`/kelas/${kls.id}/toggle-pendaftaran`);
      setNotice(res.message);
      await loadDetailKelas(mkId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function hapusKelas(kls, mkId) {
    const ok = await confirm(
      `Kelas ${kls.nama_kelas} beserta data terkaitnya akan dihapus permanen.`,
      { title: 'Hapus kelas ini?', ok: 'Ya, hapus' }
    );
    if (!ok) return;
    setNotice('');
    try {
      const res = await api.del(`/kelas/${kls.id}`);
      setNotice(res.message);
      if (kelasPeserta?.id === kls.id) {
        setKelasPeserta(null);
        setListPeserta([]);
      }
      await loadMatkul();
      await loadDetailKelas(mkId);
    } catch (e) {
      setError(e.message);
    }
  }

  function salinKode(kode) {
    navigator.clipboard?.writeText(kode);
    setCopiedKode(kode);
    setTimeout(() => setCopiedKode(''), 2000);
  }

  // --- PENGELOLAAN PESERTA PER KELAS (#26 & #27) ---
  async function bukaDaftarPeserta(kls) {
    if (kelasPeserta?.id === kls.id) {
      setKelasPeserta(null);
      setListPeserta([]);
      return;
    }
    setKelasPeserta(kls);
    setLoadingPeserta(true);
    try {
      const res = await api.get(`/kelas/${kls.id}/peserta`);
      setListPeserta(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPeserta(false);
    }
  }

  async function keluarkanMahasiswa(mhs) {
    if (!kelasPeserta) return;
    const ok = await confirm(
      `${mhs.nama} (${mhs.nim_nip || '-'}) akan dikeluarkan dari Kelas ${kelasPeserta.nama_kelas}.`,
      { title: 'Keluarkan mahasiswa ini?', ok: 'Ya, keluarkan' }
    );
    if (!ok) return;

    setNotice('');
    setError('');
    try {
      const res = await api.del(`/kelas/${kelasPeserta.id}/peserta/${mhs.id}`);
      setNotice(res.message);
      const refreshed = await api.get(`/kelas/${kelasPeserta.id}/peserta`);
      setListPeserta(refreshed.data || []);
      if (selectedMk) await loadDetailKelas(selectedMk.id);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead
        title="Mata Kuliah"
        sub={isDosen ? 'Mata kuliah yang kamu buat' : 'Pantau dan kelola seluruh mata kuliah dosen'}
      />

      {/* Baris Pencarian, Filter Semester, Urutan & Tombol Buat */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-[42px] w-full items-center gap-2 rounded-btn border border-line bg-white px-3.5 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 sm:w-[290px]">
            <Icon name="search" />
            <input
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
              placeholder="Cari kode atau nama mata kuliah..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              aria-label="Cari kode atau nama mata kuliah"
            />
          </label>

          <select
            className="h-[42px] rounded-btn border border-line bg-white px-3.5 text-sm font-medium text-ink focus:border-primary focus:outline-none"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            aria-label="Filter semester"
          >
            <option value="">Semua semester</option>
            {daftarSemester.map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>

          <select
            className="h-[42px] rounded-btn border border-line bg-white px-3.5 text-sm font-medium text-ink focus:border-primary focus:outline-none"
            value={urutkan}
            onChange={(e) => setUrutkan(e.target.value)}
            aria-label="Urutkan mata kuliah"
          >
            <option value="terbaru">Terbaru</option>
            <option value="terlama">Terlama</option>
            <option value="nama">Nama A-Z</option>
          </select>
        </div>

        {isDosen && (
          <button className="btn-primary !py-2.5" onClick={() => bukaModalMk()}>
            + Buat Mata Kuliah
          </button>
        )}
      </div>

      {notice && <Alert type="ok">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {/* Tabel Mata Kuliah */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="bg-soft text-xs font-semibold tracking-[0.5px] text-primary">
                <th className="w-[120px] px-5 py-[13px]">KODE</th>
                <th className="px-5 py-[13px]">NAMA MATA KULIAH</th>
                <th className="w-[90px] px-5 py-[13px]">SKS</th>
                <th className="w-[160px] px-5 py-[13px]">KELAS</th>
                {!isDosen && <th className="w-[200px] px-5 py-[13px]">DOSEN</th>}
                <th className="w-[240px] px-5 py-[13px]">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMk.map((mk) => {
                const jmlKelas = Number(mk.jumlah_kelas || 0);
                const sedangDipilih = selectedMk?.id === mk.id;
                return (
                  <tr
                    key={mk.id}
                    className={`transition-colors odd:bg-white even:bg-[#f8faff] ${
                      sedangDipilih ? '!bg-soft/80' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary">{mk.kode_mk}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink">{mk.nama_mk}</p>
                      {mk.semester && <p className="text-xs text-muted">Semester {mk.semester}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-ink">{mk.sks}</td>
                    <td className="px-5 py-3.5">
                      {jmlKelas > 0 ? (
                        <button
                          type="button"
                          onClick={() => bukaPanelKelas(mk)}
                          className="inline-flex items-center gap-1 rounded-full bg-soft px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white"
                        >
                          {jmlKelas} kelas
                        </button>
                      ) : (
                        <span className="text-xs text-muted">Belum ada kelas</span>
                      )}
                    </td>
                    {!isDosen && (
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink">{mk.nama_dosen}</p>
                        <p className="text-xs text-muted">{mk.nip_dosen || '-'}</p>
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {jmlKelas === 0 && isDosen ? (
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            onClick={() => bukaModalKelas(mk)}
                          >
                            Buat kelas
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={sedangDipilih ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                            onClick={() => bukaPanelKelas(mk)}
                          >
                            {sedangDipilih ? 'Tutup' : 'Kelola kelas'}
                          </button>
                        )}

                        {isDosen && (
                          <button type="button" className="btn-ghost btn-sm" onClick={() => bukaModalMk(mk)}>
                            Edit
                          </button>
                        )}

                        <button
                          type="button"
                          className="flex size-8 items-center justify-center rounded-btn text-muted hover:bg-[#fee2e2] hover:text-bad"
                          aria-label={`Hapus ${mk.nama_mk}`}
                          onClick={() => hapusMk(mk)}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {loading && (
                <tr>
                  <td colSpan={isDosen ? 5 : 6} className="px-5 py-12 text-center text-muted">
                    Memuat mata kuliah...
                  </td>
                </tr>
              )}
              {!loading && paginatedMk.length === 0 && (
                <tr>
                  <td colSpan={isDosen ? 5 : 6} className="px-5 py-12 text-center text-muted">
                    {listMk.length === 0
                      ? 'Belum ada mata kuliah. Klik "+ Buat Mata Kuliah" untuk memulai.'
                      : 'Tidak ada mata kuliah yang cocok dengan pencarian atau filter semester.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        {!loading && filteredMk.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3.5 text-xs text-muted">
            <span>
              Menampilkan <strong className="text-ink">{paginatedMk.length}</strong> dari{' '}
              <strong className="text-ink">{filteredMk.length}</strong> mata kuliah
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-8 items-center justify-center rounded-btn border border-line bg-white font-semibold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Halaman sebelumnya"
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`flex size-8 items-center justify-center rounded-btn font-semibold transition-colors ${
                    safePage === num
                      ? 'bg-primary text-white'
                      : 'border border-line bg-white text-ink hover:bg-soft'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex size-8 items-center justify-center rounded-btn border border-line bg-white font-semibold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Halaman berikutnya"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Panel Detail Kelas & Kode Join saat mata kuliah dipilih */}
      {selectedMk && (
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-soft px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                  {selectedMk.kode_mk}
                </span>
                <span className="text-xs text-muted">{selectedMk.sks} SKS</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-ink">Kelas pada {selectedMk.nama_mk}</h2>
            </div>

            <div className="flex items-center gap-2">
              {isDosen && (
                <button type="button" className="btn-primary btn-sm" onClick={() => bukaModalKelas(selectedMk)}>
                  + Buat Kelas
                </button>
              )}
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setSelectedMk(null);
                  setDetailMk(null);
                  setKelasPeserta(null);
                  setListPeserta([]);
                }}
              >
                Tutup panel
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <p className="py-10 text-center text-sm text-muted">Memuat daftar kelas...</p>
          ) : !detailMk?.kelas?.length ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-ink">Belum ada kelas</p>
              <p className="mt-1 text-xs text-muted">
                Buat kelas untuk mata kuliah ini agar kode join otomatis dibuat.
              </p>
              {isDosen && (
                <button
                  type="button"
                  className="btn-primary btn-sm mt-4"
                  onClick={() => bukaModalKelas(selectedMk)}
                >
                  + Buat kelas
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {detailMk.kelas.map((kls) => (
                <div
                  key={kls.id}
                  className="flex flex-col justify-between gap-3.5 rounded-2xl border border-line bg-[#f8faff] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-ink">Kelas {kls.nama_kelas}</p>
                      <p className="text-xs text-muted">{kls.tahun_ajaran || 'Ganjil 2026/2027'}</p>
                    </div>
                    <span className={kls.is_pendaftaran_buka ? 'badge-ok' : 'badge-off'}>
                      {kls.is_pendaftaran_buka ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}
                    </span>
                  </div>

                  {/* Kotak Kode Join */}
                  <div className="rounded-xl border border-line bg-white p-3">
                    <span className="block text-[11px] font-semibold tracking-wider text-muted">KODE JOIN</span>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="font-mono text-lg font-bold tracking-widest text-primary">
                        {kls.kode_join}
                      </code>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost btn-sm !px-2.5 !py-1 text-xs"
                          onClick={() => salinKode(kls.kode_join)}
                        >
                          {copiedKode === kls.kode_join ? 'Tersalin!' : 'Salin kode'}
                        </button>
                        {isDosen && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm !px-2.5 !py-1 text-xs"
                            onClick={() => regenerateKode(kls, selectedMk.id)}
                          >
                            Generate ulang
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Aksi Kelas + Tombol Lihat Peserta (#26) */}
                  <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={kelasPeserta?.id === kls.id ? 'btn-primary btn-sm text-xs' : 'btn-ghost btn-sm text-xs'}
                        onClick={() => bukaDaftarPeserta(kls)}
                      >
                        Peserta{kls.jumlah_peserta !== undefined ? ` (${kls.jumlah_peserta})` : ''}
                      </button>

                      {isDosen && (
                        <>
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-xs"
                            onClick={() => togglePendaftaran(kls, selectedMk.id)}
                          >
                            {kls.is_pendaftaran_buka ? 'Tutup kode' : 'Buka kode'}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-xs"
                            onClick={() => bukaModalKelas(selectedMk, kls)}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-btn text-muted hover:bg-[#fee2e2] hover:text-bad"
                      aria-label={`Hapus kelas ${kls.nama_kelas}`}
                      onClick={() => hapusKelas(kls, selectedMk.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Panel Daftar Peserta & Keluarkan Mahasiswa (#26 & #27) */}
          {kelasPeserta && (
            <div className="mt-6 rounded-2xl border border-line bg-[#f8faff] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Daftar Peserta · Kelas {kelasPeserta.nama_kelas}
                  </h3>
                  <p className="text-xs text-muted">
                    Total {listPeserta.length} mahasiswa terdaftar
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setKelasPeserta(null);
                    setListPeserta([]);
                  }}
                >
                  Tutup peserta
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="bg-soft text-xs font-semibold text-primary">
                      <th className="w-12 px-4 py-3">NO</th>
                      <th className="w-36 px-4 py-3">NIM</th>
                      <th className="px-4 py-3">NAMA MAHASISWA</th>
                      <th className="px-4 py-3">EMAIL</th>
                      <th className="w-36 px-4 py-3 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPeserta ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted">
                          Memuat daftar peserta...
                        </td>
                      </tr>
                    ) : listPeserta.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted">
                          Belum ada mahasiswa yang bergabung ke kelas ini.
                        </td>
                      </tr>
                    ) : (
                      listPeserta.map((mhs, idx) => (
                        <tr key={mhs.id} className="border-t border-line odd:bg-white even:bg-[#f8faff]">
                          <td className="px-4 py-3 text-muted">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                            {mhs.nim_nip || '-'}
                          </td>
                          <td className="px-4 py-3 font-medium text-ink">{mhs.nama}</td>
                          <td className="px-4 py-3 text-xs text-muted">{mhs.email}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => keluarkanMahasiswa(mhs)}
                              className="btn-danger btn-sm text-xs"
                            >
                              Keluarkan
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Mata Kuliah */}
      <dialog
        ref={mkDialog}
        className="w-[min(92vw,460px)] rounded-[20px] border-0 p-6 text-white [&_.label]:text-white [&_.text-muted]:text-white/80 shadow-card backdrop:bg-ink/60"
      >
        <h2 className="text-lg font-bold">{formMk.id ? 'Edit Mata Kuliah' : 'Buat Mata Kuliah'}</h2>
        <p className="mt-1 text-[13px] text-muted">Isi data mata kuliah yang kamu ampu.</p>
        {modalErr && (
          <div className="mt-3">
            <Alert>{modalErr}</Alert>
          </div>
        )}
        <form onSubmit={simpanMk} className="mt-4 space-y-3.5">
          <Field label="Kode Mata Kuliah" id="mk-kode">
            <input
              id="mk-kode"
              className="input uppercase"
              placeholder="Contoh: IF301"
              required
              maxLength={20}
              value={formMk.kode_mk}
              onChange={(e) => setFormMk({ ...formMk, kode_mk: e.target.value })}
            />
          </Field>
          <Field label="Nama Mata Kuliah" id="mk-nama">
            <input
              id="mk-nama"
              className="input"
              placeholder="Contoh: Basis Data"
              required
              maxLength={150}
              value={formMk.nama_mk}
              onChange={(e) => setFormMk({ ...formMk, nama_mk: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKS" id="mk-sks">
              <input
                id="mk-sks"
                className="input"
                type="number"
                min={1}
                max={6}
                required
                value={formMk.sks}
                onChange={(e) => setFormMk({ ...formMk, sks: e.target.value })}
              />
            </Field>
            <Field label="Semester" id="mk-sem">
              <select
                id="mk-sem"
                className="input"
                value={formMk.semester}
                onChange={(e) => setFormMk({ ...formMk, semester: e.target.value })}
              >
                <option value="">Pilih semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={() => mkDialog.current.close()}>
              Batal
            </button>
            <button className="btn-primary">Simpan</button>
          </div>
        </form>
      </dialog>

      {/* Modal Tambah / Edit Kelas */}
      <dialog
        ref={kelasDialog}
        className="w-[min(92vw,460px)] rounded-[20px] border-0 p-6 text-white [&_.label]:text-white [&_.text-muted]:text-white/80 shadow-card backdrop:bg-ink/60"
      >
        <h2 className="text-lg font-bold">{formKelas.id ? 'Edit Kelas' : 'Buat Kelas Baru'}</h2>
        <p className="mt-1 text-[13px] text-muted">Isi data kelas, kode join dibuat otomatis.</p>
        {modalErr && (
          <div className="mt-3">
            <Alert>{modalErr}</Alert>
          </div>
        )}
        <form onSubmit={simpanKelas} className="mt-4 space-y-3.5">
          <Field label="Nama kelas" id="kls-nama">
            <input
              id="kls-nama"
              className="input"
              placeholder="Contoh: Kelas C"
              required
              maxLength={50}
              value={formKelas.nama_kelas}
              onChange={(e) => setFormKelas({ ...formKelas, nama_kelas: e.target.value })}
            />
          </Field>
          <Field label="Semester / Tahun Ajaran" id="kls-ta">
            <input
              id="kls-ta"
              className="input"
              placeholder="Contoh: Ganjil 2026/2027"
              maxLength={20}
              value={formKelas.tahun_ajaran}
              onChange={(e) => setFormKelas({ ...formKelas, tahun_ajaran: e.target.value })}
            />
          </Field>
          {!formKelas.id && (
            <div className="rounded-xl bg-soft px-4 py-3 text-xs text-primary">
              <strong>KODE JOIN:</strong> Dibuat otomatis oleh sistem saat kelas disimpan (6 karakter unik) dan
              bisa di-generate ulang kapan saja.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={() => kelasDialog.current.close()}>
              Batal
            </button>
            <button className="btn-primary">Simpan kelas</button>
          </div>
        </form>
      </dialog>

      {dialog}
    </div>
  );
}