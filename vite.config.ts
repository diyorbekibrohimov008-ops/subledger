import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.VERCEL ? [] : [viteSingleFile()]),
  ],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    assetsInlineLimit: process.env.VERCEL ? 4096 : 100000000,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
