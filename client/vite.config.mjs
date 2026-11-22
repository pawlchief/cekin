import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Baca PORT dari .env di root proyek, supaya proxy selalu menunjuk ke port API yang benar.
  const env = loadEnv(mode, path.join(root, '..'), '');
  const apiPort = env.PORT || 3001;
  return {
    root,
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true, // gagal jelas kalau port bentrok, bukan diam-diam pindah ke port lain
      // Browser hanya bicara ke :5174; permintaan /api diteruskan ke Express.
      // Jadi cookie SameSite=Strict tetap bekerja.
      proxy: { '/api': { target: `http://localhost:${apiPort}` } }
    },
    build: { outDir: 'dist', emptyOutDir: true }
  };
});
