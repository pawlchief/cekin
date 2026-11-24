// Pembuat file export. CSV dan Excel dibuat di browser dari tabel yang sedang tampil.

// Teks yang diawali = + - @ dianggap rumus oleh Excel, jadi diberi awalan ' supaya tetap teks.
const aman = (v) => (/^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : v);

export const namaFile = (...bagian) => bagian.join('-').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

function unduh(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}

// kepala: array judul kolom. baris: array of array (angka tetap angka).
export function unduhCsv(nama, kepala, baris) {
  const sel = (v) => `"${String(aman(v ?? '')).replace(/"/g, '""')}"`;
  const csv = '﻿' + [kepala, ...baris].map((r) => r.map(sel).join(',')).join('\r\n');
  unduh(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${nama}.csv`);
}

// Library xlsx baru diunduh browser saat tombol Excel ditekan.
export async function unduhXlsx(nama, namaSheet, kepala, baris) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([kepala, ...baris.map((r) => r.map((v) => (typeof v === 'number' ? v : aman(v ?? ''))))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, namaSheet.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  XLSX.writeFile(wb, `${nama}.xlsx`);
}

// PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF"). Judul halaman jadi nama file bawaan.
export function cetakPdf(judul) {
  const lama = document.title;
  const pulih = () => {
    document.title = lama;
    window.removeEventListener('afterprint', pulih);
  };
  document.title = judul;
  window.addEventListener('afterprint', pulih);
  window.print();
}
