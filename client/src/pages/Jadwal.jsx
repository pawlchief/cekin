import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Alert, Field, PageHead, useConfirm } from '../components/ui.jsx';

const HARI = [
  ['senin', 'Senin'],
  ['selasa', 'Selasa'],
  ['rabu', 'Rabu'],
  ['kamis', 'Kamis'],
  ['jumat', 'Jumat']
];

// Satu warna per kelas (urutan tetap), dipakai di kartu dan legenda.
const WARNA = [
  'bg-[#e8f0ff] text-[#1d4ed8]',
  'bg-[#d5f7ee] text-[#0f766e]',
  'bg-[#fdf0c4] text-[#b45309]',
  'bg-[#ece8ff] text-[#6d28d9]',
  'bg-[#ffe4ec] text-[#be123c]',
  'bg-[#e0f2fe] text-[#0369a1]'
];
const TITIK = [
  'bg-[#2563eb]',
  'bg-[#0f766e]',
  'bg-[#d97706]',
  'bg-[#7c3aed]',
  'bg-[#e11d48]',
  'bg-[#0284c7]'
];

const EMPTY = { id: null, kelas_id: '', hari: 'senin', ruang: '', jam_mulai: '', jam_selesai: '' };

export default function Jadwal() {
  const [jadwal, setJadwal] = useState([]);
  const [kelas, setKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [formErr, setFormErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, dialog] = useConfirm();

  const load = useCallback(async () => {
    try {
      const [j, k] = await Promise.all([api.get('/jadwal/saya'), api.get('/kelas')]);
      setJadwal(j.data || []);
      setKelas(k.data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const idKelas = useMemo(
    () => [...new Set(jadwal.map((j) => j.kelas_id))].sort((a, b) => a - b),
    [jadwal]
  );
  const indeks = (id) => Math.max(0, idKelas.indexOf(id)) % WARNA.length;
  const legenda = useMemo(
    () =>
      idKelas.map((id) => {
        const j = jadwal.find((x) => x.kelas_id === id);
        return { id, nama: `${j.nama_mk} · ${j.nama_kelas}` };
      }),
    [idKelas, jadwal]
  );

  const editing = form.id !== null;

  // Satu kelas = satu jadwal: sembunyikan kelas yang sudah berjadwal
  // (kecuali kelas dari jadwal yang sedang diubah).
  const kelasTersedia = useMemo(
    () =>
      kelas.filter(
        (k) => k.id === Number(form.kelas_id) || !jadwal.some((j) => j.kelas_id === k.id)
      ),
    [kelas, jadwal, form.kelas_id]
  );

  function mulaiEdit(j) {
    setNotice('');
    setFormErr(null);
    setForm({
      id: j.id,
      kelas_id: j.kelas_id,
      hari: j.hari,
      ruang: j.ruang,
      jam_mulai: j.jam_mulai,
      jam_selesai: j.jam_selesai
    });
  }

  function batalEdit() {
    setForm(EMPTY);
    setFormErr(null);
  }

  async function simpan(e) {
    e.preventDefault();
    setFormErr(null);
    setNotice('');
    setSaving(true);
    try {
      const payload = {
        kelas_id: Number(form.kelas_id),
        hari: form.hari,
        ruang: form.ruang,
        jam_mulai: form.jam_mulai,
        jam_selesai: form.jam_selesai
      };
      const res = editing
        ? await api.put(`/jadwal/${form.id}`, payload)
        : await api.post('/jadwal', payload);
      setNotice(res.message);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setFormErr({ bentrok: err.status === 409, message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function hapus() {
    const ok = await confirm('Jadwal ini akan dihapus permanen.', {
      title: 'Hapus jadwal ini?',
      ok: 'Ya, hapus'
    });
    if (!ok) return;
    setNotice('');
    try {
      const res = await api.del(`/jadwal/${form.id}`);
      setNotice(res.message);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setFormErr({ bentrok: false, message: err.message });
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Jadwal Mengajar" sub="Jadwal mingguan semua kelas yang kamu ampu" />

      {notice && <Alert type="ok">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_330px]">
        {/* Kalender mingguan (#21) */}
        <div>
          {loading ? (
            <p className="py-12 text-center text-sm text-muted">Memuat jadwal...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {HARI.map(([nilai, label]) => {
                const items = jadwal.filter((j) => j.hari === nilai);
                return (
                  <div
                    key={nilai}
                    className="min-h-[200px] rounded-2xl border border-line bg-white p-3 shadow-card"
                  >
                    <p className="rounded-lg bg-soft py-1.5 text-center text-sm font-semibold text-primary">
                      {label}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {items.length === 0 && <p className="text-xs text-muted">Tidak ada kelas</p>}
                      {items.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => mulaiEdit(j)}
                          aria-label={`Ubah jadwal ${j.nama_mk} ${j.nama_kelas}`}
                          className={`w-full rounded-xl p-2.5 text-left transition ${WARNA[indeks(j.kelas_id)]} ${
                            form.id === j.id ? 'ring-2 ring-primary' : 'hover:brightness-95'
                          }`}
                        >
                          <p className="text-xs font-bold leading-snug">
                            {j.nama_mk} · {j.nama_kelas}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-ink">
                            {j.jam_mulai} – {j.jam_selesai}
                          </p>
                          <p className="text-[11px] text-muted">{j.ruang}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {legenda.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              {legenda.map((l) => (
                <span key={l.id} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${TITIK[indeks(l.id)]}`} />
                  {l.nama}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Klik kartu jadwal untuk mengubah atau menghapusnya.</p>
        </div>

        {/* Panel tambah / ubah jadwal (#19, #20) */}
        <form
          onSubmit={simpan}
          className="space-y-3.5 rounded-2xl border border-line bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink">{editing ? 'Ubah jadwal' : 'Tambah jadwal'}</h2>
            {editing && (
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-btn text-muted hover:bg-[#fee2e2] hover:text-bad"
                aria-label="Hapus jadwal ini"
                onClick={hapus}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>

          <Field label="Kelas" id="jd-kelas">
            <select
              id="jd-kelas"
              className="input"
              required
              disabled={editing}
              value={form.kelas_id}
              onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}
            >
              <option value="">Pilih kelas</option>
              {kelasTersedia.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_mk} · {k.nama_kelas}
                </option>
              ))}
            </select>
          </Field>
          {!loading && kelas.length === 0 && (
            <p className="text-xs text-muted">
              Belum ada kelas. Buat kelas dulu di menu Mata Kuliah, lalu kembali ke sini.
            </p>
          )}
          {!loading && kelas.length > 0 && kelasTersedia.length === 0 && (
            <p className="text-xs text-muted">
              Semua kelas sudah punya jadwal. Klik kartu jadwal di kalender untuk mengubahnya.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hari" id="jd-hari">
              <select
                id="jd-hari"
                className="input"
                value={form.hari}
                onChange={(e) => setForm({ ...form, hari: e.target.value })}
              >
                {HARI.map(([nilai, label]) => (
                  <option key={nilai} value={nilai}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ruangan" id="jd-ruang">
              <input
                id="jd-ruang"
                className="input"
                placeholder="R.302"
                required
                maxLength={50}
                value={form.ruang}
                onChange={(e) => setForm({ ...form, ruang: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai" id="jd-mulai">
              <input
                id="jd-mulai"
                type="time"
                className="input"
                required
                value={form.jam_mulai}
                onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })}
              />
            </Field>
            <Field label="Selesai" id="jd-selesai">
              <input
                id="jd-selesai"
                type="time"
                className="input"
                required
                value={form.jam_selesai}
                onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })}
              />
            </Field>
          </div>

          {formErr &&
            (formErr.bentrok ? (
              <div className="rounded-xl bg-[#fee2e2] px-3.5 py-3 text-sm text-bad" role="alert">
                <p className="font-bold">Jadwal bentrok</p>
                <p className="mt-0.5">{formErr.message.replace(/^Jadwal bentrok\.\s*/, '')}</p>
              </div>
            ) : (
              <Alert>{formErr.message}</Alert>
            ))}

          <div className={editing ? 'grid grid-cols-2 gap-3' : ''}>
            {editing && (
              <button type="button" className="btn-ghost" onClick={batalEdit}>
                Batal
              </button>
            )}
            <button className="btn-primary w-full" disabled={saving || kelasTersedia.length === 0}>
              {saving ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Simpan jadwal'}
            </button>
          </div>
        </form>
      </div>

      {dialog}
    </div>
  );
}