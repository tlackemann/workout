import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_PORT = Number(process.env.API_PORT ?? 8787);

export default defineConfig({
  root: 'src/client',
  publicDir: '../../public',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    // TV WebViews on Google TV are modern Chromium, but stay conservative.
    target: 'chrome100',
  },
  server: {
    host: true,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
    },
  },
});
