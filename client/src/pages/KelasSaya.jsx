import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Alert, PageHead, useConfirm } from '../components/ui.jsx';
import { fmtTanggal } from '../nav.js';

const HARI_LABEL = {
  senin: 'Senin',
  selasa: 'Selasa',
  rabu: 'Rabu',
  kamis: 'Kamis',
  jumat: 'Jumat'
};

export default function KelasSaya() {
  const [listKelas, setListKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, dialog] = useConfirm();

  const loadKelas = useCallback(async () => {
    try {
      const res = await api.get('/kelas/diikuti');
      setListKelas(res.data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKelas();
  }, [loadKelas]);

  async function keluarKelas(kls) {
    const ok = await confirm(
      `Kamu akan keluar dari ${kls.nama_mk} · Kelas ${kls.nama_kelas}. Untuk masuk kembali, kamu perlu memasukkan kode join lagi.`,
      { title: 'Keluar dari kelas ini?', ok: 'Ya, keluar kelas' }
    );
    if (!ok) return;

    setNotice('');
    setError('');
    try {
      const res = await api.del(`/kelas/${kls.id}/keluar`);
      setNotice(res.message);
      await loadKelas();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead
        title="Kelas Saya"
        sub="Daftar kelas perkuliahan yang sedang kamu ikuti"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Total terdaftar: <strong className="text-ink">{listKelas.length} kelas</strong>
        </p>
        <Link to="/gabung-kelas" className="btn-primary !py-2.5">
          + Gabung Kelas Baru
        </Link>
      </div>

      {notice && <Alert type="ok">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted shadow-card">
          Memuat daftar kelas yang diikuti...
        </div>
      ) : listKelas.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center shadow-card">
          <p className="text-base font-bold text-ink">Kamu belum bergabung ke kelas mana pun</p>
          <p className="mt-1 text-sm text-muted">
            Minta kode kelas 6 karakter kepada dosenmu lalu gabung kelas.
          </p>
          <Link to="/gabung-kelas" className="btn-primary mt-5">
            Gabung Kelas Sekarang
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listKelas.map((kls) => (
            <div
              key={kls.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-5 shadow-card"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-soft px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                    {kls.kode_mk} · {kls.sks} SKS
                  </span>
                  <span className="text-xs text-muted">{kls.jumlah_peserta} peserta</span>
                </div>

                <h2 className="mt-2.5 text-base font-bold text-ink">{kls.nama_mk}</h2>
                <p className="text-sm font-semibold text-primary">Kelas {kls.nama_kelas}</p>

                <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
                  <p className="flex items-center gap-2">
                    <Icon name="user" size={14} className="text-primary" />
                    <span>{kls.nama_dosen}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Icon name="clock" size={14} className="text-primary" />
                    <span>
                      {kls.hari
                        ? `${HARI_LABEL[kls.hari] || kls.hari}, ${kls.jam_mulai} - ${kls.jam_selesai} (${kls.ruang})`
                        : 'Jadwal belum diatur'}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Icon name="cal" size={14} className="text-primary" />
                    <span>Bergabung {fmtTanggal(kls.joined_at)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="font-mono text-xs text-muted">Kode: {kls.kode_join}</span>
                <button
                  type="button"
                  onClick={() => keluarKelas(kls)}
                  className="btn-danger btn-sm"
                >
                  Keluar kelas
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog}
    </div>
  );
}