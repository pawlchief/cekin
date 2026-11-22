const str = (v, { min = 1, max = 255 } = {}) => {
  v = String(v ?? '').trim();
  return v.length >= min && v.length <= max ? v : null;
};
const int = (v, { min = -Infinity, max = Infinity } = {}) => {
  if (!/^-?\d+$/.test(String(v ?? '').trim())) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};
const oneOf = (v, list) => (list.includes(v) ? v : null);
// Pola konservatif: hanya karakter email umum. Menolak tanda kutip, < > , ; ( ) dan spasi
// yang bisa membingungkan parser alamat email di library pengirim.
const email = (v) => {
  v = str(v, { max: 150 });
  return v && /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$/.test(v) ? v.toLowerCase() : null;
};
const nimNip = (v) => {
  v = str(v, { min: 3, max: 30 });
  return v && /^[A-Za-z0-9.\-]+$/.test(v) ? v : null;
};
// Minimal 8 karakter, ada huruf dan angka. Maks 72 karena batas bcrypt.
const passwordError = (v) => {
  if (typeof v !== 'string' || v.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (v.length > 72) return 'Kata sandi maksimal 72 karakter.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Kata sandi harus memuat huruf dan angka.';
  return null;
};

module.exports = { str, int, oneOf, email, nimNip, passwordError };
