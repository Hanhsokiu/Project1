import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, __dirname, 'VITE_'), ...process.env };
  const apiUrl = env.VITE_API_URL || '/api';
  let validApiUrl = apiUrl.startsWith('/') && !apiUrl.startsWith('//');
  if (!validApiUrl) {
    try {
      const parsed = new URL(apiUrl);
      validApiUrl = ['http:', 'https:'].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password;
    } catch { validApiUrl = false; }
  }
  if (!validApiUrl) {
    throw new Error('VITE_API_URL must be an HTTP(S) URL or relative API path');
  }
  if (Object.keys(env).some(key => /^VITE_.*(SECRET|PASSWORD|DATABASE|SERVICE_ROLE|JWT)/i.test(key)) ||
      Object.entries(env).some(([key, value]) => key.startsWith('VITE_') && typeof value === 'string' && /sb_secret_|postgres(?:ql)?:\/\//i.test(value))) {
    throw new Error('Server credentials must not be exposed through VITE_* variables');
  }
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@features': path.resolve(__dirname, './src/features'),
      '@app': path.resolve(__dirname, './src/app'),
      '@doan/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  };
});
