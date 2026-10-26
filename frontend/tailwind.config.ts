import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50:'#f3f2f8', 100:'#eae6f8', 500:'#45474b', 600:'#1e2024', 700:'#121316', 900:'#06080c' },
        secondary: {50:'#f3f2f8',100:'#eae6f8',200:'#e9ddff',500:'#8e7ac4',600:'#665399',700:'#4e3b80'},
        blue: {50:'#f5f2fc',100:'#eae6f8',200:'#e9ddff',300:'#cfbcff',400:'#ad94e1',500:'#8e7ac4',600:'#665399',700:'#4e3b80',800:'#39266a',900:'#210952'},
        surface:'#f9f9fa', ink:'#1e2024',
      },
    },
  },
  plugins: [],
} satisfies Config;
