import type { Config } from 'tailwindcss';
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f8fb',
          100: '#edf2f6',
          200: '#d7e3ec',
          300: '#b4cbdc',
          400: '#86a9c3',
          500: '#527fa3',
          600: '#376d97',
          700: '#204e73',
          800: '#193b59',
          900: '#112b45',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        surface: '#f7f9fb',
        ink: '#1d2d3d',
        success: { DEFAULT: '#12652e', light: '#ddf6e4' },
        warning: { DEFAULT: '#995300', light: '#fff1ce' },
        error:   { DEFAULT: '#b42332', light: '#fff0f2' },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 8px 25px -5px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.03)',
        'float': '0 12px 40px -8px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.05)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
