/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#090D16',
          light: '#0E1424',
          panel: '#111827',
        },
        flow: {
          blue: '#0066FF',
          cyan: '#00F0FF',
          emerald: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-blue': '0 0 0 1px rgba(0,102,255,0.25), 0 0 24px rgba(0,102,255,0.35)',
        'glow-cyan': '0 0 0 1px rgba(0,240,255,0.25), 0 0 24px rgba(0,240,255,0.35)',
        panel: '0 8px 32px rgba(0,0,0,0.45)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(0,240,255,0.55)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 0 8px rgba(0,240,255,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-18px,0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.2s ease-in-out infinite',
        float: 'float 8s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
