import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Field, PageHead, useConfirm } from '../components/ui.jsx';

const EMPTY_MK = { id: null, kode_mk: '', nama_mk: '', sks: 2, semester: '' };
const EMPTY_KELAS = { id: null, mata_kuliah_id: null, nama_kelas: '', tahun_ajaran: '2026/2027 Ganjil' };

export default function MataKuliah() {
  const { user } = useAuth();
  const isDosen = user?.role === 'dosen';
  const [listMk, setListMk] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [detailMk, setDetailMk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copiedKode, setCopiedKode] = useState('');

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

  async function toggleExpand(mkId) {
    if (expandedId === mkId) {
      setExpandedId(null);
      setDetailMk(null);
      return;
    }
    setExpandedId(mkId);
    await loadDetailKelas(mkId);
  }

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
      if (formMk.id && expandedId === formMk.id) await loadDetailKelas(formMk.id);
    } catch (e) {
      setModalErr(e.message);
    }
  }

  async function hapusMk(mk) {
    const ok = await confirm(
      `Mata kuliah "${mk.kode_mk} - ${mk.nama_mk}" beserta seluruh kelas di dalamnya akan dihapus permanen.`,
      { title: 'Hapus mata kuliah?', ok: 'Ya, hapus' }
    );
    if (!ok) return;
    setNotice('');
    setError('');
    try {
      const res = await api.del(`/mata-kuliah/${mk.id}`);
      setNotice(res.message);
      if (expandedId === mk.id) {
        setExpandedId(null);
        setDetailMk(null);
      }
      await loadMatkul();
    } catch (e) {
      setError(e.message);
    }
  }

  // --- CRUD KELAS & KODE JOIN ---
  function bukaModalKelas(mkId, kls = null) {
    setModalErr('');
    setFormKelas(
      kls
        ? { id: kls.id, mata_kuliah_id: mkId, nama_kelas: kls.nama_kelas, tahun_ajaran: kls.tahun_ajaran || '' }
        : { ...EMPTY_KELAS, mata_kuliah_id: mkId }
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
      await loadDetailKelas(formKelas.mata_kuliah_id);
    } catch (e) {
      setModalErr(e.message);
    }
  }

  async function regenerateKode(kls, mkId) {
    const ok = await confirm(
      `Kode join lama (${kls.kode_join}) tidak akan berlaku lagi dan diganti dengan kode acak baru.`,
      { title: 'Buat ulang kode join?', ok: 'Ya, perbarui kode' }
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
      `Kelas "${kls.nama_kelas}" akan dihapus permanen.`,
      { title: 'Hapus kelas ini?', ok: 'Ya, hapus' }
    );
    if (!ok) return;
    setNotice('');
    try {
      const res = await api.del(`/kelas/${kls.id}`);
      setNotice(res.message);
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

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead
        title="Mata Kuliah & Kelas"
        sub={
          isDosen
            ? 'Kelola mata kuliah, buat kelas baru, dan atur kode join mahasiswa'
            : 'Pantau dan kelola seluruh mata kuliah serta kelas aktif'
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Total: <strong className="text-ink">{listMk.length}</strong> mata kuliah
        </p>
        {isDosen && (
          <button className="btn-primary !py-2.5" onClick={() => bukaModalMk()}>
            + Tambah Mata Kuliah
          </button>
        )}
      </div>

      {notice && <Alert type="ok">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="card py-12 text-center text-sm text-muted">Memuat daftar mata kuliah...</div>
      ) : listMk.length === 0 ? (
        <div className="card py-12 text-center text-sm text-muted">
          {isDosen
            ? 'Belum ada mata kuliah. Klik "+ Tambah Mata Kuliah" untuk mulai membuat.'
            : 'Belum ada data mata kuliah dari dosen.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {listMk.map((mk) => {
            const terbuka = expandedId === mk.id;
            const kelasList = terbuka && detailMk ? detailMk.kelas || [] : [];

            return (
              <div key={mk.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                {/* Baris Utama Mata Kuliah */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-soft px-2.5 py-1 font-mono text-xs font-bold text-primary">
                        {mk.kode_mk}
                      </span>
                      <span className="text-xs font-medium text-muted">
                        {mk.sks} SKS {mk.semester ? `· Semester ${mk.semester}` : ''}
                      </span>
                      {!isDosen && (
                        <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-xs text-ink">
                          Dosen: <b>{mk.nama_dosen}</b>
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1.5 text-base font-bold text-ink">{mk.nama_mk}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={terbuka ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                      onClick={() => toggleExpand(mk.id)}
                    >
                      {terbuka ? 'Tutup Kelas' : 'Lihat & Kelola Kelas'}
                    </button>

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
                </div>

                {/* Panel Daftar Kelas (Expandable) */}
                {terbuka && (
                  <div className="border-t border-line bg-[#f8faff] p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                        Daftar Kelas ({kelasList.length})
                      </h3>
                      {isDosen && (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => bukaModalKelas(mk.id)}
                        >
                          + Tambah Kelas
                        </button>
                      )}
                    </div>

                    {loadingDetail ? (
                      <p className="py-6 text-center text-xs text-muted">Memuat daftar kelas...</p>
                    ) : kelasList.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line bg-white py-6 text-center text-xs text-muted">
                        Belum ada kelas pada mata kuliah ini.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {kelasList.map((kls) => (
                          <div
                            key={kls.id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-ink">Kelas {kls.nama_kelas}</p>
                                <p className="text-xs text-muted">{kls.tahun_ajaran || 'Tahun ajaran belum diatur'}</p>
                              </div>
                              <span className={kls.is_pendaftaran_buka ? 'badge-ok' : 'badge-off'}>
                                {kls.is_pendaftaran_buka ? 'Pendaftaran Buka' : 'Pendaftaran Tutup'}
                              </span>
                            </div>

                            {/* Kotak Kode Join */}
                            <div className="flex items-center justify-between rounded-lg bg-soft px-3 py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-muted">Kode Join</span>
                                <code className="font-mono text-base font-bold tracking-widest text-primary">
                                  {kls.kode_join}
                                </code>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className="btn-ghost btn-sm !px-2.5 !py-1 text-xs"
                                  onClick={() => salinKode(kls.kode_join)}
                                >
                                  {copiedKode === kls.kode_join ? 'Tersalin!' : 'Salin'}
                                </button>
                                {isDosen && (
                                  <button
                                    type="button"
                                    className="btn-ghost btn-sm !px-2.5 !py-1 text-xs"
                                    onClick={() => regenerateKode(kls, mk.id)}
                                    title="Buat kode acak baru"
                                  >
                                    Acak Ulang
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Tombol Aksi Kelas */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                              {isDosen ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className="btn-ghost btn-sm text-xs"
                                    onClick={() => togglePendaftaran(kls, mk.id)}
                                  >
                                    {kls.is_pendaftaran_buka ? 'Tutup Pendaftaran' : 'Buka Pendaftaran'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-sm text-xs"
                                    onClick={() => bukaModalKelas(mk.id, kls)}
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted">Mode pantau admin</span>
                              )}

                              <button
                                type="button"
                                className="flex size-7 items-center justify-center rounded-btn text-muted hover:bg-[#fee2e2] hover:text-bad"
                                aria-label={`Hapus kelas ${kls.nama_kelas}`}
                                onClick={() => hapusKelas(kls, mk.id)}
                              >
                                <Icon name="trash" size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah/Edit Mata Kuliah */}
      <dialog
        ref={mkDialog}
        className="w-[min(92vw,460px)] rounded-[20px] border-0 p-6 text-ink shadow-card backdrop:bg-ink/60"
      >
        <h2 className="text-lg font-bold">{formMk.id ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'}</h2>
        <p className="mt-1 text-[13px] text-muted">Isi informasi dasar mata kuliah yang diampu.</p>
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
              placeholder="Contoh: IF401"
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
              placeholder="Contoh: Pemrograman Web"
              required
              maxLength={150}
              value={formMk.nama_mk}
              onChange={(e) => setFormMk({ ...formMk, nama_mk: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah SKS" id="mk-sks">
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
              <input
                id="mk-sem"
                className="input"
                type="number"
                min={1}
                max={14}
                placeholder="Contoh: 5"
                value={formMk.semester}
                onChange={(e) => setFormMk({ ...formMk, semester: e.target.value })}
              />
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

      {/* Modal Tambah/Edit Kelas */}
      <dialog
        ref={kelasDialog}
        className="w-[min(92vw,440px)] rounded-[20px] border-0 p-6 text-ink shadow-card backdrop:bg-ink/60"
      >
        <h2 className="text-lg font-bold">{formKelas.id ? 'Edit Kelas' : 'Tambah Kelas Baru'}</h2>
        <p className="mt-1 text-[13px] text-muted">
          {formKelas.id
            ? 'Perbarui nama atau tahun ajaran kelas.'
            : 'Kode join unik 6 karakter akan otomatis dibuat saat kelas disimpan.'}
        </p>
        {modalErr && (
          <div className="mt-3">
            <Alert>{modalErr}</Alert>
          </div>
        )}
        <form onSubmit={simpanKelas} className="mt-4 space-y-3.5">
          <Field label="Nama Kelas" id="kls-nama">
            <input
              id="kls-nama"
              className="input"
              placeholder="Contoh: A, B, atau IF-5A"
              required
              maxLength={50}
              value={formKelas.nama_kelas}
              onChange={(e) => setFormKelas({ ...formKelas, nama_kelas: e.target.value })}
            />
          </Field>
          <Field label="Tahun Ajaran" id="kls-ta">
            <input
              id="kls-ta"
              className="input"
              placeholder="Contoh: 2026/2027 Ganjil"
              maxLength={20}
              value={formKelas.tahun_ajaran}
              onChange={(e) => setFormKelas({ ...formKelas, tahun_ajaran: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={() => kelasDialog.current.close()}>
              Batal
            </button>
            <button className="btn-primary">Simpan Kelas</button>
          </div>
        </form>
      </dialog>

      {dialog}
    </div>
  );
}
