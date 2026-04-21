/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        slate: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
          300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b',
          600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
        },
        emerald: {
          400: '#34d399', 500: '#10b981', 600: '#059669',
        },
        amber: {
          400: '#fbbf24', 500: '#f59e0b',
        },
        rose: {
          400: '#fb7185', 500: '#f43f5e', 600: '#e11d48',
        },
        sky: {
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7',
        },
        violet: {
          400: '#a78bfa', 500: '#8b5cf6',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 4px 16px -2px rgb(0 0 0 / 0.08)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 16px 32px -4px rgb(0 0 0 / 0.12)',
        'glow-green': '0 0 24px -4px rgb(16 185 129 / 0.4)',
        'glow-red': '0 0 24px -4px rgb(244 63 94 / 0.4)',
        'glow-amber': '0 0 24px -4px rgb(245 158 11 / 0.4)',
      },
    },
  },
  plugins: [],
}
