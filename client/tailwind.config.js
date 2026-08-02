/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0a0f',
          surface: '#12121a',
          purple: '#b026ff',
          orange: '#ff6b00',
          muted: '#6b7280',
          text: '#e5e7eb',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'neon-purple': '0 0 8px #b026ff, 0 0 24px rgba(176, 38, 255, 0.35)',
        'neon-orange': '0 0 8px #ff6b00, 0 0 24px rgba(255, 107, 0, 0.35)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
