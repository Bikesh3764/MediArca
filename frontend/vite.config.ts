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
  },
});
