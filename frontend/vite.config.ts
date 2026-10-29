import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { seoPlugin } from './seo-plugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPlugin()],
  base: process.env.VITE_BASE || '/',
  server: {
    port: 5173,
    host: true,
    // Optional: preview locally against a remote API (e.g. DEV_API_PROXY=https://mediarca-api-sg.onrender.com
    // with VITE_API_URL=/api). The proxy sends no browser Origin, so CORS is not involved.
    ...(process.env.DEV_API_PROXY
      ? { proxy: { '/api': { target: process.env.DEV_API_PROXY, changeOrigin: true } } }
      : {}),
  },
});
