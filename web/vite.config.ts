import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo la UI vive en Vite y las llamadas /api van al servidor Express.
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
