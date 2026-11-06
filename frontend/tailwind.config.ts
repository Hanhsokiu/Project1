import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {50:'#eef2ff',100:'#e0e7ff',500:'#6366f1',600:'#4f46e5',700:'#4338ca',900:'#312e81'},
        secondary: {50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',500:'#64748b',600:'#475569',700:'#334155'},
        blue: {50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81'},
        surface:'#f6f8fc', ink:'#172033',
      },
    },
  },
  plugins: [],
} satisfies Config;
