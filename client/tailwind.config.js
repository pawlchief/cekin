/** Token warna dan radius diambil dari frame "0 Brand & Warna" di Figma. */
module.exports = {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        ink: '#0f1e3c',
        muted: '#64748b',
        line: '#e3e9f6',
        latar: '#e4edff',
        primary: '#2563eb',
        royal: '#1e40af',
        navy: '#0b1f5c',
        ok: '#16a34a',
        warn: '#d97706',
        bad: '#dc2626',
        accent: '#fbbf24',
        field: '#f7f9ff',
        soft: '#eaf1ff',
        pale: '#bfd3ff',
        mist: '#dce7ff'
      },
      boxShadow: { lift: '0 6px 9px rgba(15,31,89,0.07)', card: '0 6px 18px rgba(15,31,89,0.07)' },
      borderRadius: { card: '24px', btn: '10px', hero: '28px' }
    }
  },
  plugins: []
};
